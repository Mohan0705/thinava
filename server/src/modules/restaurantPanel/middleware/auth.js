const jwt = require('jsonwebtoken')
const pool = require('../../../database/connection')
const { OWNER_ROLE } = require('../constants')

const getRestaurantJwtSecret = () =>
  process.env.RESTAURANT_JWT_SECRET || process.env.JWT_SECRET || 'restaurant-secret-key'

const authenticateRestaurantOwner = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const decoded = jwt.verify(token, getRestaurantJwtSecret())

    if (decoded.role !== OWNER_ROLE) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
      })
    }

    const result = await pool.query(
      `SELECT ru.id, ru.restaurant_id, ru.email, ru.full_name, ru.role, ru.is_active,
              r.name AS restaurant_name, r.logo AS restaurant_logo, r.status AS restaurant_status
       FROM restaurant_users ru
       JOIN restaurants r ON r.id = ru.restaurant_id
       WHERE ru.id = $1`,
      [decoded.restaurantUserId]
    )

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({
        success: false,
        error: 'Restaurant owner account not found',
      })
    }

    req.restaurantOwner = {
      id: result.rows[0].id,
      restaurantId: result.rows[0].restaurant_id,
      email: result.rows[0].email,
      fullName: result.rows[0].full_name,
      role: result.rows[0].role,
      restaurantName: result.rows[0].restaurant_name,
      restaurantLogo: result.rows[0].restaurant_logo,
      restaurantStatus: result.rows[0].restaurant_status,
    }

    next()
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    })
  }
}

module.exports = {
  authenticateRestaurantOwner,
  getRestaurantJwtSecret,
}
