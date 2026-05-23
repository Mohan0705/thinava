require('dotenv').config()
const { ensureRestaurantPanelSchema } = require('./ensureRestaurantPanelSchema')
const { ensureAdminSchema } = require('./ensureAdminSchema')
const { ensureCustomerAuthSchema } = require('./ensureCustomerAuthSchema')
const { ensureRestaurantRegistrationSchema } = require('./ensureRestaurantRegistrationSchema')

ensureRestaurantPanelSchema()
  .then(() => ensureAdminSchema())
  .then(() => ensureCustomerAuthSchema())
  .then(() => ensureRestaurantRegistrationSchema())
  .then(() => {
    console.log('Restaurant, admin, and customer auth schemas are ready')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Failed to prepare database schema', error)
    process.exit(1)
  })
