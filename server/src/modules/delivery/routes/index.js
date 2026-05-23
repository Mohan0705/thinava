const express = require('express')
const authController = require('../controllers/authController')
const ordersController = require('../controllers/ordersController')
const locationController = require('../controllers/locationController')
const earningsController = require('../controllers/earningsController')
const shiftsController = require('../controllers/shiftsController')
const walletController = require('../controllers/walletController')
const { authenticateDeliveryPartner } = require('../middleware/auth')

const router = express.Router()

// Auth routes (public)
router.post('/auth/register', authController.register)
router.post('/auth/login', authController.login)
router.post('/auth/refresh', authController.refreshSession)

// Authenticated routes
router.use(authenticateDeliveryPartner)

// Profile routes
router.get('/auth/profile', authController.getProfile)
router.post('/auth/online-status', authController.setOnlineStatus)
router.post('/auth/status', authController.updateStatus)

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
router.post('/shifts/book', shiftsController.bookShift)

// Wallet routes
router.get('/wallet', walletController.getWallet)
router.get('/wallet/floating-cash', walletController.getFloatingCashStatus)
router.post('/wallet/request-pickup', walletController.requestCashPickup)
router.get('/wallet/pickup-requests', walletController.getCashPickupRequests)

// Support routes
router.get('/support', walletController.getSupportInfo)

module.exports = router
