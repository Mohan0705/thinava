const express = require('express')
const controller = require('../controllers/authController')
const legacyRestaurantAuthRoutes = require('../../../routes/restaurant-auth')
const { authenticateRestaurantOwner } = require('../middleware/auth')
const { validateRequest } = require('../middleware/validation')
const { loginValidator } = require('../validators/authValidators')

const router = express.Router()

router.post('/signup', (req, res, next) => {
  const originalUrl = req.url

  req.body = {
    ...req.body,
    ownerEmail: req.body?.ownerEmail || req.body?.email,
    ownerPhone: req.body?.ownerPhone || req.body?.phone,
  }
  req.url = '/register'

  console.log('[RestaurantAuth] signup alias received', {
    email: req.body?.ownerEmail || req.body?.email,
    restaurantName: req.body?.restaurantName,
  })

  res.once('finish', () => {
    req.url = originalUrl
  })

  legacyRestaurantAuthRoutes(req, res, (error) => {
    req.url = originalUrl
    next(error)
  })
})
router.post('/login', loginValidator, validateRequest, controller.login)
router.post('/refresh', controller.refresh)
router.get('/me', authenticateRestaurantOwner, controller.me)
router.post('/password-reset/request', controller.requestPasswordReset)
router.get('/password-reset/verify', controller.verifyResetToken)
router.get('/password-reset/verify/:token', controller.verifyResetToken)
router.post('/password-reset/confirm', controller.confirmPasswordReset)

module.exports = router
