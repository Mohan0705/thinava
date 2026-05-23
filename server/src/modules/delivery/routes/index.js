const express = require('express')
const { body, validationResult } = require('express-validator')
const authController = require('../controllers/authController')
const ordersController = require('../controllers/ordersController')
const locationController = require('../controllers/locationController')
const earningsController = require('../controllers/earningsController')
const shiftsController = require('../controllers/shiftsController')
const walletController = require('../controllers/walletController')
const { authenticateDeliveryPartner } = require('../middleware/auth')
const { logger } = require('../../../lib/logger')

const router = express.Router()

const handleValidation = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    logger.warn('Request validation failed', {
      tag: 'validation',
      path: req.path,
      errors: errors.array(),
      riderId: req.deliveryPartner?.id,
    })
    return res.status(400).json({
      success: false,
      error: errors.array().map((e) => e.msg).join(', '),
      code: 'VALIDATION_ERROR',
    })
  }
  next()
}

// Auth routes (public)
router.post('/auth/register', authController.register)
router.post('/auth/login', authController.login)
router.post('/auth/refresh', authController.refreshSession)

// Authenticated routes
router.use(authenticateDeliveryPartner)

// Profile routes
router.get('/auth/profile', authController.getProfile)
router.post('/auth/online-status',
  body('is_online').isBoolean().withMessage('is_online must be a boolean'),
  handleValidation,
  authController.setOnlineStatus
)
router.post('/auth/status',
  body('status').isString().trim().notEmpty().withMessage('status is required'),
  handleValidation,
  authController.updateStatus
)

// Order routes
router.get('/orders', ordersController.getAvailableOrders)
router.post('/orders/accept', ordersController.acceptOrder)
router.post('/orders/confirm-assignment', ordersController.confirmAssignedOrder)
router.post('/orders/reject', ordersController.rejectOrder)
router.get('/orders/active', ordersController.getActiveOrder)
router.post('/orders/status', ordersController.updateDeliveryStatus)

// Location routes
router.post('/location', locationController.updateLocation)
router.get('/location', locationController.getLatestLocation)
router.get('/location/history', locationController.getLocationHistory)

// Earnings routes
router.get('/earnings/today', earningsController.getTodayEarnings)
router.get('/earnings/week', earningsController.getWeekEarnings)
router.get('/earnings/month', earningsController.getMonthEarnings)
router.get('/earnings/history', earningsController.getEarningsHistory)

// Shift routes
router.get('/shifts', shiftsController.listShifts)
router.post('/shifts/book',
  body('slot_label').isString().trim().notEmpty().withMessage('slot_label is required'),
  body('starts_at').isISO8601().withMessage('starts_at must be a valid ISO 8601 date'),
  body('ends_at').isISO8601().withMessage('ends_at must be a valid ISO 8601 date'),
  handleValidation,
  shiftsController.bookShift
)

// Wallet routes
router.get('/wallet', walletController.getWallet)
router.get('/wallet/floating-cash', walletController.getFloatingCashStatus)
router.post('/wallet/request-pickup', walletController.requestCashPickup)
router.get('/wallet/pickup-requests', walletController.getCashPickupRequests)

// Support routes
router.get('/support', walletController.getSupportInfo)

module.exports = router
