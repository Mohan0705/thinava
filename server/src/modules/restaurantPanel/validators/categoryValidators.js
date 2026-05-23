const { body } = require('express-validator')

const categoryValidator = [
  body('name').trim().notEmpty().withMessage('Category name is required'),
  body('description').optional({ nullable: true }).isString(),
]

const reorderCategoriesValidator = [
  body('category_ids').isArray({ min: 1 }).withMessage('category_ids must be a non-empty array'),
  body('category_ids.*').isUUID().withMessage('Each category id must be a valid UUID'),
]

module.exports = {
  categoryValidator,
  reorderCategoriesValidator,
}
