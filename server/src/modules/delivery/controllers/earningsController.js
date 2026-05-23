const earningsService = require('../services/earningsService')

const getTodayEarnings = async (req, res, next) => {
  try {
    const partnerId = req.deliveryPartner.id

    const earnings = await earningsService.getTodayEarnings(partnerId)

    res.json({
      success: true,
      earnings,
    })
  } catch (error) {
    next(error)
  }
}

const getWeekEarnings = async (req, res, next) => {
  try {
    const partnerId = req.deliveryPartner.id

    const earnings = await earningsService.getWeekEarnings(partnerId)

    res.json({
      success: true,
      earnings,
    })
  } catch (error) {
    next(error)
  }
}

const getMonthEarnings = async (req, res, next) => {
  try {
    const partnerId = req.deliveryPartner.id

    const earnings = await earningsService.getMonthEarnings(partnerId)

    res.json({
      success: true,
      earnings,
    })
  } catch (error) {
    next(error)
  }
}

const getEarningsHistory = async (req, res, next) => {
  try {
    const partnerId = req.deliveryPartner.id
    const { limit = 50 } = req.query

    const history = await earningsService.getEarningsHistory(partnerId, parseInt(limit))

    res.json({
      success: true,
      history,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getTodayEarnings,
  getWeekEarnings,
  getMonthEarnings,
  getEarningsHistory,
}
