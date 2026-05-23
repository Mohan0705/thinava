const authService = require('../services/authService')
const orderService = require('../services/orderService')

const register = async (req, res, next) => {
  try {
    const { full_name, phone, email, password, vehicle_type, vehicle_number } = req.body

    const result = await authService.registerDeliveryPartner(
      full_name,
      phone,
      email,
      password,
      vehicle_type,
      vehicle_number
    )

    res.status(201).json({
      success: true,
      requires_approval: result.requires_approval,
      approval_status: result.approval_status,
      partner: result.partner,
    })
  } catch (error) {
    next(error)
  }
}

const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body

    const result = await authService.loginDeliveryPartner(phone, password)

    res.json({
      success: true,
      token: result.token,
      partner: result.partner,
    })
  } catch (error) {
    next(error)
  }
}

const getProfile = async (req, res, next) => {
  try {
    const profile = await authService.getDeliveryPartnerProfile(req.deliveryPartner.id)

    res.json({
      success: true,
      profile,
    })
  } catch (error) {
    next(error)
  }
}

const refreshSession = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    const result = await authService.refreshDeliveryPartnerSession(token)

    res.json({
      success: true,
      token: result.token,
      partner: result.partner,
    })
  } catch (error) {
    next(error)
  }
}

const setOnlineStatus = async (req, res, next) => {
  try {
    const { is_online } = req.body

    const result = await authService.setDeliveryPartnerOnlineStatus(req.deliveryPartner.id, is_online)

    if (result.is_online) {
      orderService.dispatchPendingOrders(5).catch((error) => {
        console.error('Failed to retry pending dispatch after rider came online', error)
      })
    }

    res.json({
      success: true,
      is_online: result.is_online,
      current_status: result.current_status,
    })
  } catch (error) {
    next(error)
  }
}

const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body

    const result = await authService.updateDeliveryPartnerStatus(req.deliveryPartner.id, status)

    res.json({
      success: true,
      current_status: result.current_status,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  register,
  login,
  getProfile,
  refreshSession,
  setOnlineStatus,
  updateStatus,
}
