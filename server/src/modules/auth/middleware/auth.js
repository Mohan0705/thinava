const jwt = require('jsonwebtoken')
const pool = require('../../../database/connection')

const getCustomerJwtSecret = () =>
  process.env.CUSTOMER_JWT_SECRET || process.env.JWT_SECRET || 'thinava-customer-secret'

const authenticateCustomer = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Customer authentication required',
      })
    }

    const decoded = jwt.verify(token, getCustomerJwtSecret())
    const result = await pool.query(
      `SELECT id,
              COALESCE(full_name, name) AS full_name,
              name,
              phone,
              email,
              profile_image,
              is_verified,
              created_at,
              updated_at,
              last_login
       FROM users
       WHERE id = $1`,
      [decoded.userId]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Customer session is invalid',
      })
    }

    const user = result.rows[0]

    req.customer = {
      id: user.id,
      name: user.name || user.full_name,
      fullName: user.full_name || user.name,
      phone: user.phone,
      email: user.email,
      profileImage: user.profile_image,
      isVerified: Boolean(user.is_verified),
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLogin: user.last_login,
    }

    next()
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired customer token',
    })
  }
}

module.exports = {
  authenticateCustomer,
  getCustomerJwtSecret,
}
