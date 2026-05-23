const express = require('express')
const authRoutes = require('./authRoutes')
const ordersRoutes = require('./ordersRoutes')
const menuRoutes = require('./menuRoutes')
const categoriesRoutes = require('./categoriesRoutes')
const settingsRoutes = require('./settingsRoutes')
const analyticsRoutes = require('./analyticsRoutes')

const router = express.Router()

router.use('/auth', authRoutes)
router.use('/orders', ordersRoutes)
router.use('/menu', menuRoutes)
router.use('/categories', categoriesRoutes)
router.use('/settings', settingsRoutes)
router.use('/analytics', analyticsRoutes)

module.exports = router
