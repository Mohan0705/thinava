const bcrypt = require('bcryptjs')
const pool = require('../../../database/connection')
const { OWNER_ROLE } = require('../constants')
const { signRestaurantToken, verifyRestaurantTokenIgnoreExp } = require('../../../lib/auth/tokenService')
const { logger } = require('../../../lib/logger')

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

const loginRestaurantOwner = async ({ email, password }) => {
  logger.info('Restaurant login attempt', { tag: 'auth', email })

  const owner = await getOwnerByEmail(email)

  if (!owner) {
    logger.warn('Restaurant login: owner not found', { tag: 'auth', email })
    const error = new Error('Invalid email or password')
    error.status = 401
    throw error
  }

  logger.info('Restaurant login: owner found', { 
    tag: 'auth', 
    email,
    ownerId: owner.id,
    isActive: owner.is_active,
    restaurantStatus: owner.restaurant_status,
    passwordHashExists: !!owner.password_hash,
    passwordHashLength: owner.password_hash?.length
  })

  if (!owner.is_active) {
    logger.warn('Restaurant login: owner inactive', { tag: 'auth', email, ownerId: owner.id, isActive: owner.is_active })
    const error = new Error('Account disabled. Please contact support.')
    error.status = 401
    throw error
  }

  if (owner.restaurant_status === 'PENDING_APPROVAL') {
    logger.info('Restaurant login: pending approval', { tag: 'auth', email, restaurantStatus: owner.restaurant_status })
    // Try password verification first to distinguish between auth and approval issues
    const matches = await bcrypt.compare(password, owner.password_hash)
    if (!matches) {
      logger.warn('Restaurant login: password mismatch on pending restaurant', { tag: 'auth', email, ownerId: owner.id })
      const error = new Error('Invalid email or password')
      error.status = 401
      throw error
    }
    // Password is valid but restaurant is pending
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

  const matches = await bcrypt.compare(password, owner.password_hash)

  if (!matches) {
    logger.warn('Restaurant login: password mismatch', { tag: 'auth', email, ownerId: owner.id })
    const error = new Error('Invalid email or password')
    error.status = 401
    throw error
  }
  
  logger.info('Restaurant login: password verified', { tag: 'auth', email, ownerId: owner.id })

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
  })

  return {
    token,
    owner: buildOwnerPayload(owner),
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
