const { Pool } = require('pg')
const { logger } = require('../lib/logger')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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

pool.connect()
  .then(() => {
    logger.info('Connected to database', { tag: 'db' })
  })
  .catch((err) => {
    logger.error('Database connection error', { error: err, tag: 'db' })
  })

module.exports = pool
module.exports.checkHealth = checkHealth
module.exports.getPoolStatus = getPoolStatus
