const locationService = require('../services/locationService')

const updateLocation = async (req, res, next) => {
  try {
    const { order_id, latitude, longitude, accuracy } = req.body
    const partnerId = req.deliveryPartner.id

    const location = await locationService.saveDeliveryLocation(
      partnerId,
      order_id,
      latitude,
      longitude,
      accuracy
    )

    res.json({
      success: true,
      location,
    })
  } catch (error) {
    next(error)
  }
}

const getLatestLocation = async (req, res, next) => {
  try {
    const partnerId = req.deliveryPartner.id
    const { order_id } = req.query

    const location = await locationService.getLatestDeliveryLocation(partnerId)

    res.json({
      success: true,
      location,
    })
  } catch (error) {
    next(error)
  }
}

const getLocationHistory = async (req, res, next) => {
  try {
    const partnerId = req.deliveryPartner.id
    const { order_id, limit = 100 } = req.query

    const locations = await locationService.getDeliveryLocationHistory(
      partnerId,
      order_id,
      parseInt(limit)
    )

    res.json({
      success: true,
      locations,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  updateLocation,
  getLatestLocation,
  getLocationHistory,
}
