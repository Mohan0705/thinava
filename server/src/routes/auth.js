const express = require('express')
const rateLimit = require('express-rate-limit')
const { body, validationResult } = require('express-validator')
const authService = require('../modules/auth/services/authService')
const { authenticateCustomer } = require('../modules/auth/middleware/auth')
const { INDIAN_COUNTRY_CODE, PHONE_REGEX } = require('../modules/auth/constants')
const env = require('../config/env')

const router = express.Router()

const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.CUSTOMER_AUTH_SEND_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const phone = String(req.body?.phone || '').replace(/\D/g, '').slice(-10)
    return `send-otp:${phone || req.ip}`
  },
  message: {
    success: false,
    error: 'Too many authentication requests. Please wait a moment and try again.',
  },
})

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.CUSTOMER_AUTH_VERIFY_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const phone = String(req.body?.phone || '').replace(/\D/g, '').slice(-10)
    const verificationId = String(req.body?.verification_id || '').trim()
    return `verify-otp:${verificationId || phone || req.ip}`
  },
  message: {
    success: false,
    error: 'Too many OTP verification attempts. Please wait a moment and try again.',
  },
})

const validate = (rules) => [
  ...rules,
  (req, res, next) => {
    const result = validationResult(req)
    if (!result.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: result.array()[0].msg,
        details: result.array(),
      })
    }

    next()
  },
]

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next)
  } catch (error) {
    next(error)
  }
}

router.post(
  '/send-otp',
  otpSendLimiter,
  validate([
    body('phone')
      .custom((value) => PHONE_REGEX.test(String(value || '').replace(/\D/g, '').slice(-10)))
      .withMessage('Enter a valid Indian mobile number'),
    body('country_code').optional().isString(),
    body('full_name').optional().isString().isLength({ max: 255 }),
    body('email').optional({ nullable: true }).isEmail().withMessage('Enter a valid email'),
    body('purpose').optional().isIn(['login', 'signup']).withMessage('Invalid auth purpose'),
  ]),
  asyncHandler(async (req, res) => {
    const otpSession = await authService.requestOtp({
      phone: req.body.phone,
      countryCode: req.body.country_code || INDIAN_COUNTRY_CODE,
      fullName: req.body.full_name,
      email: req.body.email,
      purpose: req.body.purpose || 'login',
    })

    res.json({
      success: true,
      message: 'OTP sent successfully',
      ...otpSession,
    })
  })
)

router.post(
  '/verify-otp',
  otpVerifyLimiter,
  validate([
    body('verification_id').notEmpty().withMessage('OTP session is required'),
    body('phone')
      .custom((value) => PHONE_REGEX.test(String(value || '').replace(/\D/g, '').slice(-10)))
      .withMessage('Enter a valid Indian mobile number'),
    body('country_code').optional().isString(),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('Enter the 6 digit OTP'),
    body('full_name').optional().isString().isLength({ max: 255 }),
    body('email').optional({ nullable: true }).isEmail().withMessage('Enter a valid email'),
  ]),
  asyncHandler(async (req, res) => {
    const session = await authService.verifyOtp({
      verificationId: req.body.verification_id,
      phone: req.body.phone,
      countryCode: req.body.country_code || INDIAN_COUNTRY_CODE,
      otp: req.body.otp,
      fullName: req.body.full_name,
      email: req.body.email,
    })

    res.json({
      success: true,
      ...session,
    })
  })
)

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1]
    const session = await authService.refreshCustomerSession(token)

    res.json({
      success: true,
      ...session,
    })
  })
)

router.get(
  '/verify',
  authenticateCustomer,
  asyncHandler(async (req, res) => {
    const profile = await authService.getCustomerProfile(req.customer.id)
    res.json({
      success: true,
      user: profile.user,
      stats: profile.stats,
    })
  })
)

router.get(
  '/profile',
  authenticateCustomer,
  asyncHandler(async (req, res) => {
    const profile = await authService.getCustomerProfile(req.customer.id)
    res.json({
      success: true,
      user: profile.user,
      stats: profile.stats,
    })
  })
)

router.put(
  '/profile',
  authenticateCustomer,
  validate([
    body('full_name').optional().isString().isLength({ max: 255 }),
    body('email').optional({ nullable: true }).isEmail().withMessage('Enter a valid email'),
    body('profile_image').optional({ nullable: true }).isString(),
  ]),
  asyncHandler(async (req, res) => {
    const user = await authService.updateCustomerProfile(req.customer.id, req.body)
    res.json({
      success: true,
      user,
    })
  })
)

router.get(
  '/addresses',
  authenticateCustomer,
  asyncHandler(async (req, res) => {
    const addresses = await authService.getUserAddresses(req.customer.id)
    res.json({
      success: true,
      addresses,
    })
  })
)

router.post(
  '/addresses',
  authenticateCustomer,
  validate([
    body('label').notEmpty().withMessage('Address label is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('landmark').optional({ nullable: true }).isString(),
    body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
    body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
    body('is_default').optional().isBoolean(),
  ]),
  asyncHandler(async (req, res) => {
    const address = await authService.upsertAddress(req.customer.id, req.body)
    res.status(201).json({
      success: true,
      address,
    })
  })
)

router.put(
  '/addresses/:addressId',
  authenticateCustomer,
  validate([
    body('label').notEmpty().withMessage('Address label is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('landmark').optional({ nullable: true }).isString(),
    body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
    body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
    body('is_default').optional().isBoolean(),
  ]),
  asyncHandler(async (req, res) => {
    const address = await authService.upsertAddress(req.customer.id, req.body, req.params.addressId)
    res.json({
      success: true,
      address,
    })
  })
)

router.delete(
  '/addresses/:addressId',
  authenticateCustomer,
  asyncHandler(async (req, res) => {
    await authService.deleteAddress(req.customer.id, req.params.addressId)
    res.json({
      success: true,
      message: 'Address deleted successfully',
    })
  })
)

router.post(
  '/logout',
  authenticateCustomer,
  asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      message: 'Logged out successfully',
    })
  })
)

module.exports = router
