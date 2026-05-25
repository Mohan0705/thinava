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

    const SocketEventsHandler = require('../../../realtime/socketEventsHandler')
    const handler = new SocketEventsHandler()
    await handler.emitRestaurantStatusUpdated(req.restaurantOwner.restaurantId, {
      status: settings.displayStatus,
      isOpenNow: settings.isOpenNow,
      displayStatus: settings.displayStatus,
      nextOpeningTime: settings.nextOpeningTime,
      closesAt: settings.closesAt,
      isOvernightSchedule: settings.isOvernightSchedule,
      isManuallyClosed: settings.is_manually_closed,
    })

    res.json({ success: true, settings })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getSettings,
  updateSettings,
}
