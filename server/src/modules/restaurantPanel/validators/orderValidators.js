const { body } = require('express-validator')

const updateOrderStatusValidator = [
  body('status').isString().trim().notEmpty().withMessage('Status is required'),
]

module.exports = {
  updateOrderStatusValidator,
}
