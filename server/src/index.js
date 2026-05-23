const path = require('path')

// Load main .env first, then .env.admin to override admin passwords
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.admin') })
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') })

const http = require('http')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const { logger } = require('./utils/logger')

process.on('unhandledRejection', (reason, promise) => {
  logger.error('UNHANDLED PROMISE REJECTION', reason)
})

process.on('uncaughtException', (error) => {
  logger.error('UNCAUGHT EXCEPTION', error)
  if (process.env.NODE_ENV === 'production') {
    process.exit(1)
  }
})

const authRoutes = require('./routes/auth')
const restaurantRoutes = require('./routes/restaurants')
const menuRoutes = require('./routes/menu')
const orderRoutes = require('./routes/orders')
const userRoutes = require('./routes/users')
const adminRoutes = require('./routes/admin')
const restaurantPanelRoutes = require('./modules/restaurantPanel/routes')
const deliveryRoutes = require('./modules/delivery/routes')
const restaurantAuthRoutes = require('./routes/restaurant-auth')
const riderAuthRoutes = require('./routes/rider-auth')
const adminExtendedRoutes = require('./routes/admin-extended')
const ordersAdvancedRoutes = require('./routes/orders-advanced')
const searchRoutes = require('./routes/search')
const reviewsRoutes = require('./routes/reviews')
const ratingsRoutes = require('./routes/ratings')
const couponsRoutes = require('./routes/coupons')
const { ensureRestaurantPanelSchema } = require('./database/ensureRestaurantPanelSchema')
const { ensureAdminSchema } = require('./database/ensureAdminSchema')
const { ensureCustomerAuthSchema } = require('./database/ensureCustomerAuthSchema')
const { ensureDeliveryLogisticsSchema } = require('./database/ensureDeliveryLogisticsSchema')
const { ensureRiderWalletSchema } = require('./database/ensureRiderWalletSchema')
const { ensureFeaturesSchema } = require('./database/ensureFeaturesSchema')
const { ensureOrderPrivacyAndRatingSchema } = require('./database/ensureOrderPrivacyAndRatingSchema')
const { ensureFoodItemRatingSchema } = require('./database/ensureFoodItemRatingSchema')
const { ensureRestaurantMenuSchema } = require('./database/ensureRestaurantMenuSchema')
const { ensureRestaurantRegistrationSchema } = require('./database/ensureRestaurantRegistrationSchema')
const addNotesToOrderItems = require('./database/migrations/add-notes-to-order-items')
const addOrderLifecycleColumns = require('./database/migrations/add-order-lifecycle-columns')
const { createSocketServer } = require('./realtime/socketServer')

const app = express()
const server = http.createServer(app)
const isProduction = process.env.NODE_ENV === 'production'
const pool = require('./database/connection')

const io = createSocketServer(server, {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
})

// Store io instance on app for access in routes
app.set('io', io)

// Security middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}))

// Rate limiting
// The customer app and restaurant panel both poll live order data, so a low
// global cap can accidentally block legitimate sessions during normal use.
if (isProduction) {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.API_RATE_LIMIT_MAX || 1000),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          message: 'Too many requests, please wait a moment and try again.',
          status: 429,
        },
      })
    },
  })

  app.use('/api/', limiter)
}

// Cache control - prevent stale data on all API responses
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.setHeader('Surrogate-Control', 'no-store')
  next()
})

// Body parsing
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
console.log('Mounting routes...')
app.use('/api/auth', authRoutes)
console.log('✓ Auth routes mounted')
app.use('/api/restaurants', restaurantRoutes)
console.log('✓ Restaurants routes mounted')
app.use('/api/menu', menuRoutes)
console.log('✓ Menu routes mounted')
app.use('/api/orders', orderRoutes)
console.log('✓ Orders routes mounted')
app.use('/api/orders-advanced', ordersAdvancedRoutes)
console.log('✓ Orders advanced routes mounted')
app.use('/api/users', userRoutes)
console.log('✓ Users routes mounted')
app.use('/api/restaurant', restaurantPanelRoutes)
console.log('✓ Restaurant panel routes mounted')
app.use('/api/restaurant-auth', restaurantAuthRoutes)
console.log('✓ Restaurant auth routes mounted')
app.use('/api/rider-auth', riderAuthRoutes)
console.log('✓ Rider auth routes mounted')
app.use('/api/delivery', deliveryRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/admin-extended', adminExtendedRoutes)
console.log('✓ Admin extended routes mounted')
console.log('✓ Delivery routes mounted')
app.use('/api/search', searchRoutes)
console.log('✓ Search routes mounted')
app.use('/api/reviews', reviewsRoutes)
console.log('✓ Reviews routes mounted')
app.use('/api/ratings', ratingsRoutes)
console.log('✓ Ratings routes mounted')
app.use('/api/coupons', couponsRoutes)
console.log('✓ Coupons routes mounted')

// Comprehensive health check
app.get('/api/health', async (req, res) => {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: null,
    database: 'unknown',
    environment: 'unknown',
    realtime: 'unknown',
  }

  try {
    const memoryUsage = process.memoryUsage()
    checks.memory = {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
    }
  } catch (err) {
    checks.memory = `error: ${err.message}`
  }

  try {
    const dbResult = await pool.query('SELECT 1 AS connected')
    checks.database = dbResult.rows[0]?.connected === 1 ? 'connected' : 'error'
  } catch (err) {
    checks.database = `error: ${err.message}`
    checks.status = 'degraded'
  }

  try {
    checks.environment = {
      node_env: process.env.NODE_ENV || 'development',
      has_database_url: Boolean(process.env.DATABASE_URL),
      has_jwt_secret: Boolean(process.env.JWT_SECRET),
      has_frontend_url: Boolean(process.env.FRONTEND_URL),
    }
  } catch (err) {
    checks.environment = `error: ${err.message}`
    checks.status = 'degraded'
  }

  try {
    const io = app.get('io')
    checks.realtime = io ? 'active' : 'inactive'
    if (io) {
      checks.connections = io.engine?.clientsCount || 0
    }
  } catch (err) {
    checks.realtime = `error: ${err.message}`
  }

  res.setHeader('Cache-Control', 'no-store, must-revalidate')
  res.setHeader('Surrogate-Control', 'no-store')
  res.json(checks)
})

// Dev-only: delivery partners count (temporary)
app.get('/api/dev/delivery-count', async (req, res, next) => {
  if (isProduction) {
    return res.status(403).json({ error: 'Forbidden in production environment' })
  }
  try {
    const result = await pool.query('SELECT COUNT(*)::int AS count FROM delivery_partners')
    res.json({ count: result.rows[0].count })
  } catch (err) {
    next(err)
  }
})

// Dev-only: unlock all admin accounts (temporary, for recovery)
app.post('/api/dev/admin-unlock', async (req, res, next) => {
  if (isProduction) {
    return res.status(403).json({ error: 'Forbidden in production' })
  }
  try {
    await pool.query(
      `UPDATE admin_users SET failed_login_attempts = 0, lockout_until = NULL, updated_at = CURRENT_TIMESTAMP`
    )
    const result = await pool.query(
      `SELECT email, is_active, failed_login_attempts, lockout_until FROM admin_users`
    )
    res.json({ success: true, admins: result.rows })
  } catch (err) {
    next(err)
  }
})

// Dev-only: verify admin password (temporary, for debugging)
app.post('/api/dev/admin-verify', async (req, res, next) => {
  if (isProduction) {
    return res.status(403).json({ error: 'Forbidden in production' })
  }
  try {
    const bcrypt = require('bcryptjs')
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' })
    }
    const result = await pool.query(
      `SELECT email, password_hash, is_active, failed_login_attempts FROM admin_users WHERE LOWER(email) = LOWER($1)`,
      [email]
    )
    if (result.rows.length === 0) {
      return res.json({ success: false, reason: 'admin_not_found' })
    }
    const admin = result.rows[0]
    const passwordMatches = await bcrypt.compare(password, admin.password_hash)
    res.json({
      success: passwordMatches,
      email: admin.email,
      is_active: admin.is_active,
      failed_login_attempts: admin.failed_login_attempts,
      hash_prefix: String(admin.password_hash).substring(0, 30) + '...',
    })
  } catch (err) {
    next(err)
  }
})

// Dev-only: test orders endpoint (temporary)
app.get('/api/dev/test-orders', async (req, res, next) => {
  if (isProduction) {
    return res.status(403).json({ error: 'Forbidden in production environment' })
  }
  try {
    const orderService = require('./modules/delivery/services/orderService')
    const orders = await orderService.getAvailableOrders()
    res.json({ success: true, count: orders.length, orders })
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack })
  }
})

// Error handling middleware - comprehensive logging and response
app.use((err, req, res, next) => {
  const status = err.status || 500
  const message = err.message || 'Internal Server Error'

  if (status >= 500) {
    logger.error(`[${req.method}] ${req.path}`, err)
  } else if (status >= 400) {
    logger.warn(`[${req.method}] ${req.path} - ${status}: ${message}`)
  }

  res.status(status).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
})

const PORT = process.env.PORT || 5000

const resetAdminLockouts = async () => {
  try {
    await pool.query(
      `UPDATE admin_users SET failed_login_attempts = 0, lockout_until = NULL, updated_at = CURRENT_TIMESTAMP`
    )
    logger.info('All admin account lockouts reset on startup', { tag: 'admin_auth' })
  } catch (err) {
    logger.error('Failed to reset admin lockouts:', err)
  }
}

ensureRestaurantPanelSchema()
  .then(() => ensureAdminSchema())
  .then(() => resetAdminLockouts())
  .then(() => ensureDeliveryLogisticsSchema())
  .then(() => ensureRiderWalletSchema())
  .then(() => ensureCustomerAuthSchema())
  .then(() => ensureFeaturesSchema())
  .then(() => ensureRestaurantRegistrationSchema())
  .then(() => ensureRestaurantMenuSchema())
  .then(() => ensureOrderPrivacyAndRatingSchema())
  .then(() => ensureFoodItemRatingSchema())
  .then(() => addNotesToOrderItems())
  .then(() => addOrderLifecycleColumns())
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  })
  .catch((error) => {
    console.error('Failed to initialize server schema', error)
    process.exit(1)
  })
