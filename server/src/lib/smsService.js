const { logger } = require('./logger')
const env = require('../config/env')

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || ''
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || ''
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || ''
const DEV_MODE = env.DEV_MODE === 'true' || env.DEV_MODE === true

let twilioClient = null

if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    logger.info('Twilio client initialized', { tag: 'sms' })
  } catch {
    logger.warn('Failed to initialize Twilio client', { tag: 'sms' })
  }
}

const sendOtp = async ({ phone, otp, countryCode }) => {
  const formatted = `${countryCode}${phone.slice(-10)}`

  if (twilioClient) {
    try {
      await twilioClient.messages.create({
        body: `Your THINAVA verification code is: ${otp}. It expires in ${env.OTP_EXPIRY_MINUTES} minutes.`,
        from: TWILIO_PHONE_NUMBER,
        to: formatted,
      })
      logger.info('SMS sent via Twilio', { tag: 'sms', to: formatted })
      return true
    } catch (err) {
      logger.error('Twilio send failed, falling back to log', { tag: 'sms', error: err.message })
    }
  }

  logger.info('[SMS] OTP sent', { tag: 'sms', to: formatted, otp: DEV_MODE ? otp : '[REDACTED]' })
  return true
}

module.exports = { sendOtp }
