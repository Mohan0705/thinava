const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const pool = require('../../../database/connection')
const {
  ensureSupabaseUserForRestaurantOwner,
  updateSupabaseRestaurantPassword,
} = require('./supabaseRestaurantAuthService')

const RESET_TOKEN_EXPIRY_MINUTES = 15

function generateResetToken() {
  return crypto.randomBytes(32).toString('hex')
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}

function getFrontendResetUrl(token) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
  return `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`
}

function createResetError(message, status = 400, code) {
  const error = new Error(message)
  error.status = status
  if (code) {
    error.code = code
  }
  return error
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function requestPasswordReset(rawEmail) {
  const email = String(rawEmail || '').toLowerCase().trim()

  if (!email) {
    throw createResetError('Email is required', 400, 'EMAIL_REQUIRED')
  }

  if (!validateEmail(email)) {
    throw createResetError('Invalid email format', 400, 'INVALID_EMAIL')
  }

  console.log('[RestaurantPasswordReset] reset requested', { email })

  const userResult = await pool.query(
    `SELECT ru.id, ru.email, ru.full_name, ru.phone, ru.supabase_user_id, ru.restaurant_id,
            r.name AS restaurant_name
     FROM restaurant_users ru
     JOIN restaurants r ON r.id = ru.restaurant_id
     WHERE LOWER(ru.email) = LOWER($1)
     LIMIT 1`,
    [email]
  )

  if (userResult.rows.length === 0) {
    console.log('[RestaurantPasswordReset] reset requested for unknown email', { email })
    return {
      success: true,
      message: 'Password reset link generated',
    }
  }

  const owner = userResult.rows[0]
  try {
    const ensured = await ensureSupabaseUserForRestaurantOwner(owner)
    if (ensured.userId && ensured.userId !== owner.supabase_user_id) {
      await pool.query(
        `UPDATE restaurant_users
         SET supabase_user_id = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [ensured.userId, owner.id]
      )
      owner.supabase_user_id = ensured.userId
    }
  } catch (error) {
    console.warn('[RestaurantPasswordReset] auth repair failed before reset request', {
      email: owner.email,
      restaurantUserId: owner.id,
      message: error.message,
      code: error.code,
    })
    throw createResetError(
      'Password reset is temporarily unavailable. Please try again later.',
      error.status === 503 ? 503 : 502,
      'PASSWORD_RESET_UNAVAILABLE'
    )
  }

  const token = generateResetToken()
  const tokenHash = hashResetToken(token)
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000)

  await pool.query(
    `UPDATE restaurant_users
     SET reset_token = $1,
         reset_token_expiry = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [tokenHash, expiresAt, owner.id]
  )

  const resetUrl = getFrontendResetUrl(token)

  console.log('[RestaurantPasswordReset] token generated', {
    email: owner.email,
    restaurantUserId: owner.id,
    expiresAt: expiresAt.toISOString(),
  })
  if (process.env.NODE_ENV === 'development') {
    console.log('[RestaurantPasswordReset] development reset URL:', resetUrl)
  }

  return {
    success: true,
    message: 'Password reset link generated',
    ...(process.env.NODE_ENV === 'development' ? { resetUrl } : {}),
  }
}

async function verifyResetToken(token) {
  if (!token) {
    throw createResetError('Reset token is required', 400, 'RESET_TOKEN_REQUIRED')
  }

  const tokenHash = hashResetToken(token)

  const result = await pool.query(
    `SELECT ru.id, ru.email, ru.full_name, ru.phone, ru.supabase_user_id,
            ru.restaurant_id, ru.reset_token_expiry, r.name AS restaurant_name
     FROM restaurant_users ru
     JOIN restaurants r ON r.id = ru.restaurant_id
     WHERE reset_token = $1
     LIMIT 1`,
    [tokenHash]
  )

  if (result.rows.length === 0) {
    console.log('[RestaurantPasswordReset] token verification failed', { reason: 'not_found' })
    throw createResetError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN')
  }

  const owner = result.rows[0]

  if (!owner.reset_token_expiry || new Date(owner.reset_token_expiry) <= new Date()) {
    console.log('[RestaurantPasswordReset] token verification failed', {
      reason: 'expired',
      email: owner.email,
      restaurantUserId: owner.id,
      expiresAt: owner.reset_token_expiry,
    })
    throw createResetError('Reset token has expired. Please request a new one.', 400, 'RESET_TOKEN_EXPIRED')
  }

  console.log('[RestaurantPasswordReset] token verified', {
    email: owner.email,
    restaurantUserId: owner.id,
  })

  return {
    valid: true,
    userId: owner.id,
    email: owner.email,
    fullName: owner.full_name,
    phone: owner.phone,
    restaurantId: owner.restaurant_id,
    restaurantName: owner.restaurant_name,
    supabaseUserId: owner.supabase_user_id,
  }
}

async function resetPassword(token, newPassword, confirmPassword) {
  if (!newPassword) {
    throw createResetError('New password is required', 400, 'PASSWORD_REQUIRED')
  }

  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    throw createResetError('Passwords do not match', 400, 'PASSWORD_MISMATCH')
  }

  if (newPassword.length < 8) {
    throw createResetError('Password must be at least 8 characters', 400, 'PASSWORD_TOO_SHORT')
  }

  const owner = await verifyResetToken(token)
  const hashedPassword = await bcrypt.hash(newPassword, 10)

  const ensured = await ensureSupabaseUserForRestaurantOwner({
    id: owner.userId,
    email: owner.email,
    full_name: owner.fullName,
    phone: owner.phone,
    restaurant_id: owner.restaurantId,
    restaurant_name: owner.restaurantName,
    supabase_user_id: owner.supabaseUserId,
  }, { password: newPassword })
  const supabaseUserId = ensured.userId

  await updateSupabaseRestaurantPassword(supabaseUserId, owner.email, newPassword)

  await pool.query(
    `UPDATE restaurant_users
     SET password_hash = $1,
         supabase_user_id = $2,
         reset_token = NULL,
         reset_token_expiry = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [hashedPassword, supabaseUserId, owner.userId]
  )

  console.log('[RestaurantPasswordReset] password updated', {
    email: owner.email,
    restaurantUserId: owner.userId,
  })

  return {
    success: true,
    message: 'Password reset successfully',
    email: owner.email,
  }
}

async function cleanupExpiredTokens() {
  const result = await pool.query(
    `UPDATE restaurant_users
     SET reset_token = NULL,
         reset_token_expiry = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE reset_token IS NOT NULL
       AND reset_token_expiry <= CURRENT_TIMESTAMP`
  )

  console.log('[RestaurantPasswordReset] expired tokens cleaned up', {
    count: result.rowCount,
  })
}

module.exports = {
  RESET_TOKEN_EXPIRY_MINUTES,
  cleanupExpiredTokens,
  generateResetToken,
  hashResetToken,
  requestPasswordReset,
  resetPassword,
  verifyResetToken,
}
