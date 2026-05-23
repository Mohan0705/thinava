const express = require('express')
const controller = require('../controllers/menuController')
const { authenticateRestaurantOwner } = require('../middleware/auth')
const { validateRequest } = require('../middleware/validation')
const { menuItemValidator, stockValidator } = require('../validators/menuValidators')

const router = express.Router()

router.use(authenticateRestaurantOwner)

// Menu items
router.get('/', controller.listMenuItems)
router.post('/', menuItemValidator, validateRequest, controller.createMenuItem)
router.put('/:menuItemId', menuItemValidator, validateRequest, controller.updateMenuItem)
router.patch('/:menuItemId/stock', stockValidator, validateRequest, controller.updateStock)
router.delete('/:menuItemId', controller.deleteMenuItem)

// Variants
router.post('/:menuItemId/variant', controller.createVariant)
router.put('/:menuItemId/variant/:variantId', controller.updateVariant)
router.delete('/:menuItemId/variant/:variantId', controller.deleteVariant)

// Addons
router.post('/:menuItemId/addon', controller.createAddon)
router.put('/:menuItemId/addon/:addonId', controller.updateAddon)
router.delete('/:menuItemId/addon/:addonId', controller.deleteAddon)

module.exports = router
