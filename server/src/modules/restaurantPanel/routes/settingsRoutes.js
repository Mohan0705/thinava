const express = require('express')
const controller = require('../controllers/settingsController')
const { authenticateRestaurantOwner } = require('../middleware/auth')
const { validateRequest } = require('../middleware/validation')
const { settingsValidator } = require('../validators/settingsValidators')

const router = express.Router()

router.use(authenticateRestaurantOwner)
router.get('/', controller.getSettings)
router.put('/', settingsValidator, validateRequest, controller.updateSettings)

module.exports = router
