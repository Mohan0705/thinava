const express = require('express')
const controller = require('../controllers/analyticsController')
const { authenticateRestaurantOwner } = require('../middleware/auth')

const router = express.Router()

router.use(authenticateRestaurantOwner)
router.get('/', controller.getAnalytics)

module.exports = router
