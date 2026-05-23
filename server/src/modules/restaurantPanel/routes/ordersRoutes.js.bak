const express = require('express')
const controller = require('../controllers/ordersController')
const { authenticateRestaurantOwner } = require('../middleware/auth')
const { validateRequest } = require('../middleware/validation')
const { updateOrderStatusValidator } = require('../validators/orderValidators')

const router = express.Router()

router.use(authenticateRestaurantOwner)
router.get('/summary', controller.getDashboardSummary)
router.get('/', controller.listOrders)
router.patch('/:orderId/status', updateOrderStatusValidator, validateRequest, controller.updateOrderStatus)

module.exports = router
