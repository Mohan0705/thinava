const express = require('express')
const controller = require('../controllers/categoriesController')
const { authenticateRestaurantOwner } = require('../middleware/auth')
const { validateRequest } = require('../middleware/validation')
const { categoryValidator, reorderCategoriesValidator } = require('../validators/categoryValidators')

const router = express.Router()

router.use(authenticateRestaurantOwner)
router.get('/', controller.listCategories)
router.post('/', categoryValidator, validateRequest, controller.createCategory)
router.put('/reorder', reorderCategoriesValidator, validateRequest, controller.reorderCategories)
router.put('/:categoryId', categoryValidator, validateRequest, controller.updateCategory)
router.delete('/:categoryId', controller.deleteCategory)

module.exports = router
