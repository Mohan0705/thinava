const jwt = require('jsonwebtoken')
const pool = require('../../../database/connection')
const { ROLE_PERMISSIONS } = require('../constants')

const getAdminJwtSecret = () =>
  process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'thinava-admin-secret'

const hydrateAdminUser = async (adminUserId) => {
  const result = await pool.query(
    `SELECT id, email, full_name, role, permissions, is_active, last_login_at
     FROM admin_users
     WHERE id = $1`,
    [adminUserId]
  )

  return result.rows[0] || null
}

const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Admin authentication required',
      })
    }

    const decoded = jwt.verify(token, getAdminJwtSecret())
    const admin = await hydrateAdminUser(decoded.adminUserId)

    if (!admin || !admin.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Admin session is invalid or inactive',
      })
    }

    req.adminUser = {
      id: admin.id,
      email: admin.email,
      fullName: admin.full_name,
      role: admin.role,
      permissions:
        Array.isArray(admin.permissions) && admin.permissions.length > 0
          ? admin.permissions
          : ROLE_PERMISSIONS[admin.role] || [],
      lastLoginAt: admin.last_login_at,
    }

    next()
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired admin token',
    })
  }
}

const authorizeAdmin = (...requiredPermissions) => (req, res, next) => {
  const granted = new Set(req.adminUser?.permissions || [])
  const allowed = requiredPermissions.every((permission) => granted.has(permission))

  if (!allowed) {
    return res.status(403).json({
      success: false,
      error: 'You do not have permission to access this admin resource',
    })
  }

  next()
}

module.exports = {
  authenticateAdmin,
  authorizeAdmin,
  getAdminJwtSecret,
}
