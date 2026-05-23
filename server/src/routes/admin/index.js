const express = require('express')
const rateLimit = require('express-rate-limit')
const { body, validationResult } = require('express-validator')
const adminService = require('../../modules/admin/services/adminService')
const { authenticateAdmin, authorizeAdmin } = require('../../modules/admin/middleware/auth')
const { ADMIN_PERMISSIONS } = require('../../modules/admin/constants')
const { logger } = require('../../utils/logger')

const router = express.Router()

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Please try again after 15 minutes.' },
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
  '/auth/login',
  adminLoginLimiter,
  validate([
    body('email').isEmail().withMessage('A valid admin email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ]),
  asyncHandler(async (req, res) => {
    const session = await adminService.loginAdmin(req.body.email, req.body.password)
    res.json({ success: true, ...session })
  })
)

router.post(
  '/auth/refresh',
  asyncHandler(async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1]
    const session = await adminService.refreshAdminSession(token)
    res.json({ success: true, ...session })
  })
)

router.use(authenticateAdmin)

router.get(
  '/auth/profile',
  asyncHandler(async (req, res) => {
    const admin = await adminService.fetchAdminById(req.adminUser.id)
    res.json({ success: true, admin })
  })
)

router.get(
  '/dashboard',
  authorizeAdmin(ADMIN_PERMISSIONS.DASHBOARD_VIEW),
  asyncHandler(async (req, res) => {
    const dashboard = await adminService.getDashboardData()
    res.json({ success: true, dashboard })
  })
)

router.get(
  '/orders',
  authorizeAdmin(ADMIN_PERMISSIONS.ORDERS_VIEW),
  asyncHandler(async (req, res) => {
    const data = await adminService.listOrders(req.query)
    res.json({ success: true, ...data })
  })
)

router.patch(
  '/orders/:orderId/status',
  authorizeAdmin(ADMIN_PERMISSIONS.ORDERS_MANAGE),
  validate([body('status').notEmpty().withMessage('Order status is required')]),
  asyncHandler(async (req, res) => {
    const order = await adminService.updateOrderStatus(
      req.params.orderId,
      req.body.status,
      req.adminUser,
      { source: 'admin_panel' }
    )
    res.json({ success: true, order })
  })
)

router.post(
  '/orders/:orderId/cancel',
  authorizeAdmin(ADMIN_PERMISSIONS.ORDERS_MANAGE),
  asyncHandler(async (req, res) => {
    const result = await adminService.cancelOrder(req.params.orderId, req.body.reason, req.adminUser)
    res.json({ success: true, ...result })
  })
)

router.post(
  '/orders/:orderId/mark-delivered',
  authorizeAdmin(ADMIN_PERMISSIONS.ORDERS_MANAGE),
  asyncHandler(async (req, res) => {
    const result = await adminService.markDelivered(req.params.orderId, req.adminUser)
    res.json({ success: true, ...result })
  })
)

router.post(
  '/orders/:orderId/reassign-rider',
  authorizeAdmin(ADMIN_PERMISSIONS.ORDERS_MANAGE, ADMIN_PERMISSIONS.DELIVERY_MANAGE),
  validate([body('rider_id').notEmpty().withMessage('A delivery partner is required')]),
  asyncHandler(async (req, res) => {
    const result = await adminService.reassignRider(req.params.orderId, req.body.rider_id, req.adminUser)
    res.json({ success: true, ...result })
  })
)

router.get(
  '/restaurants',
  authorizeAdmin(ADMIN_PERMISSIONS.RESTAURANTS_VIEW),
  asyncHandler(async (req, res) => {
    const data = await adminService.listRestaurants()
    res.json({ success: true, ...data })
  })
)

router.patch(
  '/restaurants/:restaurantId',
  authorizeAdmin(ADMIN_PERMISSIONS.RESTAURANTS_MANAGE),
  asyncHandler(async (req, res) => {
    const restaurant = await adminService.updateRestaurant(req.params.restaurantId, req.body, req.adminUser)
    res.json({ success: true, restaurant })
  })
)

router.get(
  '/delivery-partners',
  authorizeAdmin(ADMIN_PERMISSIONS.DELIVERY_VIEW),
  asyncHandler(async (req, res) => {
    const data = await adminService.listDeliveryPartners()
    res.json({ success: true, ...data })
  })
)

router.patch(
  '/delivery-partners/:partnerId',
  authorizeAdmin(ADMIN_PERMISSIONS.DELIVERY_MANAGE),
  asyncHandler(async (req, res) => {
    const partner = await adminService.updateDeliveryPartner(req.params.partnerId, req.body, req.adminUser)
    res.json({ success: true, partner })
  })
)

router.get(
  '/customers',
  authorizeAdmin(ADMIN_PERMISSIONS.CUSTOMERS_VIEW),
  asyncHandler(async (req, res) => {
    const data = await adminService.listCustomers()
    res.json({ success: true, ...data })
  })
)

router.patch(
  '/customers/:customerId',
  authorizeAdmin(ADMIN_PERMISSIONS.CUSTOMERS_MANAGE),
  asyncHandler(async (req, res) => {
    const customer = await adminService.updateCustomer(req.params.customerId, req.body, req.adminUser)
    res.json({ success: true, customer })
  })
)

router.get(
  '/analytics',
  authorizeAdmin(ADMIN_PERMISSIONS.ANALYTICS_VIEW),
  asyncHandler(async (req, res) => {
    const analytics = await adminService.getAnalytics()
    res.json({ success: true, analytics })
  })
)

router.get(
  '/payments',
  authorizeAdmin(ADMIN_PERMISSIONS.PAYMENTS_VIEW),
  asyncHandler(async (req, res) => {
    const payments = await adminService.getPayments()
    res.json({ success: true, payments })
  })
)

router.get(
  '/support',
  authorizeAdmin(ADMIN_PERMISSIONS.SUPPORT_VIEW),
  asyncHandler(async (req, res) => {
    const support = await adminService.getSupport()
    res.json({ success: true, support })
  })
)

router.patch(
  '/support/:ticketId',
  authorizeAdmin(ADMIN_PERMISSIONS.SUPPORT_MANAGE),
  asyncHandler(async (req, res) => {
    const ticket = await adminService.updateSupportTicket(req.params.ticketId, req.body, req.adminUser)
    res.json({ success: true, ticket })
  })
)

router.get(
  '/promotions',
  authorizeAdmin(ADMIN_PERMISSIONS.PROMOTIONS_VIEW),
  asyncHandler(async (req, res) => {
    const promotions = await adminService.getPromotions()
    res.json({ success: true, promotions })
  })
)

router.post(
  '/promotions/coupons',
  authorizeAdmin(ADMIN_PERMISSIONS.PROMOTIONS_MANAGE),
  validate([
    body('code').notEmpty().withMessage('Coupon code is required'),
    body('title').notEmpty().withMessage('Coupon title is required'),
    body('discount_value').isNumeric().withMessage('Discount value must be numeric'),
  ]),
  asyncHandler(async (req, res) => {
    const coupon = await adminService.createCoupon(req.body, req.adminUser)
    res.status(201).json({ success: true, coupon })
  })
)

router.get(
  '/settings',
  authorizeAdmin(ADMIN_PERMISSIONS.SETTINGS_VIEW),
  asyncHandler(async (req, res) => {
    const settings = await adminService.getSettings()
    res.json({ success: true, ...settings })
  })
)

router.put(
  '/settings',
  authorizeAdmin(ADMIN_PERMISSIONS.SETTINGS_MANAGE),
  validate([body('settings').isArray({ min: 1 }).withMessage('Settings array is required')]),
  asyncHandler(async (req, res) => {
    const settings = await adminService.updateSettings(req.body.settings, req.adminUser)
    res.json({ success: true, ...settings })
  })
)

router.get(
  '/live-map',
  authorizeAdmin(ADMIN_PERMISSIONS.MAP_VIEW),
  asyncHandler(async (req, res) => {
    const liveMap = await adminService.getLiveMap()
    res.json({ success: true, liveMap })
  })
)

module.exports = router
