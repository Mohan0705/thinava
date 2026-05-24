const { body } = require('express-validator')

const menuItemValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('description').optional({ nullable: true }).isString(),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('image').optional({ nullable: true }).isString(),
  body('category_id').isUUID().withMessage('Valid category is required'),
  body('is_veg').optional().isBoolean(),
  body('is_bestseller').optional().isBoolean(),
  body('in_stock').optional().isBoolean(),
]

const stockValidator = [
  body('in_stock').isBoolean().withMessage('in_stock must be a boolean'),
]

module.exports = {
  menuItemValidator,
  stockValidator,
}
