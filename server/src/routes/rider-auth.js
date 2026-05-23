/**
 * THINAVA Rider/Delivery Partner Authentication Routes
 * Combined Signup/Login flow for delivery partners
 * 
 * Endpoints:
 * - POST /api/rider-auth/register
 * - POST /api/rider-auth/login
 * - GET /api/rider-auth/profile
 * - POST /api/rider-auth/logout
 * - POST /api/rider-auth/update-location
 */

const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const pool = require('../database/connection')
const { signRiderToken, verifyRiderToken } = require('../lib/auth/tokenService')

// Validation helpers
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

const validatePhone = (phone) => {
  const re = /^[0-9]{10}$/
  return re.test(phone.replace(/\D/g, ''))
}

// Error handler
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

const { logger } = require('../lib/logger')

// Middleware: Authenticate rider
const authenticateRider = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  
  if (!token) {
    logger.warn('Rider auth: no token provided', { tag: 'auth', requestId: req?.id })
    return res.status(401).json({ success: false, error: 'No token provided', code: 'NO_TOKEN' })
  }
  
  try {
    const decoded = verifyRiderToken(token)
    req.rider = {
      id: decoded.sub,
      phone: decoded.phone,
      fullName: decoded.fullName,
    }
    logger.debug('Rider authenticated', { tag: 'auth', riderId: decoded.sub, requestId: req?.id })
    next()
  } catch (error) {
    logger.warn('Rider auth failed', { tag: 'auth', error: error.message, requestId: req?.id })
    res.status(401).json({ success: false, error: 'Invalid or expired token', code: 'INVALID_TOKEN' })
  }
}

// ============================================================
// REGISTER NEW RIDER
// ============================================================
router.post('/register', asyncHandler(async (req, res) => {
  const {
    fullName,
    phone,
    email,
    password,
    confirmPassword,
    vehicleType, // BIKE, SCOOTER, CYCLE
    vehicleNumber,
    aadharNumber,
    drivingLicenseNumber,
    zone
  } = req.body

  // Validation
  if (!fullName || !phone || !password) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields'
    })
  }

  if (!validatePhone(phone)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid phone number (must be 10 digits)'
    })
  }

  if (email && !validateEmail(email)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email format'
    })
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      error: 'Passwords do not match'
    })
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'Password must be at least 6 characters'
    })
  }

  const validVehicleTypes = ['BIKE', 'SCOOTER', 'CYCLE']
  if (!validVehicleTypes.includes(vehicleType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid vehicle type. Must be one of: ${validVehicleTypes.join(', ')}`
    })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Check if phone already registered
    const phoneCheck = await client.query(
      'SELECT id FROM delivery_partners WHERE phone = $1',
      [phone]
    )

    if (phoneCheck.rows.length > 0) {
      await client.query('ROLLBACK')
      return res.status(409).json({
        success: false,
        error: 'Phone number already registered'
      })
    }

    // Check if email already registered
    if (email) {
      const emailCheck = await client.query(
        'SELECT id FROM delivery_partners WHERE email = $1',
        [email]
      )

      if (emailCheck.rows.length > 0) {
        await client.query('ROLLBACK')
        return res.status(409).json({
          success: false,
          error: 'Email already registered'
        })
      }
    }

    // Check if vehicle number already registered
    const vehicleCheck = await client.query(
      'SELECT id FROM rider_details WHERE vehicle_number = $1',
      [vehicleNumber]
    )

    if (vehicleCheck.rows.length > 0) {
      await client.query('ROLLBACK')
      return res.status(409).json({
        success: false,
        error: 'Vehicle number already registered'
      })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create delivery partner
    const riderResult = await client.query(
      `INSERT INTO delivery_partners 
       (phone, email, full_name, password_hash, status, approval_status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [phone, email || null, fullName, hashedPassword, 'PENDING', 'PENDING']
    )

    const riderId = riderResult.rows[0].id

    // Create rider details
    await client.query(
      `INSERT INTO rider_details (delivery_partner_id, vehicle_type, vehicle_number, zone)
       VALUES ($1, $2, $3, $4)`,
      [riderId, vehicleType, vehicleNumber, zone || 'General']
    )

    // Log approval (best-effort after commit)
await pool.query(
  `INSERT INTO rider_approval_logs (delivery_partner_id, action, reason)
   VALUES ($1, $2, $3)`,
  [riderId, 'SUBMITTED', 'Rider signup completed']
);

    await client.query('COMMIT')

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Awaiting admin approval.',
      riderId,
      status: 'PENDING',
      nextStep: 'Wait for admin approval before you can login'
    })

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}))

// ============================================================
// LOGIN RIDER
// ============================================================
router.post('/login', asyncHandler(async (req, res) => {
  const { phone, password } = req.body

  if (!phone || !password) {
    return res.status(400).json({
      success: false,
      error: 'Phone and password required'
    })
  }

  // Find delivery partner
  const riderResult = await pool.query(
    `SELECT * FROM delivery_partners WHERE phone = $1`,
    [phone]
  )

  if (riderResult.rows.length === 0) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    })
  }

  const rider = riderResult.rows[0]

  // Check if approved (case-insensitive to handle legacy data)
  if (rider.approval_status?.toUpperCase() !== 'APPROVED') {
    return res.status(403).json({
      success: false,
      error: 'Your rider account is pending admin approval.',
      status: rider.approval_status
    })
  }

  // Check if suspended
  if (rider.status === 'SUSPENDED') {
    return res.status(403).json({
      success: false,
      error: 'Account suspended by admin',
      status: 'SUSPENDED'
    })
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, rider.password_hash)

  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    })
  }

  // Update last active
  await pool.query(
    'UPDATE delivery_partners SET last_active_at = NOW() WHERE id = $1',
    [rider.id]
  )

  // Generate JWT
  const token = signRiderToken({
    id: rider.id,
    phone: rider.phone,
    email: rider.email,
    full_name: rider.full_name,
  })

  return res.json({
    success: true,
    message: 'Login successful',
    token,
    partner: {
      id: rider.id,
      phone: rider.phone,
      full_name: rider.full_name,
      is_online: rider.is_online,
      has_active_order: rider.has_active_order,
      rating: 0,
      total_deliveries: 0,
    }
  })
}))

// ============================================================
// GET RIDER PROFILE
// ============================================================
router.get('/profile', authenticateRider, asyncHandler(async (req, res) => {
  const { id: riderId } = req.rider

  const result = await pool.query(
    `SELECT dp.*, rd.vehicle_type, rd.vehicle_number, rd.zone, rd.total_deliveries,
            COALESCE(dp.average_rating,
              CASE WHEN dp.rating_count > 0
                THEN (dp.rating_sum / dp.rating_count)::decimal(3,2)
                ELSE 0
              END
            ) AS rating
     FROM delivery_partners dp
     LEFT JOIN rider_details rd ON rd.delivery_partner_id = dp.id
     WHERE dp.id = $1`,
    [riderId]
  )

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Rider not found' })
  }

  return res.json({
    success: true,
    profile: result.rows[0]
  })
}))

// ============================================================
// UPDATE RIDER ONLINE STATUS
// ============================================================
router.post('/online-status', authenticateRider, asyncHandler(async (req, res) => {
  const { id: riderId } = req.rider
  const { isOnline } = req.body

  // Check if rider has active order
  if (!isOnline) {
    const activeOrder = await pool.query(
      'SELECT id FROM active_delivery_sessions WHERE delivery_partner_id = $1 AND is_active = TRUE',
      [riderId]
    )

    if (activeOrder.rows.length > 0) {
      return res.status(403).json({
        success: false,
        error: 'Cannot go offline while delivery is in progress',
        hasActiveOrder: true
      })
    }
  }

  // Update status
  await pool.query(
    'UPDATE delivery_partners SET is_online = $1, last_active_at = NOW() WHERE id = $2',
    [isOnline, riderId]
  )

  // Emit socket event
  const io = req.app.get('io')
  if (io) {
    io.to(`delivery_partner:${riderId}`).emit('riderStatusUpdated', {
      riderId,
      isOnline,
      timestamp: new Date()
    })
  }

  return res.json({
    success: true,
    message: `Status updated: ${isOnline ? 'Online' : 'Offline'}`,
    isOnline
  })
}))

// ============================================================
// UPDATE RIDER LOCATION
// ============================================================
router.post('/location', authenticateRider, asyncHandler(async (req, res) => {
  const { id: riderId } = req.rider
  const { latitude, longitude, accuracy, speed, orderId } = req.body

  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      error: 'Latitude and longitude required'
    })
  }

  // Store location
  await pool.query(
    `INSERT INTO delivery_locations (delivery_partner_id, order_id, latitude, longitude, accuracy, speed)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [riderId, orderId || null, latitude, longitude, accuracy || null, speed || null]
  )

  // Update rider last active
  await pool.query(
    'UPDATE delivery_partners SET last_active_at = NOW() WHERE id = $1',
    [riderId]
  )

  // Emit socket event for real-time tracking
  const io = req.app.get('io')
  if (io) {
    io.emit('riderLocationUpdated', {
      riderId,
      orderId,
      latitude,
      longitude,
      accuracy,
      speed,
      timestamp: new Date()
    })

    // Also emit to order room
    if (orderId) {
      io.to(`order:${orderId}`).emit('riderLocationUpdated', {
        riderId,
        latitude,
        longitude,
        timestamp: new Date()
      })
    }
  }

  return res.json({
    success: true,
    message: 'Location updated'
  })
}))

// ============================================================
// LOGOUT
// ============================================================
router.post('/logout', authenticateRider, asyncHandler(async (req, res) => {
  const { id: riderId } = req.rider

  // Update status to offline
  await pool.query(
    'UPDATE delivery_partners SET is_online = FALSE WHERE id = $1',
    [riderId]
  )

  const io = req.app.get('io')
  if (io) {
    io.to(`delivery_partner:${riderId}`).emit('riderStatusUpdated', {
      riderId,
      isOnline: false,
      timestamp: new Date()
    })
  }

  return res.json({
    success: true,
    message: 'Logged out successfully'
  })
}))

module.exports = router
