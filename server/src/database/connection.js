const { Pool } = require('pg')
const { logger } = require('../lib/logger')

// CRITICAL: Validate DATABASE_URL is correctly loaded
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('╔════════════════════════════════════════════════════════╗')
  console.error('║  ❌ FATAL: DATABASE_URL environment variable not set   ║')
  console.error('╠════════════════════════════════════════════════════════╣')
  console.error('║  This is required for database connectivity            ║')
  console.error('║                                                        ║')
  console.error('║  For Render deployment:                                ║')
  console.error('║  1. Go to your Render service dashboard                ║')
  console.error('║  2. Navigate to "Environment" settings                 ║')
  console.error('║  3. Add DATABASE_URL with your PostgreSQL connection   ║')
  console.error('║  4. Redeploy the service                               ║')
  console.error('║                                                        ║')
  console.error('║  Example format:                                       ║')
  console.error('║  postgresql://user:pass@host:port/database             ║')
  console.error('╚════════════════════════════════════════════════════════╝\n')
  process.exit(1)
}

// Validate the DATABASE_URL is not malformed
if (typeof DATABASE_URL !== 'string' || DATABASE_URL.trim().length === 0) {
  console.error('❌ DATABASE_URL is empty or invalid')
  process.exit(1)
}

// Parse and validate the URL to catch format issues early
try {
  const URL = require('url').URL
  const parsed = new URL(DATABASE_URL)
  if (!parsed.hostname) {
    throw new Error('URL parsing resulted in empty hostname')
  }
  logger.info('Database URL validated', {
    hostname: parsed.hostname,
    port: parsed.port,
    database: parsed.pathname,
    tag: 'db',
  })
} catch (parseErr) {
  console.error('❌ DATABASE_URL format is invalid:')
  console.error(`   ${parseErr.message}`)
  console.error(`   Got: ${DATABASE_URL.substring(0, 100)}`)
  console.error('   Expected format: postgresql://user:password@hostname:port/database')
  process.exit(1)
}

// Create the pool with validated connection string
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  maxUses: 7500,
  query_timeout: 15000,
  statement_timeout: 30000,
})

pool.on('error', (err) => {
  logger.error('Database pool error', { error: err, tag: 'db' })
})

pool.on('connect', () => {
  logger.debug('New DB client acquired from pool', { tag: 'db' })
})

pool.on('remove', () => {
  logger.debug('DB client removed from pool', { tag: 'db' })
})

const checkHealth = async () => {
  const start = Date.now()
  try {
    const result = await pool.query('SELECT 1 AS connected')
    const latency = Date.now() - start
    if (result.rows[0]?.connected === 1) {
      return { status: 'connected', latency }
    }
    return { status: 'error', latency }
  } catch (err) {
    return { status: `error: ${err.message}`, latency: Date.now() - start }
  }
}

const getPoolStatus = () => ({
  totalCount: pool.totalCount,
  idleCount: pool.idleCount,
  waitingCount: pool.waitingCount || 0,
})

// Test connection on first request (lazy connection)
let connectionTested = false
const testConnection = async () => {
  if (connectionTested) return
  connectionTested = true
  try {
    const health = await checkHealth()
    if (health.status === 'connected') {
      logger.info(`Database connected successfully (${health.latency}ms)`, { tag: 'db' })
    } else {
      logger.warn(`Database health check: ${health.status} (${health.latency}ms)`, { tag: 'db' })
    }
  } catch (err) {
    logger.error(`Database connection test failed: ${err.message}`, { error: err, tag: 'db' })
  }
}

module.exports = pool
module.exports.checkHealth = checkHealth
module.exports.getPoolStatus = getPoolStatus
module.exports.testConnection = testConnection
