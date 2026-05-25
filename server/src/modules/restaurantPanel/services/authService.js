const pool = require('../../../database/connection')
const { signRestaurantToken, verifyRestaurantTokenIgnoreExp } = require('../../../lib/auth/tokenService')
const { logger } = require('../../../lib/logger')
const {
  createRestaurantAuthError,
  ensureSupabaseUserForRestaurantOwner,
  normalizeEmail,
  requireRestaurantAuthClient,
} = require('./supabaseRestaurantAuthService')
const {
  getCleanSupabaseAuthMessage,
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

const ownerSelect = `
  SELECT ru.id, ru.supabase_user_id, ru.restaurant_id, ru.email, ru.full_name, ru.phone,
         ru.role, ru.is_active, r.name AS restaurant_name, r.logo AS restaurant_logo,
         r.status AS restaurant_status
  FROM restaurant_users ru
  JOIN restaurants r ON r.id = ru.restaurant_id
`

const getOwnerByEmail = async (email) => {
  const result = await pool.query(
    `${ownerSelect}
     WHERE LOWER(ru.email) = LOWER($1)
     LIMIT 1`,
    [email]
  )

  return result.rows[0] || null
}

const getOwnerBySupabaseUserId = async (supabaseUserId) => {
  if (!supabaseUserId) return null

  const result = await pool.query(
    `${ownerSelect}
     WHERE ru.supabase_user_id = $1
     LIMIT 1`,
    [supabaseUserId]
  )

  return result.rows[0] || null
}

const decodeRestaurantRefreshToken = (token) => {
  if (!token) {
    throw createRestaurantAuthError('Restaurant session token is required', 401, 'SESSION_TOKEN_REQUIRED')
  }

  try {
    return verifyRestaurantTokenIgnoreExp(token)
  } catch {
    throw createRestaurantAuthError('Invalid or expired token', 401, 'INVALID_SESSION_TOKEN')
  }
}

const autoConfirmRestaurantUserAndRetry = async (email, password, initialError) => {
  const owner = await getOwnerByEmail(email)
  if (!owner) {
    throw createRestaurantAuthError(
      getCleanSupabaseAuthMessage(initialError, 'Invalid email or password'),
      getSupabaseAuthHttpStatus(initialError, 401),
      initialError?.code || 'SUPABASE_LOGIN_FAILED'
    )
  }

  await ensureSupabaseUserForRestaurantOwner(owner)

  const supabase = requireRestaurantAuthClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  logSupabaseAuthResponse('restaurant_login_after_confirm_repair', email, data, error, {
    ownerId: owner.id,
  })

  if (error || !data?.user?.id) {
    throw createRestaurantAuthError(
      getCleanSupabaseAuthMessage(error || initialError, 'Invalid email or password'),
      getSupabaseAuthHttpStatus(error || initialError, 401),
      error?.code || initialError?.code || 'SUPABASE_LOGIN_FAILED'
    )
  }

  return data
}

const signInRestaurantOwner = async ({ email, password }) => {
  const supabase = requireRestaurantAuthClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  logSupabaseAuthResponse('restaurant_login', email, data, error)

  if (!error && data?.user?.id) {
    return data
  }

  if (/email not confirmed/i.test(String(error?.message || ''))) {
    return autoConfirmRestaurantUserAndRetry(email, password, error)
  }

  const owner = await getOwnerByEmail(email)
  if (owner) {
    try {
      await ensureSupabaseUserForRestaurantOwner(owner)
    } catch (repairError) {
      logger.warn('Restaurant login repair attempt failed', {
        tag: 'auth',
        email,
        ownerId: owner.id,
        error: repairError,
      })
    }
  }

  throw createRestaurantAuthError(
    getCleanSupabaseAuthMessage(error, 'Invalid email or password'),
    getSupabaseAuthHttpStatus(error, 401),
    error?.code || 'SUPABASE_LOGIN_FAILED'
  )
}

const resolveOwnerAfterSupabaseLogin = async (supabaseUser) => {
  const authEmail = normalizeEmail(supabaseUser.email)
  let owner = await getOwnerBySupabaseUserId(supabaseUser.id)

  if (!owner) {
    owner = await getOwnerByEmail(authEmail)
  }

  if (!owner) {
    logger.error('Restaurant login succeeded in Supabase but no restaurant profile exists', {
      tag: 'auth',
      authUserId: supabaseUser.id,
      email: authEmail,
    })
    throw createRestaurantAuthError(
      'Restaurant profile not found. Please contact THINAVA support.',
      404,
      'RESTAURANT_PROFILE_NOT_FOUND'
    )
  }

  if (owner.supabase_user_id !== supabaseUser.id) {
    try {
      await pool.query(
        `UPDATE restaurant_users
         SET supabase_user_id = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [supabaseUser.id, owner.id]
      )
      owner.supabase_user_id = supabaseUser.id
    } catch (error) {
      logger.warn('Restaurant login could not sync Supabase user id to profile', {
        tag: 'auth',
        ownerId: owner.id,
        restaurantId: owner.restaurant_id,
        email: owner.email,
        supabaseUserId: supabaseUser.id,
        error,
      })
    }
  }

  if (normalizeEmail(owner.email) !== authEmail) {
    logger.warn('Restaurant login auth email differs from profile email; leaving profile email unchanged', {
      tag: 'auth',
      ownerId: owner.id,
      restaurantId: owner.restaurant_id,
      authEmail,
      profileEmail: normalizeEmail(owner.email),
    })
  }

  return owner
}

const assertOwnerCanEnterPanel = (owner) => {
  if (!owner.is_active) {
    throw createRestaurantAuthError('Account disabled. Please contact support.', 403, 'OWNER_DISABLED')
  }

  if (owner.restaurant_status === 'PENDING_APPROVAL') {
    const error = createRestaurantAuthError(
      'Your restaurant account is pending approval from THINAVA admin.',
      403,
      'PENDING_APPROVAL'
    )
    error.approvalStatus = 'PENDING_APPROVAL'
    throw error
  }

  if (owner.restaurant_status === 'REJECTED' || owner.restaurant_status === 'SUSPENDED') {
    throw createRestaurantAuthError(
      `Your restaurant account has been ${owner.restaurant_status.toLowerCase()}. Please contact support.`,
      403,
      owner.restaurant_status
    )
  }
}

const loginRestaurantOwner = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email)
  logger.info('Restaurant login attempt', { tag: 'auth', email: normalizedEmail })

  const authData = await signInRestaurantOwner({ email: normalizedEmail, password })
  const owner = await resolveOwnerAfterSupabaseLogin(authData.user)
  assertOwnerCanEnterPanel(owner)

  await pool.query(
    'UPDATE restaurant_users SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
    [owner.id]
  )

  const token = signRestaurantToken(owner)

  logger.info('Restaurant login successful', {
    tag: 'auth',
    email: normalizedEmail,
    ownerId: owner.id,
    restaurantId: owner.restaurant_id,
    restaurantStatus: owner.restaurant_status,
    authProvider: 'supabase',
    hasSupabaseSession: Boolean(authData.session),
  })

  return {
    token,
    owner: buildOwnerPayload(owner),
    authProvider: 'supabase',
  }
}

const getCurrentRestaurantOwner = async (restaurantUserId) => {
  const result = await pool.query(
    `${ownerSelect}
     WHERE ru.id = $1
     LIMIT 1`,
    [restaurantUserId]
  )

  if (result.rows.length === 0) {
    throw createRestaurantAuthError('Restaurant owner not found', 404, 'OWNER_NOT_FOUND')
  }

  return buildOwnerPayload(result.rows[0])
}

const refreshRestaurantOwnerSession = async (token) => {
  const decoded = decodeRestaurantRefreshToken(token)
  const owner = await getCurrentRestaurantOwner(decoded.sub)

  return {
    token: signRestaurantToken({
      id: owner.id,
      email: owner.email,
      full_name: owner.full_name,
      restaurant_id: owner.restaurant.id,
    }),
    owner,
  }
}

module.exports = {
  getCurrentRestaurantOwner,
  loginRestaurantOwner,
  refreshRestaurantOwnerSession,
}
