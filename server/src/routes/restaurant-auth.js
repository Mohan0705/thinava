/**
 * THINAVA Restaurant Authentication Routes
 * Production-grade authentication with security measures
 * 
 * Security Features:
 * - JWT token-based auth (7-day expiry)
 * - Bcrypt password hashing (10 salt rounds)
 * - Email and phone uniqueness validation
 * - Input validation and sanitization
 * - PENDING_APPROVAL workflow (no default login)
 * - Real-time Socket.IO notifications
 * 
 * Endpoints:
 * - POST /api/restaurant-auth/register
 * - POST /api/restaurant-auth/login
 * - GET /api/restaurant-auth/profile
 * - POST /api/restaurant-auth/logout
 */

const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const { body, validationResult } = require('express-validator')
const pool = require('../database/connection')
const { signRestaurantToken, verifyRestaurantToken } = require('../lib/auth/tokenService')
const restaurantPanelAuthService = require('../modules/restaurantPanel/services/authService')
const {
  getCleanSupabaseAuthMessage,
  getSupabaseAdminClient,
  getSupabaseAuthClient,
  getSupabaseAuthHttpStatus,
  logSupabaseAuthResponse,
} = require('../lib/supabaseAuth')

const BCRYPT_ROUNDS = 10
const MAX_LOGIN_ATTEMPTS = 5
const LOGIN_ATTEMPT_WINDOW = 15 * 60 * 1000 // 15 minutes
const MAX_SIGNUPS_PER_PHONE_PER_DAY = 3

// Validation middleware
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

const validatePhone = (phone) => {
  const re = /^[0-9]{10}$/
  return re.test(phone.replace(/\D/g, ''))
}

const createRestaurantSupabaseAuthUser = async ({
  email,
  password,
  restaurantName,
  ownerName,
  ownerPhone,
}) => {
  const supabase = getSupabaseAuthClient()

  if (!supabase) {
    console.warn('Supabase Auth signup skipped; missing SUPABASE_URL/SUPABASE_ANON_KEY', {
      email,
    })
    return {
      provider: 'legacy',
      userId: null,
      emailConfirmationRequired: false,
      hasSession: false,
    }
  }

  console.log('Supabase Auth signup starting', {
    email,
    passwordLength: password.length,
    restaurantName,
  })

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: 'restaurant_owner',
        restaurant_name: restaurantName,
        owner_name: ownerName,
        owner_phone: ownerPhone,
      },
    },
  })

  logSupabaseAuthResponse('restaurant_signup', email, data, error, {
    passwordLength: password.length,
  })

  if (error || !data?.user?.id) {
    const signupError = new Error(
      error ? getCleanSupabaseAuthMessage(error, 'Restaurant auth signup failed') : 'Restaurant auth signup did not return a user'
    )
    signupError.status = error ? getSupabaseAuthHttpStatus(error, 400) : 502
    signupError.code = 'SUPABASE_SIGNUP_FAILED'
    throw signupError
  }

  if (
    data.user.email &&
    data.user.email.toLowerCase().trim() !== email.toLowerCase().trim()
  ) {
    const signupError = new Error('Supabase Auth returned a different email for this signup')
    signupError.status = 502
    signupError.code = 'SUPABASE_EMAIL_MISMATCH'
    signupError.supabaseUserId = data.user.id
    throw signupError
  }

  if (
    process.env.SUPABASE_AUTH_AUTO_CONFIRM_RESTAURANTS === 'true' &&
    !data.user.email_confirmed_at
  ) {
    const adminClient = getSupabaseAdminClient()

    if (adminClient) {
      const { data: confirmedData, error: confirmError } =
        await adminClient.auth.admin.updateUserById(data.user.id, {
          email_confirm: true,
        })

      logSupabaseAuthResponse('restaurant_signup_auto_confirm', email, confirmedData, confirmError, {
        userId: data.user.id,
      })

      if (confirmError) {
        const confirmFailure = new Error(getCleanSupabaseAuthMessage(confirmError, 'Failed to confirm restaurant email'))
        confirmFailure.status = getSupabaseAuthHttpStatus(confirmError, 502)
        confirmFailure.code = 'SUPABASE_CONFIRM_FAILED'
        confirmFailure.supabaseUserId = data.user.id
        throw confirmFailure
      }
    } else {
      console.warn('SUPABASE_AUTH_AUTO_CONFIRM_RESTAURANTS=true but SUPABASE_SERVICE_ROLE_KEY is missing', {
        email,
        userId: data.user.id,
      })
    }
  }

  return {
    provider: 'supabase',
    userId: data.user.id,
    emailConfirmationRequired: !data.session && !data.user.email_confirmed_at,
    hasSession: Boolean(data.session),
  }
}

const cleanupSupabaseAuthUser = async (userId, email) => {
  if (!userId) {
    return
  }

  const adminClient = getSupabaseAdminClient()
  if (!adminClient) {
    console.warn('Skipping Supabase Auth cleanup; SUPABASE_SERVICE_ROLE_KEY is missing', {
      email,
      userId,
    })
    return
  }

  const { data, error } = await adminClient.auth.admin.deleteUser(userId)
  logSupabaseAuthResponse('restaurant_signup_cleanup', email, data, error, { userId })
}

// Error handler wrapper
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// Middleware: Authenticate restaurant owner
const authenticateRestaurant = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' })
  }
  
  try {
    const decoded = verifyRestaurantToken(token)
    req.restaurant = {
      restaurantUserId: decoded.sub,
      restaurantId: decoded.restaurantId,
      email: decoded.email,
      fullName: decoded.fullName,
    }
    next()
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }
}

// ============================================================
// REGISTER NEW RESTAURANT
// ============================================================
router.post('/register', asyncHandler(async (req, res) => {
  // Validate input
  const { 
    restaurantName, 
    ownerName, 
    ownerPhone, 
    ownerEmail: rawEmail, 
    password, 
    confirmPassword,
    address,
    latitude,
    longitude,
    city,
    state,
    pincode,
    category,
    vegNonVeg,
    openingTime,
    closingTime,
    deliveryRadius,
    gstNumber,
    fssaiLicense
  } = req.body

  // Normalize email to lowercase
  const ownerEmail = String(rawEmail || '').toLowerCase().trim()

  console.log('📝 Signup Request:', {
    restaurantName,
    ownerEmail,
    ownerPhone,
    timestamp: new Date().toISOString()
  })

  // Validation
  if (!restaurantName || !ownerName || !ownerPhone || !ownerEmail || !password || !address || !city || !state || !pincode) {
    return res.status(400).json({
      success: false, 
      error: 'Missing required fields' 
    })
  }

  if (!validateEmail(ownerEmail)) {
    return res.status(400).json({
      success: false, 
      error: 'Invalid email format' 
    })
  }

  if (!validatePhone(ownerPhone)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid phone number' 
    })
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ 
      success: false, 
      error: 'Passwords do not match' 
    })
  }

  if (password.length < 8) {
    return res.status(400).json({ 
      success: false, 
      error: 'Password must be at least 8 characters' 
    })
  }

  // Validate phone uniqueness
  const phoneCheck = await pool.query(
    'SELECT id FROM restaurant_users WHERE (phone = $1 OR email = $2)',
    [ownerPhone, ownerEmail]
  )
  
  if (phoneCheck.rows.length > 0) {
    return res.status(409).json({ 
      success: false, 
      error: 'Email or phone number already registered' 
    })
  }

  const client = await pool.connect()
  let createdSupabaseUserId = null
  try {
    await client.query('BEGIN')

    // Check if email already exists
    const emailCheck = await client.query(
      'SELECT id FROM restaurant_users WHERE email = $1',
      [ownerEmail]
    )
    
    if (emailCheck.rows.length > 0) {
      await client.query('ROLLBACK')
      return res.status(409).json({ 
        success: false, 
        error: 'Email already registered' 
      })
    }

    // Check if phone already exists
    const phoneCheckRes = await client.query(
      'SELECT id FROM restaurant_users WHERE phone = $1',
      [ownerPhone]
    )
    
    if (phoneCheckRes.rows.length > 0) {
      await client.query('ROLLBACK')
      return res.status(409).json({ 
        success: false, 
        error: 'Phone number already registered' 
      })
    }

    // Check if restaurant name already exists
    const restCheck = await client.query(
      'SELECT id FROM restaurants WHERE name = $1',
      [restaurantName]
    )
    
    if (restCheck.rows.length > 0) {
      await client.query('ROLLBACK')
      return res.status(409).json({ 
        success: false, 
        error: 'Restaurant name already exists' 
      })
    }

    const authSignup = await createRestaurantSupabaseAuthUser({
      email: ownerEmail,
      password,
      restaurantName,
      ownerName,
      ownerPhone,
    })

    createdSupabaseUserId = authSignup.userId

    console.log('Restaurant signup auth step completed', {
      email: ownerEmail,
      authProvider: authSignup.provider,
      supabaseUserId: authSignup.userId,
      hasSupabaseSession: authSignup.hasSession,
      emailConfirmationRequired: authSignup.emailConfirmationRequired,
    })

    // Create restaurant
    const restaurantResult = await client.query(
      `INSERT INTO restaurants 
       (name, image, logo, delivery_time, price_for_one, cuisines, is_open, status, category, veg_non_veg, opening_time, closing_time, delivery_radius_km, latitude, longitude, address, city, state, pincode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING id`,
      [
        restaurantName,
        '', // placeholder image
        '', // placeholder logo
        35, // delivery time in minutes
        200, // placeholder price
        [category || 'multi-cuisine'], // cuisines as array
        false, // not open until approved
        'PENDING_APPROVAL',
        category || 'multi-cuisine',
        vegNonVeg || 'both',
        openingTime || '10:00',
        closingTime || '22:00',
        parseFloat(deliveryRadius) || 5,
        latitude && latitude !== '0' ? parseFloat(latitude) : null,
        longitude && longitude !== '0' ? parseFloat(longitude) : null,
        address,
        city,
        state,
        pincode
      ]
    )

    const restaurantId = restaurantResult.rows[0].id

    // Create restaurant details
    await client.query(
      `INSERT INTO restaurant_details 
       (restaurant_id, owner_name, owner_phone, owner_email, gst_number, fssai_license, latitude, longitude, address, city, state, pincode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [restaurantId, ownerName, ownerPhone, ownerEmail, gstNumber || null, fssaiLicense || null, latitude && latitude !== '0' ? parseFloat(latitude) : null, longitude && longitude !== '0' ? parseFloat(longitude) : null, address, city, state, pincode]
    )

    // Create approval request
    await client.query(
      `INSERT INTO restaurant_approvals 
       (restaurant_id, owner_name, owner_phone, owner_email, gst_number, fssai_license, restaurant_image, address_full, latitude, longitude, status, category, veg_non_veg, opening_time, closing_time, delivery_radius_km)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [restaurantId, ownerName, ownerPhone, ownerEmail, gstNumber || null, fssaiLicense || null, '', address, latitude && latitude !== '0' ? parseFloat(latitude) : null, longitude && longitude !== '0' ? parseFloat(longitude) : null, 'PENDING', category, vegNonVeg, openingTime, closingTime, parseFloat(deliveryRadius) || 5]
    )

    // Hash password with bcrypt (10 salt rounds for production)
    console.log('🔐 Hashing password...', {
      passwordLength: password.length,
      saltRounds: BCRYPT_ROUNDS,
      email: ownerEmail
    })
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS)
    console.log('✅ Password hashed successfully', {
      hashedPasswordLength: hashedPassword.length,
      hashPrefix: hashedPassword.substring(0, 15),
      email: ownerEmail
    })

    // Create restaurant user only after Supabase Auth signup succeeds.
    const userResult = await client.query(
      `INSERT INTO restaurant_users 
       (supabase_user_id, restaurant_id, email, password_hash, full_name, phone, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, password_hash`,
      [authSignup.userId, restaurantId, ownerEmail, hashedPassword, ownerName, ownerPhone, 'restaurant_owner', true]
    )
    
    const createdUser = userResult.rows[0]
    console.log('✅ Restaurant user created:', {
      userId: createdUser.id,
      email: ownerEmail,
      restaurantId,
      supabaseUserId: authSignup.userId,
      authProvider: authSignup.provider,
      passwordHashLength: hashedPassword.length,
      isActive: true
    })

    // Log approval history
    await client.query(
      `INSERT INTO restaurant_approval_history (restaurant_id, action, notes)
       VALUES ($1, $2, $3)`,
      [restaurantId, 'SUBMITTED', 'Restaurant signup completed']
    )

    await client.query('COMMIT')

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Your restaurant is under review.',
      restaurantId,
      status: 'PENDING_APPROVAL',
      nextStep: authSignup.emailConfirmationRequired
        ? 'Verify your email and wait for admin approval'
        : 'Wait for admin approval',
      auth: {
        provider: authSignup.provider,
        userId: authSignup.userId,
        emailConfirmationRequired: authSignup.emailConfirmationRequired,
      }
    })

  } catch (error) {
    await client.query('ROLLBACK')
    await cleanupSupabaseAuthUser(createdSupabaseUserId || error.supabaseUserId, ownerEmail)
    console.error('❌ Restaurant registration error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      requestBody: {
        restaurantName,
        ownerName,
        ownerPhone: '***',
        ownerEmail,
        address,
        city,
        state,
        pincode
      }
    })
    
    // Return meaningful error to frontend
    return res.status(error.status || 400).json({
      success: false,
      error: error.detail || error.message || 'Registration failed. Please check your details and try again.',
      code: error.code
    })
  } finally {
    client.release()
  }
}))

// ============================================================
// LOGIN RESTAURANT
// ============================================================
router.post('/login', asyncHandler(async (req, res) => {
  const { email: rawEmail, password } = req.body

  if (!rawEmail || !password) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email and password required' 
    })
  }

  // Normalize email to lowercase and trim
  const email = rawEmail.toLowerCase().trim()

  const session = await restaurantPanelAuthService.loginRestaurantOwner({ email, password })

  return res.json({
    success: true,
    message: 'Login successful',
    token: session.token,
    authProvider: session.authProvider,
    owner: {
      id: session.owner.id,
      restaurantId: session.owner.restaurant.id,
      email: session.owner.email,
      full_name: session.owner.full_name,
    }
  })

  console.log('🔐 Login Attempt:', {
    email,
    passwordLength: password.length,
    timestamp: new Date().toISOString()
  })

  // Find restaurant user
  const userResult = await pool.query(
    `SELECT ru.*, r.id as restaurant_id, r.status as restaurant_status
     FROM restaurant_users ru
     JOIN restaurants r ON r.id = ru.restaurant_id
     WHERE ru.email = $1`,
    [email]
  )

  if (userResult.rows.length === 0) {
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid credentials' 
    })
  }

  const user = userResult.rows[0]

  // Check if restaurant is approved
  if (user.restaurant_status === 'PENDING_APPROVAL') {
    return res.status(403).json({ 
      success: false, 
      error: 'Restaurant pending admin approval. Please wait.',
      status: 'PENDING_APPROVAL'
    })
  }

  if (user.restaurant_status === 'REJECTED' || user.restaurant_status === 'SUSPENDED') {
    return res.status(403).json({ 
      success: false, 
      error: `Restaurant status: ${user.restaurant_status}`,
      status: user.restaurant_status
    })
  }

  // Verify password
  console.log('🔍 Login attempt:', {
    email,
    userFound: true,
    restaurantStatus: user.restaurant_status,
    passwordHashExists: !!user.password_hash,
    passwordHashLength: user.password_hash?.length,
    passwordHashPrefix: user.password_hash?.substring(0, 15)
  })
  
  const isPasswordValid = await bcrypt.compare(password, user.password_hash)
  
  console.log('🔐 Password verification result:', {
    email,
    userId: user.id,
    isPasswordValid,
    passwordLength: password.length,
    hashLength: user.password_hash?.length,
    hashAlgorithm: user.password_hash?.startsWith('$2') ? 'bcrypt' : 'unknown'
  })
  
  if (!isPasswordValid) {
    console.error('❌ Login failed - Invalid password:', {
      email,
      userId: user.id,
      hashPrefix: user.password_hash?.substring(0, 20),
      timestamp: new Date().toISOString()
    })
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid credentials' 
    })
  }
  
  console.log('✅ Password verified:', { email, userId: user.id })

  // Update last login
  await pool.query(
    'UPDATE restaurant_users SET last_login_at = NOW() WHERE id = $1',
    [user.id]
  )

  // Generate JWT
  const token = signRestaurantToken({
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    restaurant_id: user.restaurant_id,
  })

  console.log('✅ Login successful - Token generated:', {
    email,
    userId: user.id,
    restaurantId: user.restaurant_id,
    tokenLength: token.length,
    tokenPrefix: token.substring(0, 20) + '...',
    timestamp: new Date().toISOString()
  })

  return res.json({
    success: true,
    message: 'Login successful',
    token,
    owner: {
      id: user.id,
      restaurantId: user.restaurant_id,
      email: user.email,
      full_name: user.full_name,
    }
  })
}))

// ============================================================
// GET RESTAURANT PROFILE
// ============================================================
router.get('/profile', authenticateRestaurant, asyncHandler(async (req, res) => {
  const { restaurantId } = req.restaurant

  const result = await pool.query(
    `SELECT r.*, ru.full_name as owner_name, ru.email, rd.gst_number, rd.fssai_license
     FROM restaurants r
     JOIN restaurant_users ru ON ru.restaurant_id = r.id
     LEFT JOIN restaurant_details rd ON rd.restaurant_id = r.id
     WHERE r.id = $1`,
    [restaurantId]
  )

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Restaurant not found' })
  }

  return res.json({ success: true, restaurant: result.rows[0] })
}))

// ============================================================
// UPDATE RESTAURANT STATUS
// ============================================================
router.post('/status/update', authenticateRestaurant, asyncHandler(async (req, res) => {
  const { restaurantId } = req.restaurant
  const { status, reason } = req.body

  const validStatuses = ['OPEN', 'TEMPORARILY_UNAVAILABLE', 'CLOSED']
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ 
      success: false, 
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
    })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Update restaurant status
    await client.query(
      'UPDATE restaurants SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, restaurantId]
    )

    // Log status change
    await client.query(
      `INSERT INTO restaurant_status_logs (restaurant_id, status, changed_by, reason)
       VALUES ($1, $2, $3, $4)`,
      [restaurantId, status, req.restaurant.restaurantUserId, reason || null]
    )

    await client.query('COMMIT')

    // Emit socket event
    const io = req.app.get('io')
    if (io) {
      io.to(`restaurant:${restaurantId}`).emit('restaurantStatusUpdated', {
        restaurantId,
        status,
        timestamp: new Date()
      })
      
      // Also broadcast to admin channel
      io.to('admin:global').emit('restaurantStatusUpdated', {
        restaurantId,
        status,
        timestamp: new Date()
      })
    }

    return res.json({
      success: true,
      message: 'Status updated successfully',
      status
    })

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}))

// ============================================================
// GET RESTAURANT STATUS
// ============================================================
router.get('/status/:restaurantId', asyncHandler(async (req, res) => {
  const { restaurantId } = req.params

  const result = await pool.query(
    'SELECT id, name, status FROM restaurants WHERE id = $1',
    [restaurantId]
  )

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Restaurant not found' })
  }

  return res.json({ 
    success: true, 
    restaurant: result.rows[0] 
  })
}))

// ============================================================
// LOGOUT
// ============================================================
router.post('/logout', authenticateRestaurant, (req, res) => {
  // Token is invalidated by client
  // Server doesn't maintain session state
  return res.json({ 
    success: true, 
    message: 'Logged out successfully' 
  })
})

// ============================================================
// PASSWORD RESET - REQUEST
// ============================================================
router.post('/password-reset/request', asyncHandler(async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email is required' 
    })
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid email format' 
    })
  }

  const passwordResetService = require('../modules/restaurantPanel/services/passwordResetService')
  
  try {
    const result = await passwordResetService.requestPasswordReset(email)
    
    // Only return reset token in development
    if (process.env.NODE_ENV === 'development') {
      return res.json(result)
    }
    
    // In production, only return success message
    return res.json({
      success: result.success,
      message: result.message,
      email: result.email
    })
  } catch (error) {
    console.error('Password reset request error:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to process password reset request' 
    })
  }
}))

// ============================================================
// PASSWORD RESET - VERIFY TOKEN
// ============================================================
router.get('/password-reset/verify', asyncHandler(async (req, res) => {
  const { token } = req.query

  if (!token) {
    return res.status(400).json({ 
      success: false, 
      error: 'Reset token is required' 
    })
  }

  const passwordResetService = require('../modules/restaurantPanel/services/passwordResetService')
  
  try {
    const user = await passwordResetService.verifyResetToken(token)
    
    return res.json({
      success: true,
      valid: true,
      message: 'Token is valid',
      email: user.email,
      fullName: user.fullName
    })
  } catch (error) {
    console.error('Token verification error:', error)
    return res.status(error.status || 400).json({ 
      success: false, 
      error: error.message || 'Invalid or expired token' 
    })
  }
}))

router.get('/password-reset/verify/:token', asyncHandler(async (req, res) => {
  const { token } = req.params

  if (!token) {
    return res.status(400).json({ 
      success: false, 
      error: 'Reset token is required' 
    })
  }

  const passwordResetService = require('../modules/restaurantPanel/services/passwordResetService')
  
  try {
    const user = await passwordResetService.verifyResetToken(token)
    
    return res.json({
      success: true,
      valid: true,
      message: 'Token is valid',
      email: user.email,
      fullName: user.fullName
    })
  } catch (error) {
    console.error('Token verification error:', error)
    return res.status(error.status || 400).json({ 
      success: false, 
      error: error.message || 'Invalid or expired token' 
    })
  }
}))

// ============================================================
// PASSWORD RESET - CONFIRM
// ============================================================
router.post('/password-reset/confirm', asyncHandler(async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body

  if (!token) {
    return res.status(400).json({ 
      success: false, 
      error: 'Reset token is required' 
    })
  }

  if (!newPassword) {
    return res.status(400).json({ 
      success: false, 
      error: 'New password is required' 
    })
  }

  const passwordResetService = require('../modules/restaurantPanel/services/passwordResetService')
  
  try {
    const result = await passwordResetService.resetPassword(token, newPassword, confirmPassword)
    
    return res.json(result)
  } catch (error) {
    console.error('Password reset confirmation error:', error)
    return res.status(error.status || 400).json({ 
      success: false, 
      error: error.message || 'Failed to reset password' 
    })
  }
}))

module.exports = router
