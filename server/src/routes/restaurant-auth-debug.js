/**
 * Restaurant Auth Debug Endpoint
 * 
 * Diagnostic endpoint for testing and debugging restaurant authentication flows
 * Can be called to verify signup, password hashing, and login functionality
 */

const express = require('express')
const bcrypt = require('bcryptjs')
const pool = require('../database/connection')
const { signRestaurantToken } = require('../lib/auth/tokenService')
const router = express.Router()

/**
 * GET /api/restaurant-auth-debug/restaurants
 * List all restaurants with their auth status
 */
router.get('/restaurants', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        r.id,
        r.name,
        r.status as restaurant_status,
        r.is_open,
        ru.id as user_id,
        ru.email,
        ru.full_name,
        ru.role,
        ru.is_active,
        ru.password_hash,
        ru.created_at as user_created_at,
        ra.status as approval_status,
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
      restaurants: result.rows.map(row => ({
        ...row,
        password_hash: row.password_hash ? `${row.password_hash.substring(0, 15)}...${row.password_hash.length} chars` : null
      }))
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/restaurant-auth-debug/test-password
 * Test password hashing and verification
 * Body: { email, password }
 */
router.post('/test-password', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'email and password required' })
    }

    // Find the user
    const userResult = await pool.query(
      'SELECT * FROM restaurant_users WHERE email = $1',
      [email]
    )

    if (userResult.rows.length === 0) {
      return res.json({
        success: false,
        reason: 'user_not_found',
        email
      })
    }

    const user = userResult.rows[0]

    // Test password
    const isValid = await bcrypt.compare(password, user.password_hash)

    res.json({
      success: true,
      email: user.email,
      userId: user.id,
      passwordMatch: isValid,
      userStatus: {
        is_active: user.is_active,
        role: user.role,
        created_at: user.created_at
      },
      passwordHash: {
        length: user.password_hash.length,
        algorithm: user.password_hash.startsWith('$2b$') ? 'bcrypt' : 'unknown',
        firstChars: user.password_hash.substring(0, 20)
      },
      message: isValid 
        ? 'Password is valid ✅' 
        : 'Password does not match ❌'
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/restaurant-auth-debug/test-login
 * Test the login flow without JWT generation
 * Body: { email, password }
 */
router.post('/test-login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'email and password required' })
    }

    console.log('🔍 Testing login flow for:', email)

    // Step 1: Find user
    console.log('Step 1: Finding user by email...')
    const userResult = await pool.query(
      `SELECT ru.*, r.id as restaurant_id, r.status as restaurant_status
       FROM restaurant_users ru
       JOIN restaurants r ON r.id = ru.restaurant_id
       WHERE ru.email = $1`,
      [email]
    )

    if (userResult.rows.length === 0) {
      console.log('❌ User not found')
      return res.json({
        success: false,
        step: 1,
        reason: 'user_not_found',
        email
      })
    }

    const user = userResult.rows[0]
    console.log('✅ User found:', { id: user.id, email: user.email })

    // Step 2: Check is_active
    console.log('Step 2: Checking is_active status...')
    if (!user.is_active) {
      console.log('❌ User is inactive')
      return res.json({
        success: false,
        step: 2,
        reason: 'user_inactive',
        email,
        is_active: user.is_active
      })
    }
    console.log('✅ User is active')

    // Step 3: Check restaurant status
    console.log('Step 3: Checking restaurant status...')
    if (user.restaurant_status === 'PENDING_APPROVAL') {
      console.log('⚠️  Restaurant pending approval')
      // Continue to password check
      console.log('Step 4: Verifying password before returning pending approval...')
      const isValid = await bcrypt.compare(password, user.password_hash)
      if (!isValid) {
        console.log('❌ Password mismatch')
        return res.json({
          success: false,
          step: 4,
          reason: 'invalid_password',
          email,
          restaurantStatus: user.restaurant_status
        })
      }
      console.log('✅ Password verified')
      return res.json({
        success: false,
        step: 3,
        reason: 'pending_approval',
        email,
        restaurantStatus: user.restaurant_status,
        passwordValid: true,
        message: 'Credentials are valid but restaurant is pending approval'
      })
    }

    if (user.restaurant_status === 'REJECTED' || user.restaurant_status === 'SUSPENDED') {
      console.log('❌ Restaurant status blocked:', user.restaurant_status)
      return res.json({
        success: false,
        step: 3,
        reason: 'restaurant_blocked',
        email,
        restaurantStatus: user.restaurant_status
      })
    }

    console.log('✅ Restaurant status OK:', user.restaurant_status)

    // Step 4: Verify password
    console.log('Step 4: Verifying password...')
    console.log('Password hash info:', {
      length: user.password_hash?.length,
      starts_with: user.password_hash?.substring(0, 10)
    })

    const isPasswordValid = await bcrypt.compare(password, user.password_hash)

    if (!isPasswordValid) {
      console.log('❌ Password mismatch')
      return res.json({
        success: false,
        step: 4,
        reason: 'invalid_password',
        email,
        passwordHashExists: !!user.password_hash,
        passwordHashLength: user.password_hash?.length
      })
    }

    console.log('✅ Password verified')

    // Step 5: Success
    console.log('Step 5: Login would succeed ✅')
    res.json({
      success: true,
      email,
      restaurantId: user.restaurant_id,
      restaurantStatus: user.restaurant_status,
      isActive: user.is_active,
      message: 'All checks passed - login would succeed',
      testResult: {
        userFound: true,
        isActive: true,
        restaurantStatusOK: true,
        passwordValid: true
      }
    })
  } catch (error) {
    console.error('❌ Test login error:', error)
    res.status(500).json({ success: false, error: error.message, stack: error.stack })
  }
})

/**
 * GET /api/restaurant-auth-debug/schema
 * Check the restaurant_users table schema
 */
router.get('/schema', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'restaurant_users'
      ORDER BY ordinal_position
    `)

    res.json({
      success: true,
      table: 'restaurant_users',
      columns: result.rows
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/restaurant-auth-debug/hash-test
 * Test bcrypt hashing and comparison
 * Body: { password }
 */
router.post('/hash-test', async (req, res) => {
  try {
    const { password } = req.body

    if (!password) {
      return res.status(400).json({ success: false, error: 'password required' })
    }

    console.log('🔐 Testing bcrypt with password length:', password.length)

    // Hash the password
    const hash1 = await bcrypt.hash(password, 10)
    console.log('✅ Hash 1 created:', hash1.substring(0, 20) + '...')

    // Verify it
    const verify1 = await bcrypt.compare(password, hash1)
    console.log('✅ Verify 1:', verify1)

    // Hash again with same rounds
    const hash2 = await bcrypt.hash(password, 10)
    console.log('✅ Hash 2 created:', hash2.substring(0, 20) + '...')

    // Verify against both hashes
    const verify1_2 = await bcrypt.compare(password, hash2)
    const verify2_1 = await bcrypt.compare(password, hash1)

    res.json({
      success: true,
      password_length: password.length,
      hashes: {
        hash1: {
          value: hash1,
          length: hash1.length,
          verify: verify1
        },
        hash2: {
          value: hash2,
          length: hash2.length,
          verify: verify1_2
        }
      },
      verification: {
        password_vs_hash1: verify1,
        password_vs_hash2: verify1_2,
        hash1_vs_hash2: hash1 === hash2 // Should be false (different salts)
      },
      note: 'Both hashes should verify correctly even though they are different (different salts)'
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

module.exports = router
