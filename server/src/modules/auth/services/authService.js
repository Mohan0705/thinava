const pool = require('../../../database/connection')
const { signCustomerToken, verifyCustomerTokenIgnoreExp } = require('../../../lib/auth/tokenService')
const { sendOtp } = require('../../../lib/smsService')
const {
  INDIAN_COUNTRY_CODE,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  DEV_MODE,
  generateOtp,
} = require('../constants')

const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '').slice(-10)

const formatPhone = (phone, countryCode = INDIAN_COUNTRY_CODE) => `${countryCode}${normalizePhone(phone)}`

const createCustomerToken = (user) => signCustomerToken(user)

const verifyCustomerRefreshToken = (token) => {
  if (!token) {
    const error = new Error('Customer session token is required')
    error.status = 401
    throw error
  }

  try {
    return verifyCustomerTokenIgnoreExp(token)
  } catch {
    const error = new Error('Invalid or expired customer token')
    error.status = 401
    throw error
  }
}

const mapAddress = (row) => ({
  id: row.id,
  user_id: row.user_id,
  label: row.label,
  address_type: row.address_type,
  address: row.address,
  full_address: row.address,
  landmark: row.landmark,
  latitude: row.latitude !== null ? Number(row.latitude) : null,
  longitude: row.longitude !== null ? Number(row.longitude) : null,
  is_default: Boolean(row.is_default),
  receiver_name: row.receiver_name,
  receiver_phone: row.receiver_phone,
  use_account_details: Boolean(row.use_account_details ?? true),
  legacy_address_id: row.legacy_address_id,
  created_at: row.created_at,
  updated_at: row.updated_at,
})

const mapUser = (row, addresses = []) => ({
  id: row.id,
  name: row.name || row.full_name,
  full_name: row.full_name || row.name,
  phone: row.phone,
  email: row.email,
  profile_image: row.profile_image,
  is_verified: Boolean(row.is_verified),
  created_at: row.created_at,
  updated_at: row.updated_at,
  last_login: row.last_login,
  addresses,
})

const normalizeAddressType = (value, fallback = 'Other') => {
  const normalized = String(value || fallback).trim().toLowerCase()
  if (normalized === 'home') return 'Home'
  if (normalized === 'office' || normalized === 'work') return 'Office'
  return 'Other'
}

const getUserAddresses = async (userId) => {
  const result = await pool.query(
    `SELECT id, user_id, label, address_type, address, landmark, latitude, longitude, is_default, receiver_name, receiver_phone, use_account_details, legacy_address_id, created_at, updated_at
     FROM user_addresses
     WHERE user_id = $1
     ORDER BY is_default DESC, updated_at DESC, created_at DESC`,
    [userId]
  )

  return result.rows.map(mapAddress)
}

const getCustomerProfile = async (userId) => {
  const userResult = await pool.query(
    `SELECT id, name, full_name, phone, email, profile_image, is_verified, created_at, updated_at, last_login
     FROM users
     WHERE id = $1`,
    [userId]
  )

  if (userResult.rows.length === 0) {
    const error = new Error('Customer not found')
    error.status = 404
    throw error
  }

  const addresses = await getUserAddresses(userId)
  const profile = mapUser(userResult.rows[0], addresses)

  const statsResult = await pool.query(
    `SELECT COUNT(*)::int AS total_orders,
            COALESCE(SUM(total), 0)::numeric AS total_spent,
            MAX(created_at) AS last_order_at
     FROM orders
     WHERE user_id = $1`,
    [userId]
  )

  return {
    user: profile,
    stats: {
      total_orders: statsResult.rows[0].total_orders,
      total_spent: Number(statsResult.rows[0].total_spent || 0),
      last_order_at: statsResult.rows[0].last_order_at,
    },
  }
}

const refreshCustomerSession = async (token) => {
  const decoded = verifyCustomerRefreshToken(token)
  const profile = await getCustomerProfile(decoded.sub)

  return {
    token: createCustomerToken(profile.user),
    user: profile.user,
    stats: profile.stats,
  }
}

const requestOtp = async ({ phone, countryCode = INDIAN_COUNTRY_CODE, fullName = null, email = null, purpose = 'login' }) => {
  const normalizedPhone = normalizePhone(phone)

  const recentSessionResult = await pool.query(
    `SELECT id,
            resend_available_at,
            GREATEST(0, CEIL(EXTRACT(EPOCH FROM (resend_available_at - CURRENT_TIMESTAMP))))::int AS remaining_seconds
     FROM customer_otp_sessions
     WHERE phone = $1
       AND country_code = $2
       AND is_consumed = FALSE
       AND expires_at > CURRENT_TIMESTAMP
       AND resend_available_at > CURRENT_TIMESTAMP
     ORDER BY created_at DESC
     LIMIT 1`,
    [normalizedPhone, countryCode]
  )

  const activeSession = recentSessionResult.rows[0]
  if (activeSession) {
    const remainingSeconds = Number(activeSession.remaining_seconds || 0)
    const error = new Error(`Please wait ${remainingSeconds}s before requesting another OTP`)
    error.status = 429
    throw error
  }

  await pool.query(
    `UPDATE customer_otp_sessions
     SET is_consumed = TRUE, updated_at = CURRENT_TIMESTAMP
     WHERE phone = $1
       AND country_code = $2
       AND is_consumed = FALSE`,
    [normalizedPhone, countryCode]
  )

  const otpCode = generateOtp()
  
  console.log('[OTP GENERATED]', otpCode)
  console.log('[DEV_MODE]', DEV_MODE)

  const result = await pool.query(
    `INSERT INTO customer_otp_sessions (
       phone, country_code, otp_code, full_name, email, purpose, expires_at, resend_available_at
     )
     VALUES (
       $1,
       $2,
       $3,
       $4,
       $5,
       $6,
       CURRENT_TIMESTAMP + ($7 || ' minutes')::interval,
       CURRENT_TIMESTAMP + ($8 || ' seconds')::interval
     )
     RETURNING id,
               expires_at,
               resend_available_at`,
    [
      normalizedPhone,
      countryCode,
      otpCode,
      fullName,
      email,
      purpose,
      String(OTP_EXPIRY_MINUTES),
      String(OTP_RESEND_COOLDOWN_SECONDS),
    ]
  )

  const verification_id = result.rows[0].id

  sendOtp({ phone: normalizedPhone, otp: otpCode, countryCode })

  return {
    verification_id,
    phone: formatPhone(normalizedPhone, countryCode),
    expires_at: result.rows[0].expires_at,
    resend_available_at: result.rows[0].resend_available_at,
    ...(DEV_MODE ? { helper_otp: otpCode } : {}),
  }
}

const verifyOtp = async ({ verificationId, phone, countryCode = INDIAN_COUNTRY_CODE, otp, fullName = null, email = null }) => {
  const normalizedPhone = normalizePhone(phone)
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const otpSessionResult = await client.query(
      `SELECT id,
              phone,
              country_code,
              otp_code,
              full_name,
              email,
              expires_at,
              attempt_count,
              is_consumed,
              expires_at <= CURRENT_TIMESTAMP AS is_expired
       FROM customer_otp_sessions
       WHERE id = $1
       FOR UPDATE`,
      [verificationId]
    )

    if (otpSessionResult.rows.length === 0) {
      const error = new Error('OTP session not found')
      error.status = 404
      throw error
    }

    const otpSession = otpSessionResult.rows[0]

    if (otpSession.is_consumed) {
      const error = new Error('OTP session already used')
      error.status = 400
      throw error
    }

    if (otpSession.phone !== normalizedPhone || otpSession.country_code !== countryCode) {
      const error = new Error('OTP session does not match this phone number')
      error.status = 400
      throw error
    }

    if (otpSession.is_expired) {
      const error = new Error('OTP expired. Please request a new code.')
      error.status = 400
      throw error
    }

    if (otpSession.attempt_count >= OTP_MAX_ATTEMPTS) {
      const error = new Error('Too many incorrect OTP attempts')
      error.status = 429
      throw error
    }

    if (String(otp) !== String(otpSession.otp_code)) {
      await client.query(
        `UPDATE customer_otp_sessions
         SET attempt_count = attempt_count + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [verificationId]
      )
      const error = new Error('Invalid OTP')
      error.status = 400
      throw error
    }

    const userResult = await client.query(
      `SELECT id, name, full_name, phone, email, profile_image, is_verified, created_at, updated_at, last_login
       FROM users
       WHERE phone = $1`,
      [formatPhone(normalizedPhone, countryCode)]
    )

    const requestedFullName =
      (fullName && String(fullName).trim()) ||
      (otpSession.full_name && String(otpSession.full_name).trim()) ||
      ''
    const newUserFullName = requestedFullName || `Thinava User ${normalizedPhone.slice(-4)}`
    const resolvedEmail = (email && String(email).trim()) || otpSession.email || null

    let user
    if (userResult.rows.length === 0) {
      const newUserResult = await client.query(
        `INSERT INTO users (name, full_name, phone, email, is_verified, last_login, updated_at)
         VALUES ($1, $2, $3, $4, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, name, full_name, phone, email, profile_image, is_verified, created_at, updated_at, last_login`,
        [
          newUserFullName,
          newUserFullName,
          formatPhone(normalizedPhone, countryCode),
          resolvedEmail,
        ]
      )
      user = newUserResult.rows[0]
    } else {
      const updatedUserResult = await client.query(
        `UPDATE users
         SET full_name = COALESCE(NULLIF($2, ''), full_name, name),
             name = COALESCE(NULLIF(name, ''), NULLIF($2, ''), full_name),
             email = COALESCE($3, email),
             is_verified = TRUE,
             last_login = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, name, full_name, phone, email, profile_image, is_verified, created_at, updated_at, last_login`,
        [userResult.rows[0].id, requestedFullName, resolvedEmail]
      )
      user = updatedUserResult.rows[0]
    }

    await client.query(
      `UPDATE customer_otp_sessions
       SET is_consumed = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [verificationId]
    )

    await client.query('COMMIT')

    const addresses = await getUserAddresses(user.id)

    return {
      token: createCustomerToken(user),
      user: mapUser(user, addresses),
      is_new_user: userResult.rows.length === 0,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

const updateCustomerProfile = async (userId, payload) => {
  const fullName = String(payload.full_name || payload.name || '').trim()
  const email = payload.email ? String(payload.email).trim() : null
  const hasProfileImage = Object.prototype.hasOwnProperty.call(payload, 'profile_image')
  const profileImage = hasProfileImage && payload.profile_image ? String(payload.profile_image).trim() : null

  const result = await pool.query(
    `UPDATE users
     SET full_name = COALESCE(NULLIF($2, ''), full_name),
         name = COALESCE(NULLIF($2, ''), name),
         email = $3,
         profile_image = CASE WHEN $4::boolean THEN $5 ELSE profile_image END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id, name, full_name, phone, email, profile_image, is_verified, created_at, updated_at, last_login`,
    [userId, fullName, email, hasProfileImage, profileImage]
  )

  if (result.rows.length === 0) {
    const error = new Error('Customer not found')
    error.status = 404
    throw error
  }

  const addresses = await getUserAddresses(userId)
  return mapUser(result.rows[0], addresses)
}

const upsertAddress = async (userId, payload, addressId = null) => {
  const client = await pool.connect()
  const addressType = normalizeAddressType(payload.address_type, payload.label)
  const receiverName = payload.receiver_name ? String(payload.receiver_name).trim() : null
  const receiverPhone = payload.receiver_phone ? String(payload.receiver_phone).trim() : null
  const useAccountDetails = payload.use_account_details !== undefined ? Boolean(payload.use_account_details) : true

  try {
    await client.query('BEGIN')

    if (payload.is_default) {
      await client.query(
        `UPDATE user_addresses
         SET is_default = FALSE, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [userId]
      )
      await client.query(
        `UPDATE addresses
         SET is_default = FALSE, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [userId]
      )
    }

    let legacyAddressId = payload.legacy_address_id || null
    let userAddress

    if (addressId) {
      const existingResult = await client.query(
        `SELECT legacy_address_id
         FROM user_addresses
         WHERE id = $1 AND user_id = $2
         FOR UPDATE`,
        [addressId, userId]
      )

      if (existingResult.rows.length === 0) {
        const error = new Error('Address not found')
        error.status = 404
        throw error
      }

      legacyAddressId = existingResult.rows[0].legacy_address_id

      if (legacyAddressId) {
        await client.query(
          `UPDATE addresses
           SET label = $1,
               address_type = $2,
               full_address = $3,
               landmark = $4,
               latitude = $5,
               longitude = $6,
               is_default = $7,
               receiver_name = $8,
               receiver_phone = $9,
               use_account_details = $10,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $11`,
          [
            payload.label,
            addressType,
            payload.address,
            payload.landmark || null,
            payload.latitude ?? null,
            payload.longitude ?? null,
            Boolean(payload.is_default),
            receiverName,
            receiverPhone,
            useAccountDetails,
            legacyAddressId,
          ]
        )
      } else {
        const newLegacyAddress = await client.query(
          `INSERT INTO addresses (user_id, label, address_type, full_address, landmark, latitude, longitude, is_default, receiver_name, receiver_phone, use_account_details)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            userId,
            payload.label,
            addressType,
            payload.address,
            payload.landmark || null,
            payload.latitude ?? null,
            payload.longitude ?? null,
            Boolean(payload.is_default),
            receiverName,
            receiverPhone,
            useAccountDetails,
          ]
        )
        legacyAddressId = newLegacyAddress.rows[0].id
      }

      const updatedAddressResult = await client.query(
        `UPDATE user_addresses
         SET label = $1,
             address_type = $2,
             address = $3,
             landmark = $4,
             latitude = $5,
             longitude = $6,
             is_default = $7,
             receiver_name = $8,
             receiver_phone = $9,
             use_account_details = $10,
             legacy_address_id = $11,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $12 AND user_id = $13
         RETURNING *`,
        [
          payload.label,
          addressType,
          payload.address,
          payload.landmark || null,
          payload.latitude ?? null,
          payload.longitude ?? null,
          Boolean(payload.is_default),
          receiverName,
          receiverPhone,
          useAccountDetails,
          legacyAddressId,
          addressId,
          userId,
        ]
      )
      userAddress = updatedAddressResult.rows[0]
    } else {
      const newLegacyAddress = await client.query(
        `INSERT INTO addresses (user_id, label, address_type, full_address, landmark, latitude, longitude, is_default, receiver_name, receiver_phone, use_account_details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          userId,
          payload.label,
          addressType,
          payload.address,
          payload.landmark || null,
          payload.latitude ?? null,
          payload.longitude ?? null,
          Boolean(payload.is_default),
          receiverName,
          receiverPhone,
          useAccountDetails,
        ]
      )

      legacyAddressId = newLegacyAddress.rows[0].id

      const newUserAddress = await client.query(
        `INSERT INTO user_addresses (user_id, label, address_type, address, landmark, latitude, longitude, is_default, receiver_name, receiver_phone, use_account_details, legacy_address_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          userId,
          payload.label,
          addressType,
          payload.address,
          payload.landmark || null,
          payload.latitude ?? null,
          payload.longitude ?? null,
          Boolean(payload.is_default),
          receiverName,
          receiverPhone,
          useAccountDetails,
          legacyAddressId,
        ]
      )
      userAddress = newUserAddress.rows[0]
    }

    if (!payload.is_default) {
      const defaultCountResult = await client.query(
        `SELECT COUNT(*)::int AS default_count
         FROM user_addresses
         WHERE user_id = $1 AND is_default = TRUE`,
        [userId]
      )

      if (defaultCountResult.rows[0].default_count === 0) {
        await client.query(
          `UPDATE user_addresses
           SET is_default = TRUE, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [userAddress.id]
        )
        await client.query(
          `UPDATE addresses
           SET is_default = TRUE, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [legacyAddressId]
        )
        userAddress.is_default = true
      }
    }

    await client.query('COMMIT')
    return mapAddress(userAddress)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

const deleteAddress = async (userId, addressId) => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const addressResult = await client.query(
      `SELECT legacy_address_id, is_default
       FROM user_addresses
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [addressId, userId]
    )

    if (addressResult.rows.length === 0) {
      const error = new Error('Address not found')
      error.status = 404
      throw error
    }

    const address = addressResult.rows[0]

    await client.query('DELETE FROM user_addresses WHERE id = $1 AND user_id = $2', [addressId, userId])

    if (address.legacy_address_id) {
      await client.query('DELETE FROM addresses WHERE id = $1', [address.legacy_address_id])
    }

    if (address.is_default) {
      const nextAddress = await client.query(
        `SELECT id, legacy_address_id
         FROM user_addresses
         WHERE user_id = $1
         ORDER BY created_at ASC
         LIMIT 1`,
        [userId]
      )

      if (nextAddress.rows.length > 0) {
        await client.query(
          `UPDATE user_addresses
           SET is_default = TRUE, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [nextAddress.rows[0].id]
        )
        if (nextAddress.rows[0].legacy_address_id) {
          await client.query(
            `UPDATE addresses
             SET is_default = TRUE, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [nextAddress.rows[0].legacy_address_id]
          )
        }
      }
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = {
  normalizePhone,
  formatPhone,
  requestOtp,
  verifyOtp,
  refreshCustomerSession,
  getCustomerProfile,
  updateCustomerProfile,
  getUserAddresses,
  upsertAddress,
  deleteAddress,
}
