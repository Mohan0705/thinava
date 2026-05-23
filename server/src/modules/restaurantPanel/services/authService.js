const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pool = require('../../../database/connection')
const { OWNER_ROLE } = require('../constants')
const { getRestaurantJwtSecret } = require('../middleware/auth')

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
    return jwt.verify(token, getRestaurantJwtSecret(), { ignoreExpiration: true })
  } catch {
    const error = new Error('Invalid or expired token')
    error.status = 401
    throw error
  }
}

const loginRestaurantOwner = async ({ email, password }) => {
  const owner = await getOwnerByEmail(email)

  if (!owner || !owner.is_active) {
    const error = new Error('Invalid email or password')
    error.status = 401
    throw error
  }

  const matches = await bcrypt.compare(password, owner.password_hash)

  if (!matches) {
    const error = new Error('Invalid email or password')
    error.status = 401
    throw error
  }

  await pool.query(
    'UPDATE restaurant_users SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
    [owner.id]
  )

  const token = jwt.sign(
    {
      restaurantUserId: owner.id,
      restaurantId: owner.restaurant_id,
      role: OWNER_ROLE,
    },
    getRestaurantJwtSecret(),
    { expiresIn: '7d' }
  )

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
  const owner = await getCurrentRestaurantOwner(decoded.restaurantUserId)

  return {
    token: jwt.sign(
      {
        restaurantUserId: decoded.restaurantUserId,
        restaurantId: decoded.restaurantId,
        role: OWNER_ROLE,
      },
      getRestaurantJwtSecret(),
      { expiresIn: '7d' }
    ),
    owner,
  }
}

module.exports = {
  loginRestaurantOwner,
  getCurrentRestaurantOwner,
  refreshRestaurantOwnerSession,
}
