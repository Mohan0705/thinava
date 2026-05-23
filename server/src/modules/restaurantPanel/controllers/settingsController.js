const settingsService = require('../services/settingsService')

const getSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.getRestaurantSettings(req.restaurantOwner.restaurantId)
    res.json({ success: true, settings })
  } catch (error) {
    next(error)
  }
}

const updateSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.updateRestaurantSettings(
      req.restaurantOwner.restaurantId,
      req.body,
      req.restaurantOwner.id
    )

    // Emit socket event on status changes
    if (settings.status) {
      const SocketEventsHandler = require('../../../realtime/socketEventsHandler')
      const handler = new SocketEventsHandler()
      await handler.emitRestaurantStatusUpdated(req.restaurantOwner.restaurantId, settings.status)
    }

    res.json({ success: true, settings })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getSettings,
  updateSettings,
}
