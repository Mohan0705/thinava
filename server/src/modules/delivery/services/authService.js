const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pool = require('../../../database/connection')

const getDeliveryJwtSecret = () => process.env.DELIVERY_JWT_SECRET || 'delivery-secret-key'

const generateToken = (partner) =>
  jwt.sign(
    {
      id: partner.id,
      email: partner.email,
      phone: partner.phone,
      full_name: partner.full_name,
    },
    getDeliveryJwtSecret(),
    { expiresIn: '7d' }
  )

const registerDeliveryPartner = async (
  fullName,
  phone,
  email,
  password,
  vehicleType,
  vehicleNumber
) => {
  const existingPartner = await pool.query(
    'SELECT id FROM delivery_partners WHERE phone = $1 OR email = $2',
    [phone, email]
  )

  if (existingPartner.rows.length > 0) {
    const error = new Error('Phone number or email already registered')
    error.status = 400
    throw error
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const result = await pool.query(
    `INSERT INTO delivery_partners (
       full_name,
       phone,
       email,
       password_hash,
       vehicle_type,
       vehicle_number,
       is_active,
       approval_status,
       document_status,
       vehicle_verification_status
     )
     VALUES ($1, $2, $3, $4, $5, $6, TRUE, 'pending', 'pending', 'pending')
     RETURNING id, full_name, phone, email, created_at, approval_status`,
    [fullName, phone, email, passwordHash, vehicleType, vehicleNumber]
  )

  const partner = result.rows[0]

  return {
    requires_approval: true,
    approval_status: partner.approval_status,
    partner: {
      id: partner.id,
      full_name: partner.full_name,
      phone: partner.phone,
      email: partner.email,
      created_at: partner.created_at,
      approval_status: partner.approval_status,
    },
  }
}

const loginDeliveryPartner = async (phone, password) => {
  const result = await pool.query(
    `SELECT
       id,
       full_name,
       phone,
       email,
       password_hash,
       approval_status,
       is_suspended
     FROM delivery_partners
     WHERE phone = $1`,
    [phone]
  )

  if (result.rows.length === 0) {
    const error = new Error('Delivery partner not found')
    error.status = 404
    throw error
  }

  const partner = result.rows[0]
  const isPasswordValid = await bcrypt.compare(password, partner.password_hash)

  if (!isPasswordValid) {
    const error = new Error('Invalid password')
    error.status = 401
    throw error
  }

  if (partner.approval_status?.toLowerCase() !== 'approved') {
    const error = new Error(
      partner.approval_status?.toLowerCase() === 'rejected'
        ? 'Your rider account was rejected by Thinava admin.'
        : 'Your rider account is pending admin approval.'
    )
    error.status = 403
    throw error
  }

  if (partner.is_suspended) {
    const error = new Error('Your rider account is suspended. Please contact Thinava support.')
    error.status = 403
    throw error
  }

  const token = generateToken(partner)

  return {
    token,
    partner: {
      id: partner.id,
      full_name: partner.full_name,
      phone: partner.phone,
      email: partner.email,
    },
  }
}

const getDeliveryPartnerProfile = async (partnerId) => {
  const result = await pool.query(
    `SELECT
       id, full_name, phone, email, profile_image, vehicle_type, vehicle_number,
       driving_license, is_online, is_active, rating, total_deliveries, current_status,
       current_order_id, acceptance_rate, cancellation_rate, online_minutes_today,
       cash_in_hand, bank_account_name, bank_account_number, bank_ifsc_code, upi_id,
       approval_status, is_suspended, force_offline, created_at, updated_at,
       COALESCE(average_rating, 0) AS average_rating,
       rating_count, rating_sum
     FROM delivery_partners
     WHERE id = $1`,
    [partnerId]
  )

  if (result.rows.length === 0) {
    const error = new Error('Delivery partner not found')
    error.status = 404
    throw error
  }

  return result.rows[0]
}

const updateDeliveryPartnerStatus = async (partnerId, status) => {
  const result = await pool.query(
    `UPDATE delivery_partners
     SET current_status = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING id, current_status, is_online`,
    [status, partnerId]
  )

  if (result.rows.length === 0) {
    const error = new Error('Delivery partner not found')
    error.status = 404
    throw error
  }

  return result.rows[0]
}

const setDeliveryPartnerOnlineStatus = async (partnerId, isOnline) => {
  const partnerResult = await pool.query(
    `SELECT id, current_order_id, force_offline, is_suspended
     FROM delivery_partners
     WHERE id = $1`,
    [partnerId]
  )

  if (partnerResult.rows.length === 0) {
    const error = new Error('Delivery partner not found')
    error.status = 404
    throw error
  }

  const partner = partnerResult.rows[0]

  if (!isOnline && partner.current_order_id) {
    const error = new Error('Complete active order before going offline.')
    error.status = 400
    throw error
  }

  if (isOnline && partner.force_offline) {
    const error = new Error('Admin has temporarily forced this rider offline.')
    error.status = 403
    throw error
  }

  if (partner.is_suspended) {
    const error = new Error('Suspended riders cannot change online status.')
    error.status = 403
    throw error
  }

  const result = await pool.query(
    `UPDATE delivery_partners
     SET is_online = $1,
         current_status = CASE
           WHEN $1 = TRUE AND current_order_id IS NULL THEN 'AVAILABLE'
           WHEN $1 = FALSE AND current_order_id IS NULL THEN 'OFFLINE'
           ELSE current_status
         END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING id, is_online, current_status`,
    [isOnline, partnerId]
  )

  if (result.rows.length === 0) {
    const error = new Error('Delivery partner not found')
    error.status = 404
    throw error
  }

  return result.rows[0]
}

const refreshDeliveryPartnerSession = async (token) => {
  if (!token) {
    const error = new Error('Delivery session token is required')
    error.status = 401
    throw error
  }

  let decoded
  try {
    decoded = jwt.verify(token, getDeliveryJwtSecret(), { ignoreExpiration: true })
  } catch {
    const error = new Error('Invalid or expired token')
    error.status = 401
    throw error
  }

  const partner = await getDeliveryPartnerProfile(decoded.id)

  if (partner.approval_status?.toLowerCase() !== 'approved' || partner.is_suspended) {
    const error = new Error('Delivery partner session is no longer active')
    error.status = 401
    throw error
  }

  return {
    token: generateToken(partner),
    partner,
  }
}

module.exports = {
  registerDeliveryPartner,
  loginDeliveryPartner,
  getDeliveryPartnerProfile,
  updateDeliveryPartnerStatus,
  setDeliveryPartnerOnlineStatus,
  generateToken,
  getDeliveryJwtSecret,
  refreshDeliveryPartnerSession,
}
