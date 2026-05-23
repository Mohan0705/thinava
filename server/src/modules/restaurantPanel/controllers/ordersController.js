const orderService = require('../services/orderService')

const getDashboardSummary = async (req, res, next) => {
  try {
    const summary = await orderService.getRestaurantDashboardSummary(req.restaurantOwner.restaurantId)
    res.json({ success: true, summary })
  } catch (error) {
    next(error)
  }
}

const listOrders = async (req, res, next) => {
  try {
    const orders = await orderService.listRestaurantOrders(req.restaurantOwner.restaurantId)
    res.json({ success: true, orders })
  } catch (error) {
    next(error)
  }
}

const updateOrderStatus = async (req, res, next) => {
  try {
    const order = await orderService.updateRestaurantOrderStatus(
      req.restaurantOwner.restaurantId,
      req.params.orderId,
      req.body.status
    )
    res.json({ success: true, order })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getDashboardSummary,
  listOrders,
  updateOrderStatus,
}
