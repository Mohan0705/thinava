const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  maxUses: 7500,
})

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message)
})

pool.on('connect', () => {
  console.log('[DB] New client acquired from pool')
})

pool.on('remove', () => {
  console.log('[DB] Client removed from pool')
})

pool.connect()
  .then(() => {
    console.log('Connected to Supabase PostgreSQL')
  })
  .catch((err) => {
    console.error('Database connection error:', err)
  })

module.exports = pool
