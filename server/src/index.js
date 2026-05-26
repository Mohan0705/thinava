const path = require('path')
const crypto = require('crypto')

// Load .env files BEFORE config validation
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.admin') })
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') })
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.local') })

// Validate required env vars — FAILS FAST if anything missing
const env = require('./config/env')

const http = require('http')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const { logger } = require('./lib/logger')
const { validateRestaurantSupabaseAuthEnvironment } = require('./lib/supabaseAuth')

// ============================================================
// PROCESS SAFETY HANDLERS + GRACEFUL SHUTDOWN
// ============================================================
let shuttingDown = false
const shutdownTasks = []

const registerShutdownTask = (fn) => { shutdownTasks.push(fn) }

const gracefulShutdown = async (signal) => {
  if (shuttingDown) return
  shuttingDown = true
  logger.info(`Shutdown signal received: ${signal}`, { tag: 'system' })

  // Stop accepting new requests
  server.close(() => {
    logger.info('HTTP server stopped', { tag: 'system' })
  })

  // Run all cleanup tasks
  for (const task of shutdownTasks) {
    try {
      await task()
    } catch (err) {
      logger.error('Shutdown task failed', { error: err, tag: 'system' })
    }
  }

  // Force exit after timeout
  setTimeout(() => {
    logger.critical('Forced shutdown after timeout', { tag: 'system' })
    process.exit(1)
  }, 10000).unref()

  // Graceful exit
  setImmediate(() => process.exit(0))
}

process.on('unhandledRejection', (reason) => {
  logger.critical('UNHANDLED PROMISE REJECTION', {
    error: reason instanceof Error ? reason : new Error(String(reason)),
    tag: 'system',
  })
})

process.on('uncaughtException', (error) => {
  logger.critical('UNCAUGHT EXCEPTION', { error, tag: 'system' })
  if (env.NODE_ENV === 'production') {
    gracefulShutdown('uncaughtException')
  }
})

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// ============================================================
// APP SETUP
// ============================================================
const authRoutes = require('./routes/auth')
const restaurantRoutes = require('./routes/restaurants')
const menuRoutes = require('./routes/menu')
const orderRoutes = require('./routes/orders')
const userRoutes = require('./routes/users')
const adminRoutes = require('./routes/admin')
const restaurantPanelRoutes = require('./modules/restaurantPanel/routes')
const deliveryRoutes = require('./modules/delivery/routes')
const restaurantAuthRoutes = require('./routes/restaurant-auth')
const restaurantAuthDebugRoutes = require('./routes/restaurant-auth-debug')
const riderAuthRoutes = require('./routes/rider-auth')
const adminExtendedRoutes = require('./routes/admin-extended')
const ordersAdvancedRoutes = require('./routes/orders-advanced')
const searchRoutes = require('./routes/search')
const reviewsRoutes = require('./routes/reviews')
const ratingsRoutes = require('./routes/ratings')
const couponsRoutes = require('./routes/coupons')
const bannerRoutes = require('./routes/banners')
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
const { ensureMarketingSchema } = require('./database/ensureMarketingSchema')
const addNotesToOrderItems = require('./database/migrations/add-notes-to-order-items')
const addOrderLifecycleColumns = require('./database/migrations/add-order-lifecycle-columns')
const { repairRestaurantAuthUsers } = require('./modules/restaurantPanel/services/authRepairService')
const { getPasswordResetEmailStatus } = require('./modules/restaurantPanel/services/passwordResetEmailService')
const { createSocketServer, closeSocketServer } = require('./realtime/socketServer')
const {
  startRestaurantAvailabilityBroadcaster,
  stopRestaurantAvailabilityBroadcaster,
} = require('./realtime/restaurantAvailabilityBroadcaster')
const { checkHealth, getPoolStatus } = require('./database/connection')

const app = express()
const server = http.createServer(app)
const isProduction = env.NODE_ENV === 'production'

// Trust proxy for Railway/Vercel
app.set('trust proxy', 1)

// ============================================================
// REQUEST ID MIDDLEWARE
// ============================================================
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID().slice(0, 12)
  res.setHeader('x-request-id', req.id)
  logger.setRequestId(req.id)
  req._startTime = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - req._startTime
    if (res.statusCode >= 500) {
      logger.error('Request failed', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        requestId: req.id,
        tag: 'api',
      })
    } else if (res.statusCode >= 400) {
      logger.warn('Request warning', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        requestId: req.id,
        tag: 'api',
      })
    } else if (duration > 2000) {
      logger.warn('Slow request', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        requestId: req.id,
        tag: 'api',
      })
    }
  })

  next()
})

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}))

app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}))

// Rate limiting (production only)
if (isProduction) {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.API_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        message: 'Too many requests, please wait a moment and try again.',
      })
    },
  })
  app.use('/api/', limiter)
}

// Cache control
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.setHeader('Surrogate-Control', 'no-store')
  next()
})

// Body parsing
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// ============================================================
// ROUTES
// ============================================================
logger.info('Mounting routes...', { tag: 'system' })
app.use('/api/auth', authRoutes)
app.use('/api/restaurants', restaurantRoutes)
app.use('/api/menu', menuRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/orders-advanced', ordersAdvancedRoutes)
app.use('/api/users', userRoutes)
app.use('/api/restaurant', restaurantPanelRoutes)
app.use('/api/restaurant-auth', restaurantAuthRoutes)
if (!isProduction) {
  app.use('/api/restaurant-auth-debug', restaurantAuthDebugRoutes)
}
app.use('/api/rider-auth', riderAuthRoutes)
app.use('/api/delivery', deliveryRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/admin-extended', adminExtendedRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/reviews', reviewsRoutes)
app.use('/api/ratings', ratingsRoutes)
app.use('/api/coupons', couponsRoutes)
app.use('/api/banners', bannerRoutes)
logger.info('All routes mounted', { tag: 'system' })

// ============================================================
// SOCKET SETUP
// ============================================================
const io = createSocketServer(server, { corsOrigin: env.FRONTEND_URL })
app.set('io', io)

registerShutdownTask(async () => {
  stopRestaurantAvailabilityBroadcaster()
  await closeSocketServer()
  logger.info('Socket server closed', { tag: 'system' })
})

// ============================================================
// HEALTH + READINESS ENDPOINTS
// ============================================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/health', async (req, res) => {
  const dbHealth = await checkHealth()
  const poolStatus = getPoolStatus()
  const memoryUsage = process.memoryUsage()

  res.json({
    status: dbHealth.status === 'connected' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    requestId: req.id,
    environment: env.NODE_ENV,
    database: dbHealth,
    pool: poolStatus,
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
    },
    realtime: io ? {
      status: 'active',
      connections: io.engine?.clientsCount || 0,
    } : { status: 'inactive' },
  })
})

app.get('/api/ready', async (req, res) => {
  const dbHealth = await checkHealth()
  const ready = dbHealth.status === 'connected'

  res.status(ready ? 200 : 503).json({
    ready,
    timestamp: new Date().toISOString(),
    database: dbHealth,
  })
})

// ============================================================
// DEV-ONLY ENDPOINTS (gated by NODE_ENV)
// ============================================================
app.get('/api/dev/delivery-count', async (req, res, next) => {
  if (isProduction) return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Not available in production' })
  try {
    const pool = require('./database/connection')
    const result = await pool.query('SELECT COUNT(*)::int AS count FROM delivery_partners')
    res.json({ count: result.rows[0].count })
  } catch (err) { next(err) }
})

app.post('/api/dev/admin-unlock', async (req, res, next) => {
  if (isProduction) return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Not available in production' })
  try {
    const pool = require('./database/connection')
    await pool.query('UPDATE admin_users SET failed_login_attempts = 0, lockout_until = NULL, updated_at = CURRENT_TIMESTAMP')
    const result = await pool.query('SELECT email, is_active, failed_login_attempts, lockout_until FROM admin_users')
    res.json({ success: true, admins: result.rows })
  } catch (err) { next(err) }
})

app.post('/api/dev/admin-verify', async (req, res, next) => {
  if (isProduction) return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Not available in production' })
  try {
    const bcrypt = require('bcryptjs')
    const pool = require('./database/connection')
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'email and password required' })
    const result = await pool.query('SELECT email, password_hash, is_active, failed_login_attempts FROM admin_users WHERE LOWER(email) = LOWER($1)', [email])
    if (result.rows.length === 0) return res.json({ success: false, reason: 'admin_not_found' })
    const admin = result.rows[0]
    const passwordMatches = await bcrypt.compare(password, admin.password_hash)
    res.json({
      success: passwordMatches,
      email: admin.email,
      is_active: admin.is_active,
      failed_login_attempts: admin.failed_login_attempts,
      hash_prefix: String(admin.password_hash).substring(0, 30) + '...',
    })
  } catch (err) { next(err) }
})

app.get('/api/dev/test-orders', async (req, res, next) => {
  if (isProduction) return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Not available in production' })
  try {
    const orderService = require('./modules/delivery/services/orderService')
    const orders = await orderService.getAvailableOrders()
    res.json({ success: true, count: orders.length, orders })
  } catch (err) { res.status(500).json({ error: err.message, stack: env.NODE_ENV === 'development' ? err.stack : undefined }) }
})

// ============================================================
// GLOBAL ERROR MIDDLEWARE
// ============================================================
app.use((err, req, res, next) => {
  const status = err.status || 500
  const code = err.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR')
  let message = err.message || 'Internal Server Error'

  // Never leak raw DB errors in production
  if (env.NODE_ENV !== 'development' && (err.code?.startsWith('22') || err.code?.startsWith('23') || err.message?.includes('syntax for type'))) {
    message = 'An unexpected error occurred. Please try again.'
  }

  logger.error(`[${req.method}] ${req.path}`, {
    error: err,
    status,
    code,
    requestId: req.id,
    tag: 'api',
    dbCode: err.code,
  })

  const body = {
    success: false,
    code,
    message,
    requestId: req.id,
    status, // Include HTTP status in response body for frontend error handling
  }

  // Include custom error properties for specific auth flows
  if (err.code === 'PENDING_APPROVAL') {
    body.approvalStatus = 'PENDING_APPROVAL'
  }

  if (env.NODE_ENV === 'development' && err.stack) {
    body.stack = err.stack
  }

  res.status(status).json(body)
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
    requestId: req.id,
  })
})

// ============================================================
// STARTUP
// ============================================================
const PORT = process.env.PORT || 5000
const pool = require('./database/connection')
const { testConnection } = require('./database/connection')

const resetAdminLockouts = async () => {
  try {
    await pool.query('UPDATE admin_users SET failed_login_attempts = 0, lockout_until = NULL, updated_at = CURRENT_TIMESTAMP')
    logger.info('Admin lockouts reset', { tag: 'admin_auth' })
  } catch (err) {
    logger.error('Failed to reset admin lockouts', { error: err, tag: 'admin_auth' })
  }
}

registerShutdownTask(async () => {
  await pool.end()
  logger.info('Database pool closed', { tag: 'system' })
})

// Test database connection first
validateRestaurantSupabaseAuthEnvironment()
const passwordResetEmailStatus = getPasswordResetEmailStatus()
if (!passwordResetEmailStatus.configured) {
  logger.warn('Restaurant password reset email provider is not configured; reset URLs will be logged as fallback', {
    tag: 'restaurant_password_reset',
    provider: passwordResetEmailStatus.provider || null,
    reason: passwordResetEmailStatus.reason,
  })
}

testConnection()
  .then(() => ensureRestaurantPanelSchema())
  .then(() => ensureAdminSchema())
  .then(() => resetAdminLockouts())
  .then(() => ensureDeliveryLogisticsSchema())
  .then(() => ensureRiderWalletSchema())
  .then(() => ensureCustomerAuthSchema())
  .then(() => ensureFeaturesSchema())
  .then(() => ensureRestaurantRegistrationSchema())
  .then(() => repairRestaurantAuthUsers().catch((error) => {
    logger.error('Restaurant auth repair failed during startup; continuing with server start', {
      error,
      tag: 'restaurant_auth_repair',
    })
  }))
  .then(() => ensureRestaurantMenuSchema())
  .then(() => ensureMarketingSchema())
  .then(() => ensureOrderPrivacyAndRatingSchema())
  .then(() => ensureFoodItemRatingSchema())
  .then(() => addNotesToOrderItems())
  .then(() => addOrderLifecycleColumns())
  .then(() => {
    startRestaurantAvailabilityBroadcaster()
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`)
      console.log(`
╔══════════════════════════════════════════════╗
║           THINAVA SERVER STARTED             ║
╠══════════════════════════════════════════════╣
║  Environment: ${(env.NODE_ENV || 'development').padEnd(33)}║
║  Port:        ${String(PORT).padEnd(33)}║
║  Frontend:    ${(env.FRONTEND_URL || '').padEnd(33)}║
║  Database:    ${(env.DATABASE_URL ? '✓ configured' : '✗ missing').padEnd(33)}║
║  JWT Secrets: ${(env.CUSTOMER_JWT_SECRET ? '✓' : '✗')} ${(env.ADMIN_JWT_SECRET ? '✓' : '✗')} ${(env.RIDER_JWT_SECRET ? '✓' : '✗')} ${(env.RESTAURANT_JWT_SECRET ? '✓' : '✗')}${' '.repeat(21)}║
╚══════════════════════════════════════════════╝
      `)
    })
  })
  .catch((error) => {
    logger.critical('Failed to initialize server', { error, tag: 'system' })
    process.exit(1)
  })
