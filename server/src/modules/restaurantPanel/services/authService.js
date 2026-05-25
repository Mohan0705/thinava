const bcrypt = require('bcryptjs')
const pool = require('../../../database/connection')
const { OWNER_ROLE } = require('../constants')
const { signRestaurantToken, verifyRestaurantTokenIgnoreExp } = require('../../../lib/auth/tokenService')
const { logger } = require('../../../lib/logger')
const {
  getCleanSupabaseAuthMessage,
  getSupabaseAdminClient,
  getSupabaseAuthClient,
  getSupabaseAuthHttpStatus,
  logSupabaseAuthResponse,
} = require('../../../lib/supabaseAuth')

const buildOwnerPayload = (row) => ({
  id: row.id,
  email: row.email,
  full_name: row.full_name,
  role: row.role,
  restaurant: {
    id: row.restaurant_id,
    name: row.restaurant_name,
    logo: row.restaurant_logo,
    status: row.restaurant_status,
  },
})

const getOwnerByEmail = async (email) => {
  const result = await pool.query(
    `SELECT ru.*, r.name AS restaurant_name, r.logo AS restaurant_logo, r.status AS restaurant_status
     FROM restaurant_users ru
     JOIN restaurants r ON r.id = ru.restaurant_id
     WHERE LOWER(ru.email) = LOWER($1)`,
    [email]
  )

  return result.rows[0] || null
}

const decodeRestaurantRefreshToken = (token) => {
  if (!token) {
    const error = new Error('Restaurant session token is required')
    error.status = 401
    throw error
  }

  try {
    return verifyRestaurantTokenIgnoreExp(token)
  } catch {
    const error = new Error('Invalid or expired token')
    error.status = 401
    throw error
  }
}

const createAuthError = (message, status = 401, code) => {
  const error = new Error(message)
  error.status = status
  if (code) {
    error.code = code
  }
  return error
}

const verifyLegacyPassword = async (owner, password, reason) => {
  if (!owner.password_hash) {
    logger.warn('Restaurant login: password hash missing', {
      tag: 'auth',
      email: owner.email,
      ownerId: owner.id,
      reason,
    })
    return false
  }

  const matches = await bcrypt.compare(password, owner.password_hash)
  logger.info('Restaurant login: legacy bcrypt verification complete', {
    tag: 'auth',
    email: owner.email,
    ownerId: owner.id,
    matches,
    reason,
  })

  return matches
}

const linkSupabaseUserToOwner = async (owner, supabaseUserId) => {
  if (!supabaseUserId || owner.supabase_user_id === supabaseUserId) {
    return owner
  }

  if (owner.supabase_user_id && owner.supabase_user_id !== supabaseUserId) {
    logger.error('Restaurant login: Supabase user mismatch', {
      tag: 'auth',
      email: owner.email,
      ownerId: owner.id,
      storedSupabaseUserId: owner.supabase_user_id,
      signedInSupabaseUserId: supabaseUserId,
    })
    throw createAuthError('Invalid email or password', 401, 'SUPABASE_USER_MISMATCH')
  }

  await pool.query(
    'UPDATE restaurant_users SET supabase_user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND supabase_user_id IS NULL',
    [supabaseUserId, owner.id]
  )

  owner.supabase_user_id = supabaseUserId
  logger.info('Restaurant login: linked Supabase Auth user to restaurant owner', {
    tag: 'auth',
    email: owner.email,
    ownerId: owner.id,
    supabaseUserId,
  })

  return owner
}

const createSupabaseUserForLegacyOwner = async (owner, password) => {
  const adminClient = getSupabaseAdminClient()

  if (!adminClient) {
    logger.warn('Restaurant login: cannot migrate legacy owner to Supabase Auth without service role key', {
      tag: 'auth',
      email: owner.email,
      ownerId: owner.id,
    })
    return null
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email: owner.email,
    password,
    email_confirm: true,
    user_metadata: {
      role: 'restaurant_owner',
      owner_name: owner.full_name,
      restaurant_id: owner.restaurant_id,
      restaurant_name: owner.restaurant_name,
    },
    app_metadata: {
      app_role: 'restaurant_owner',
      restaurant_id: owner.restaurant_id,
    },
  })

  logSupabaseAuthResponse('restaurant_legacy_migration_create_user', owner.email, data, error, {
    ownerId: owner.id,
    restaurantId: owner.restaurant_id,
  })

  if (error || !data?.user?.id) {
    logger.warn('Restaurant login: Supabase legacy migration failed; allowing legacy session for this login', {
      tag: 'auth',
      email: owner.email,
      ownerId: owner.id,
      errorMessage: error?.message,
      errorStatus: error?.status,
    })
    return null
  }

  await linkSupabaseUserToOwner(owner, data.user.id)
  return data.user.id
}

const verifyRestaurantAuth = async (owner, password) => {
  const supabase = getSupabaseAuthClient()

  if (!supabase) {
    const matches = await verifyLegacyPassword(owner, password, 'supabase_not_configured')
    if (!matches) {
      throw createAuthError('Invalid email or password')
    }
    return { provider: 'legacy', supabaseSession: null }
  }

  logger.info('Restaurant login: Supabase signInWithPassword starting', {
    tag: 'auth',
    email: owner.email,
    ownerId: owner.id,
    passwordLength: password.length,
    hasStoredSupabaseUserId: Boolean(owner.supabase_user_id),
  })

  const { data, error } = await supabase.auth.signInWithPassword({
    email: owner.email,
    password,
  })

  logSupabaseAuthResponse('restaurant_login', owner.email, data, error, {
    ownerId: owner.id,
    passwordLength: password.length,
  })

  if (!error && data?.user?.id) {
    await linkSupabaseUserToOwner(owner, data.user.id)
    return { provider: 'supabase', supabaseSession: data.session || null }
  }

  if (!owner.supabase_user_id) {
    const matchesLegacyPassword = await verifyLegacyPassword(owner, password, 'supabase_login_failed_unlinked_owner')
    if (matchesLegacyPassword) {
      const migratedUserId = await createSupabaseUserForLegacyOwner(owner, password)
      return {
        provider: migratedUserId ? 'supabase_migrated' : 'legacy',
        supabaseSession: null,
      }
    }
  }

  throw createAuthError(
    getCleanSupabaseAuthMessage(error, 'Invalid email or password'),
    getSupabaseAuthHttpStatus(error, 401),
    error?.code || 'SUPABASE_LOGIN_FAILED'
  )
}

const loginRestaurantOwner = async ({ email, password }) => {
  logger.info('Restaurant login attempt', { tag: 'auth', email })

  const owner = await getOwnerByEmail(email)

  if (!owner) {
    logger.warn('Restaurant login: owner not found', { tag: 'auth', email })
    throw createAuthError('Invalid email or password')
  }

  logger.info('Restaurant login: owner found', { 
    tag: 'auth', 
    email,
    ownerId: owner.id,
    isActive: owner.is_active,
    restaurantStatus: owner.restaurant_status,
    supabaseUserId: owner.supabase_user_id || null,
    passwordHashExists: !!owner.password_hash,
    passwordHashLength: owner.password_hash?.length
  })

  if (!owner.is_active) {
    logger.warn('Restaurant login: owner inactive', { tag: 'auth', email, ownerId: owner.id, isActive: owner.is_active })
    throw createAuthError('Account disabled. Please contact support.')
  }

  const authResult = await verifyRestaurantAuth(owner, password)

  if (owner.restaurant_status === 'PENDING_APPROVAL') {
    logger.info('Restaurant login: pending approval', { tag: 'auth', email, restaurantStatus: owner.restaurant_status })
    const error = new Error('Your restaurant account is pending approval from THINAVA admin.')
    error.status = 403
    error.code = 'PENDING_APPROVAL'
    throw error
  }

  if (owner.restaurant_status === 'REJECTED' || owner.restaurant_status === 'SUSPENDED') {
    logger.warn('Restaurant login: blocked', { tag: 'auth', email, restaurantStatus: owner.restaurant_status })
    const error = new Error(`Your restaurant account has been ${owner.restaurant_status.toLowerCase()}. Please contact support.`)
    error.status = 403
    throw error
  }

  await pool.query(
    'UPDATE restaurant_users SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
    [owner.id]
  )

  const token = signRestaurantToken(owner)

  logger.info('Restaurant login successful', {
    tag: 'auth',
    email,
    ownerId: owner.id,
    restaurantId: owner.restaurant_id,
    restaurantStatus: owner.restaurant_status,
    authProvider: authResult.provider,
    hasSupabaseSession: Boolean(authResult.supabaseSession),
  })

  return {
    token,
    owner: buildOwnerPayload(owner),
    authProvider: authResult.provider,
  }
}

const getCurrentRestaurantOwner = async (restaurantUserId) => {
  const result = await pool.query(
    `SELECT ru.id, ru.email, ru.full_name, ru.role, ru.restaurant_id,
            r.name AS restaurant_name, r.logo AS restaurant_logo, r.status AS restaurant_status
     FROM restaurant_users ru
     JOIN restaurants r ON r.id = ru.restaurant_id
     WHERE ru.id = $1`,
    [restaurantUserId]
  )

  if (result.rows.length === 0) {
    const error = new Error('Restaurant owner not found')
    error.status = 404
    throw error
  }

  return buildOwnerPayload(result.rows[0])
}

const refreshRestaurantOwnerSession = async (token) => {
  const decoded = decodeRestaurantRefreshToken(token)
  const owner = await getCurrentRestaurantOwner(decoded.sub)

  return {
    token: signRestaurantToken(owner),
    owner,
  }
}

module.exports = {
  loginRestaurantOwner,
  getCurrentRestaurantOwner,
  refreshRestaurantOwnerSession,
}
