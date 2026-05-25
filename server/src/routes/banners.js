const express = require('express')
const bannerService = require('../modules/marketing/bannerService')

const router = express.Router()

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next)
  } catch (error) {
    next(error)
  }
}

router.get(
  '/active',
  asyncHandler(async (req, res) => {
    const banner = await bannerService.getActiveBanner()
    res.json({ success: true, banner })
  })
)

module.exports = router
