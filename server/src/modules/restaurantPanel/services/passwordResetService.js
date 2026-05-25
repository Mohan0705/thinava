const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const pool = require('../../../database/connection')
const {
  getCleanSupabaseAuthMessage,
  getSupabaseAdminClient,
  getSupabaseAuthHttpStatus,
  logSupabaseAuthResponse,
} = require('../../../lib/supabaseAuth')

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
    `SELECT id, email, full_name, supabase_user_id
     FROM restaurant_users
     WHERE LOWER(email) = LOWER($1)
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
  console.log('[RestaurantPasswordReset] reset URL:', resetUrl)

  return {
    success: true,
    message: 'Password reset link generated',
  }
}

async function verifyResetToken(token) {
  if (!token) {
    throw createResetError('Reset token is required', 400, 'RESET_TOKEN_REQUIRED')
  }

  const tokenHash = hashResetToken(token)

  const result = await pool.query(
    `SELECT id, email, full_name, supabase_user_id, reset_token_expiry
     FROM restaurant_users
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

  if (owner.supabaseUserId) {
    const adminClient = getSupabaseAdminClient()

    if (!adminClient) {
      throw createResetError(
        'Password reset requires SUPABASE_SERVICE_ROLE_KEY for Supabase Auth restaurant accounts.',
        500,
        'SUPABASE_SERVICE_ROLE_REQUIRED'
      )
    }

    const { data, error } = await adminClient.auth.admin.updateUserById(owner.supabaseUserId, {
      password: newPassword,
    })

    logSupabaseAuthResponse('restaurant_password_reset_update_user', owner.email, data, error, {
      restaurantUserId: owner.userId,
      supabaseUserId: owner.supabaseUserId,
    })

    if (error) {
      throw createResetError(
        getCleanSupabaseAuthMessage(error, 'Failed to update Supabase Auth password'),
        getSupabaseAuthHttpStatus(error, 500),
        'SUPABASE_PASSWORD_UPDATE_FAILED'
      )
    }
  }

  await pool.query(
    `UPDATE restaurant_users
     SET password_hash = $1,
         reset_token = NULL,
         reset_token_expiry = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [hashedPassword, owner.userId]
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
