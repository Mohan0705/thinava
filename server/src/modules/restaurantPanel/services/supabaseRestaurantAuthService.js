const crypto = require('crypto')
const {
  getCleanSupabaseAuthMessage,
  getSupabaseAdminClient,
  getSupabaseAuthClient,
  getSupabaseAuthHttpStatus,
  logSupabaseAuthResponse,
} = require('../../../lib/supabaseAuth')
const { logger } = require('../../../lib/logger')

const RESTAURANT_ROLE = 'restaurant_owner'
const USER_LIST_PAGE_SIZE = 1000
const USER_LIST_MAX_PAGES = 50

const normalizeEmail = (email) => String(email || '').toLowerCase().trim()

const compactObject = (value) =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== '')
  )

const getRestaurantAuthEnvStatus = () => {
  const missing = []
  if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push('SUPABASE_URL')
  }
  if (!process.env.SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push('SUPABASE_ANON_KEY')
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY')
  }
  if (!process.env.FRONTEND_URL) {
    missing.push('FRONTEND_URL')
  }

  return {
    ready: missing.length === 0,
    missing,
    hasUrl: !missing.includes('SUPABASE_URL'),
    hasAnonKey: !missing.includes('SUPABASE_ANON_KEY'),
    hasServiceRoleKey: !missing.includes('SUPABASE_SERVICE_ROLE_KEY'),
    hasFrontendUrl: !missing.includes('FRONTEND_URL'),
  }
}

const createRestaurantAuthError = (message, status = 401, code = 'RESTAURANT_AUTH_ERROR') => {
  const error = new Error(message)
  error.status = status
  error.code = code
  return error
}

const requireRestaurantAuthClient = () => {
  const client = getSupabaseAuthClient()
  if (!client) {
    throw createRestaurantAuthError(
      'Restaurant sign-in is temporarily unavailable. Please contact support.',
      503,
      'RESTAURANT_AUTH_NOT_CONFIGURED'
    )
  }
  return client
}

const requireRestaurantAdminClient = () => {
  const client = getSupabaseAdminClient()
  if (!client) {
    throw createRestaurantAuthError(
      'Restaurant account management is temporarily unavailable. Please contact support.',
      503,
      'RESTAURANT_AUTH_ADMIN_NOT_CONFIGURED'
    )
  }
  return client
}

const buildRestaurantMetadata = ({
  ownerName,
  ownerPhone,
  restaurantId,
  restaurantName,
} = {}) => ({
  user_metadata: compactObject({
    role: RESTAURANT_ROLE,
    owner_name: ownerName,
    owner_phone: ownerPhone,
    restaurant_id: restaurantId,
    restaurant_name: restaurantName,
  }),
  app_metadata: compactObject({
    app_role: RESTAURANT_ROLE,
    restaurant_id: restaurantId,
  }),
})

const getUserFromListResponse = (data) => {
  if (Array.isArray(data?.users)) return data.users
  if (Array.isArray(data)) return data
  return []
}

const findSupabaseUserByEmail = async (email, adminClient = requireRestaurantAdminClient()) => {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return null

  for (let page = 1; page <= USER_LIST_MAX_PAGES; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: USER_LIST_PAGE_SIZE,
    })

    if (error) {
      throw createRestaurantAuthError(
        getCleanSupabaseAuthMessage(error, 'Unable to inspect restaurant auth users'),
        getSupabaseAuthHttpStatus(error, 500),
        'SUPABASE_USER_LOOKUP_FAILED'
      )
    }

    const users = getUserFromListResponse(data)
    const match = users.find((user) => normalizeEmail(user.email) === normalizedEmail)
    if (match) return match
    if (users.length < USER_LIST_PAGE_SIZE) return null
  }

  logger.warn('Supabase user lookup reached page limit', {
    tag: 'restaurant_auth',
    email: normalizedEmail,
    maxPages: USER_LIST_MAX_PAGES,
  })
  return null
}

const getSupabaseUserById = async (userId, adminClient = requireRestaurantAdminClient()) => {
  if (!userId) return null

  const { data, error } = await adminClient.auth.admin.getUserById(userId)
  if (error) {
    return null
  }

  return data?.user || null
}

const confirmSupabaseRestaurantUser = async (userId, email, metadata = {}) => {
  const adminClient = requireRestaurantAdminClient()
  const updatePayload = {
    email_confirm: true,
    ...buildRestaurantMetadata(metadata),
  }

  const { data, error } = await adminClient.auth.admin.updateUserById(userId, updatePayload)
  logSupabaseAuthResponse('restaurant_confirm_user', email, data, error, { userId })

  if (error) {
    throw createRestaurantAuthError(
      getCleanSupabaseAuthMessage(error, 'Unable to confirm restaurant account'),
      getSupabaseAuthHttpStatus(error, 500),
      'SUPABASE_CONFIRM_FAILED'
    )
  }

  return data?.user || null
}

const syncSupabaseRestaurantMetadata = async (userId, email, metadata = {}) => {
  if (!userId) return null

  const adminClient = requireRestaurantAdminClient()
  const existingUser = await getSupabaseUserById(userId, adminClient)
  if (!existingUser) return null

  const restaurantMetadata = buildRestaurantMetadata(metadata)
  const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...(existingUser.user_metadata || {}),
      ...restaurantMetadata.user_metadata,
    },
    app_metadata: {
      ...(existingUser.app_metadata || {}),
      ...restaurantMetadata.app_metadata,
    },
  })

  logSupabaseAuthResponse('restaurant_metadata_sync', email, data, error, { userId })

  if (error) {
    throw createRestaurantAuthError(
      getCleanSupabaseAuthMessage(error, 'Unable to sync restaurant auth metadata'),
      getSupabaseAuthHttpStatus(error, 500),
      'SUPABASE_METADATA_SYNC_FAILED'
    )
  }

  return data?.user || null
}

const createConfirmedRestaurantAuthUser = async ({
  email,
  password,
  ownerName,
  ownerPhone,
  restaurantId,
  restaurantName,
  allowExisting = false,
}) => {
  const adminClient = requireRestaurantAdminClient()
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail || !password) {
    throw createRestaurantAuthError('Email and password are required.', 400, 'AUTH_CREATE_INPUT_REQUIRED')
  }

  const existingUser = await findSupabaseUserByEmail(normalizedEmail, adminClient)
  if (existingUser) {
    if (!allowExisting) {
      throw createRestaurantAuthError('Email already registered', 409, 'AUTH_USER_ALREADY_EXISTS')
    }

    const metadata = {
      ownerName,
      ownerPhone,
      restaurantId,
      restaurantName,
    }

    if (!existingUser.email_confirmed_at) {
      await confirmSupabaseRestaurantUser(existingUser.id, normalizedEmail, metadata)
    } else {
      await syncSupabaseRestaurantMetadata(existingUser.id, normalizedEmail, metadata)
    }

    return {
      provider: 'supabase',
      userId: existingUser.id,
      user: existingUser,
      emailConfirmationRequired: false,
      existed: true,
    }
  }

  const metadata = buildRestaurantMetadata({
    ownerName,
    ownerPhone,
    restaurantId,
    restaurantName,
  })

  const { data, error } = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    ...metadata,
  })

  logSupabaseAuthResponse('restaurant_admin_create_user', normalizedEmail, data, error, {
    restaurantId: restaurantId || null,
  })

  if (error || !data?.user?.id) {
    throw createRestaurantAuthError(
      error ? getCleanSupabaseAuthMessage(error, 'Restaurant auth user creation failed') : 'Restaurant auth user creation failed',
      error ? getSupabaseAuthHttpStatus(error, 400) : 502,
      error?.code || 'SUPABASE_CREATE_USER_FAILED'
    )
  }

  if (normalizeEmail(data.user.email) !== normalizedEmail) {
    const mismatch = createRestaurantAuthError(
      'Restaurant auth returned a different email for this account.',
      502,
      'SUPABASE_EMAIL_MISMATCH'
    )
    mismatch.supabaseUserId = data.user.id
    throw mismatch
  }

  if (!data.user.email_confirmed_at) {
    await confirmSupabaseRestaurantUser(data.user.id, normalizedEmail, {
      ownerName,
      ownerPhone,
      restaurantId,
      restaurantName,
    })
  }

  return {
    provider: 'supabase',
    userId: data.user.id,
    user: data.user,
    emailConfirmationRequired: false,
    existed: false,
  }
}

const deleteSupabaseRestaurantAuthUser = async (userId, email) => {
  if (!userId) return

  const adminClient = getSupabaseAdminClient()
  if (!adminClient) {
    logger.warn('Skipping restaurant auth cleanup because Supabase admin is not configured', {
      tag: 'restaurant_auth',
      email: normalizeEmail(email),
      userId,
    })
    return
  }

  const { data, error } = await adminClient.auth.admin.deleteUser(userId)
  logSupabaseAuthResponse('restaurant_signup_cleanup', email, data, error, { userId })
}

const createTemporaryPassword = () => crypto.randomBytes(48).toString('base64url')

const ensureSupabaseUserForRestaurantOwner = async (owner, options = {}) => {
  const adminClient = requireRestaurantAdminClient()
  const email = normalizeEmail(owner.email)
  const metadata = {
    ownerName: owner.full_name || owner.owner_name,
    ownerPhone: owner.phone || owner.owner_phone,
    restaurantId: owner.restaurant_id,
    restaurantName: owner.restaurant_name,
  }

  let user = await getSupabaseUserById(owner.supabase_user_id, adminClient)

  if (user && normalizeEmail(user.email) !== email) {
    logger.warn('Restaurant auth user id email mismatch; searching by restaurant owner email', {
      tag: 'restaurant_auth',
      ownerId: owner.id,
      supabaseUserId: owner.supabase_user_id,
      authEmail: normalizeEmail(user.email),
      dbEmail: email,
    })
    user = null
  }

  if (!user) {
    user = await findSupabaseUserByEmail(email, adminClient)
  }

  if (!user) {
    const createResult = await createConfirmedRestaurantAuthUser({
      email,
      password: options.password || createTemporaryPassword(),
      ...metadata,
      allowExisting: true,
    })
    return {
      userId: createResult.userId,
      user: createResult.user,
      created: true,
      confirmed: true,
      passwordResetRecommended: !options.password,
    }
  }

  let confirmed = Boolean(user.email_confirmed_at)
  if (!confirmed) {
    user = await confirmSupabaseRestaurantUser(user.id, email, metadata)
    confirmed = true
  } else {
    user = await syncSupabaseRestaurantMetadata(user.id, email, metadata) || user
  }

  return {
    userId: user.id,
    user,
    created: false,
    confirmed,
    passwordResetRecommended: false,
  }
}

const updateSupabaseRestaurantPassword = async (userId, email, password) => {
  const adminClient = requireRestaurantAdminClient()
  const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  })

  logSupabaseAuthResponse('restaurant_password_update', email, data, error, { userId })

  if (error) {
    throw createRestaurantAuthError(
      getCleanSupabaseAuthMessage(error, 'Unable to update restaurant password'),
      getSupabaseAuthHttpStatus(error, 500),
      'SUPABASE_PASSWORD_UPDATE_FAILED'
    )
  }

  return data?.user || null
}

module.exports = {
  createConfirmedRestaurantAuthUser,
  createRestaurantAuthError,
  deleteSupabaseRestaurantAuthUser,
  ensureSupabaseUserForRestaurantOwner,
  findSupabaseUserByEmail,
  getRestaurantAuthEnvStatus,
  getSupabaseUserById,
  normalizeEmail,
  requireRestaurantAdminClient,
  requireRestaurantAuthClient,
  syncSupabaseRestaurantMetadata,
  updateSupabaseRestaurantPassword,
}
