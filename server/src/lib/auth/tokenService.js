const jwt = require('jsonwebtoken')

const ISSUER = process.env.JWT_ISSUER || 'thinava'
const AUDIENCE = process.env.JWT_AUDIENCE || 'thinava-app'

const getSecret = (key, fallback) => process.env[key] || fallback

const getCustomerSecret = () => getSecret('CUSTOMER_JWT_SECRET', 'dev-customer-secret-thinava')
const getAdminSecret = () => getSecret('ADMIN_JWT_SECRET', 'dev-admin-secret-thinava')
const getRiderSecret = () => getSecret('RIDER_JWT_SECRET', 'dev-rider-secret-thinava')
const getRestaurantSecret = () => getSecret('RESTAURANT_JWT_SECRET', 'dev-restaurant-secret-thinava')
const getRefreshSecret = () => getSecret('REFRESH_JWT_SECRET', 'dev-refresh-secret-thinava')

const EXPIRY = {
  customer: '7d',
  admin: '12h',
  rider: '3d',
  restaurant: '3d',
  refresh: '30d',
}

const buildPayload = (sub, role, email, authScope, extra = {}) => ({
  sub: String(sub),
  role,
  email: email || null,
  authScope,
  iss: ISSUER,
  aud: AUDIENCE,
  ...extra,
})

const signCustomerToken = (user) =>
  jwt.sign(
    buildPayload(user.id, 'customer', user.email, 'customer', { phone: user.phone, name: user.name || user.full_name }),
    getCustomerSecret(),
    { expiresIn: EXPIRY.customer }
  )

const signAdminToken = (admin) =>
  jwt.sign(
    buildPayload(admin.id, admin.role, admin.email, 'admin', { fullName: admin.full_name, permissions: admin.permissions || [] }),
    getAdminSecret(),
    { expiresIn: EXPIRY.admin }
  )

const signRiderToken = (rider) =>
  jwt.sign(
    buildPayload(rider.id, 'rider', rider.email, 'rider', { phone: rider.phone, fullName: rider.full_name }),
    getRiderSecret(),
    { expiresIn: EXPIRY.rider }
  )

const signRestaurantToken = (owner) =>
  jwt.sign(
    buildPayload(owner.id, 'restaurant_owner', owner.email, 'restaurant', {
      restaurantId: owner.restaurant_id,
      fullName: owner.full_name,
    }),
    getRestaurantSecret(),
    { expiresIn: EXPIRY.restaurant }
  )

const signRefreshToken = (sub, scope) =>
  jwt.sign(
    { sub: String(sub), scope, iss: ISSUER, aud: AUDIENCE },
    getRefreshSecret(),
    { expiresIn: EXPIRY.refresh }
  )

const verifyToken = (token, secret, expectedScope) => {
  const decoded = jwt.verify(token, secret)
  if (decoded.authScope !== expectedScope) {
    const err = new Error(`Invalid auth scope: expected ${expectedScope}, got ${decoded.authScope}`)
    err.status = 403
    throw err
  }
  if (decoded.iss !== ISSUER) {
    const err = new Error(`Invalid token issuer`)
    err.status = 401
    throw err
  }
  if (decoded.aud !== AUDIENCE) {
    const err = new Error(`Invalid token audience`)
    err.status = 401
    throw err
  }
  return decoded
}

const verifyCustomerToken = (token) => verifyToken(token, getCustomerSecret(), 'customer')
const verifyAdminToken = (token) => verifyToken(token, getAdminSecret(), 'admin')
const verifyRiderToken = (token) => verifyToken(token, getRiderSecret(), 'rider')
const verifyRestaurantToken = (token) => verifyToken(token, getRestaurantSecret(), 'restaurant')
const verifyRefreshToken = (token) => jwt.verify(token, getRefreshSecret())

const verifyCustomerTokenIgnoreExp = (token) => jwt.verify(token, getCustomerSecret(), { ignoreExpiration: true })
const verifyAdminTokenIgnoreExp = (token) => jwt.verify(token, getAdminSecret(), { ignoreExpiration: true })
const verifyRiderTokenIgnoreExp = (token) => jwt.verify(token, getRiderSecret(), { ignoreExpiration: true })
const verifyRestaurantTokenIgnoreExp = (token) => jwt.verify(token, getRestaurantSecret(), { ignoreExpiration: true })

module.exports = {
  signCustomerToken,
  signAdminToken,
  signRiderToken,
  signRestaurantToken,
  signRefreshToken,
  verifyCustomerToken,
  verifyAdminToken,
  verifyRiderToken,
  verifyRestaurantToken,
  verifyRefreshToken,
  verifyCustomerTokenIgnoreExp,
  verifyAdminTokenIgnoreExp,
  verifyRiderTokenIgnoreExp,
  verifyRestaurantTokenIgnoreExp,
  EXPIRY,
  ISSUER,
  AUDIENCE,
}
