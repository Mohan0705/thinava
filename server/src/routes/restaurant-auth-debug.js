/**
 * Development-only restaurant auth diagnostics.
 *
 * Production does not mount this router. These endpoints intentionally avoid
 * local password-hash validation because Supabase Auth is the source of truth.
 */

const express = require('express')
const pool = require('../database/connection')
const restaurantPanelAuthService = require('../modules/restaurantPanel/services/authService')
const { getRestaurantAuthEnvStatus } = require('../modules/restaurantPanel/services/supabaseRestaurantAuthService')

const router = express.Router()

router.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, error: 'Not found' })
  }
  return next()
})

router.get('/status', (req, res) => {
  const status = getRestaurantAuthEnvStatus()
  res.json({
    success: true,
    supabaseAuth: {
      ready: status.ready,
      missing: status.missing,
    },
  })
})

router.get('/restaurants', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        r.id,
        r.name,
        r.status AS restaurant_status,
        r.is_open,
        ru.id AS user_id,
        ru.email,
        ru.full_name,
        ru.role,
        ru.is_active,
        ru.supabase_user_id,
        ru.created_at AS user_created_at,
        ru.last_login_at,
        ra.status AS approval_status,
        ra.approved_at
      FROM restaurants r
      LEFT JOIN restaurant_users ru ON r.id = ru.restaurant_id
      LEFT JOIN restaurant_approvals ra ON r.id = ra.restaurant_id
      ORDER BY r.created_at DESC
      LIMIT 20
    `)

    res.json({
      success: true,
      count: result.rows.length,
      restaurants: result.rows,
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/test-login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim()
    const password = req.body?.password

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'email and password required' })
    }

    const result = await restaurantPanelAuthService.loginRestaurantOwner({ email, password })

    return res.json({
      success: true,
      authProvider: result.authProvider,
      hasToken: Boolean(result.token),
      owner: {
        id: result.owner.id,
        email: result.owner.email,
        restaurantId: result.owner.restaurant.id,
        restaurantStatus: result.owner.restaurant.status,
      },
    })
  } catch (error) {
    return res.status(error.status || 400).json({
      success: false,
      code: error.code || 'RESTAURANT_AUTH_DIAGNOSTIC_FAILED',
      error: error.message || 'Restaurant login diagnostic failed',
    })
  }
})

router.get('/schema', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'restaurant_users'
      ORDER BY ordinal_position
    `)

    res.json({
      success: true,
      table: 'restaurant_users',
      columns: result.rows,
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/test-password', (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Local restaurant password hash validation has been removed. Use Supabase Auth login diagnostics.',
  })
})

router.post('/hash-test', (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Restaurant password hashes are not an authentication source.',
  })
})

module.exports = router
