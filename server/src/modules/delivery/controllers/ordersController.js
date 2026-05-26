const orderService = require('../services/orderService')
const locationService = require('../services/locationService')

const getAvailableOrders = async (req, res, next) => {
  try {
    const orders = await orderService.getAvailableOrders(req.deliveryPartner.id)

    res.json({
      success: true,
      orders,
    })
  } catch (error) {
    next(error)
  }
}

const acceptOrder = async (req, res, next) => {
  try {
    const { order_id } = req.body
    const partnerId = req.deliveryPartner.id

    const result = await orderService.assignOrderToPartner(order_id, partnerId)

    res.json({
      success: true,
      message: 'Order accepted successfully',
      ...result,
    })
  } catch (error) {
    next(error)
  }
}

const confirmAssignedOrder = async (req, res, next) => {
  try {
    const { order_id } = req.body
    const partnerId = req.deliveryPartner.id

    const result = await orderService.confirmAssignedOrder(order_id, partnerId)

    res.json({
      success: true,
      message: 'Assigned order accepted successfully',
      ...result,
    })
  } catch (error) {
    next(error)
  }
}

const getActiveOrder = async (req, res, next) => {
  try {
    const partnerId = req.deliveryPartner.id

    const location = await locationService.getLatestDeliveryLocation(partnerId)
    const order = await orderService.getActiveOrderForPartner(partnerId)

    res.json({
      success: true,
      order,
      current_location: location,
    })
  } catch (error) {
    next(error)
  }
}

const updateDeliveryStatus = async (req, res, next) => {
  try {
    const { order_id, status, latitude, longitude, notes } = req.body
    const partnerId = req.deliveryPartner.id

    const result = await locationService.updateDeliveryStatus(
      order_id,
      partnerId,
      status,
      latitude,
      longitude,
      notes
    )

    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      ...result,
    })
  } catch (error) {
    next(error)
  }
}

const rejectOrder = async (req, res, next) => {
  try {
    const { order_id } = req.body
    const partnerId = req.deliveryPartner.id
    await orderService.rejectAssignedOrder(order_id, partnerId)

    res.json({
      success: true,
      message: 'Order rejected',
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getAvailableOrders,
  acceptOrder,
  confirmAssignedOrder,
  getActiveOrder,
  updateDeliveryStatus,
  rejectOrder,
}
