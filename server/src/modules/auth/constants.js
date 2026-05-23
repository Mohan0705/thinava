

const CUSTOMER_AUTH_ROLE = 'customer'

const env = require('../../config/env')

const DEV_MODE = env.DEV_MODE === 'true' || env.DEV_MODE === true
const OTP_EXPIRY_MINUTES = env.OTP_EXPIRY_MINUTES
const OTP_RESEND_COOLDOWN_SECONDS = env.OTP_RESEND_COOLDOWN_SECONDS
const OTP_MAX_ATTEMPTS = env.OTP_MAX_ATTEMPTS

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000))

const PHONE_REGEX = /^[6-9]\d{9}$/
const INDIAN_COUNTRY_CODE = '+91'

module.exports = {
  CUSTOMER_AUTH_ROLE,
  DEV_MODE,
  generateOtp,
  OTP_EXPIRY_MINUTES,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_MAX_ATTEMPTS,
  PHONE_REGEX,
  INDIAN_COUNTRY_CODE,
}
