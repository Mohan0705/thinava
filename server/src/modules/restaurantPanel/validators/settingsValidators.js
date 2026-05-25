const { body } = require('express-validator')

const settingsValidator = [
  body('name').trim().notEmpty().withMessage('Restaurant name is required'),
  body('image').optional({ nullable: true }).isString(),
  body('logo').optional({ nullable: true }).isString(),
  body('banner_image').optional({ nullable: true }).isString(),
  body('description').optional({ nullable: true }).isString(),
  body('opening_time').optional({ nullable: true }).isString(),
  body('closing_time').optional({ nullable: true }).isString(),
  body('timezone').optional({ nullable: true }).isString(),
  body('is_manually_closed').optional().isBoolean(),
  body('minimum_order').optional().isFloat({ min: 0 }),
  body('delivery_radius_km').optional().isInt({ min: 1, max: 100 }),
  body('formatted_address').optional({ nullable: true }).isString(),
  body('place_id').optional({ nullable: true }).isString(),
  body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('offer').optional({ nullable: true }).isString(),
  body('cuisines').optional().isArray(),
  body('delivery_time').optional().custom((value) => typeof value === 'string' || typeof value === 'number'),
  body('price_for_one').optional().isFloat({ min: 0 }),
  body('status').optional().isIn(['OPEN', 'CLOSED', 'MANUALLY_CLOSED', 'TEMPORARILY_UNAVAILABLE']).withMessage('Invalid restaurant status'),
]

module.exports = {
  settingsValidator,
}
