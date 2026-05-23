const analyticsService = require('../services/analyticsService')

const getAnalytics = async (req, res, next) => {
  try {
    const days = req.query.days ? parseInt(req.query.days) : 7
    const analytics = await analyticsService.getRestaurantAnalytics(
      req.restaurantOwner.restaurantId,
      days
    )
    res.json({ success: true, analytics })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getAnalytics,
}
