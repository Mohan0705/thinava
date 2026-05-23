const express = require('express')
const controller = require('../controllers/authController')
const { authenticateRestaurantOwner } = require('../middleware/auth')
const { validateRequest } = require('../middleware/validation')
const { loginValidator } = require('../validators/authValidators')

const router = express.Router()

router.post('/login', loginValidator, validateRequest, controller.login)
router.post('/refresh', controller.refresh)
router.get('/me', authenticateRestaurantOwner, controller.me)

module.exports = router
