const authService = require('../services/authService')
const orderService = require('../services/orderService')
const { logger } = require('../../../lib/logger')

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

const updateProfile = async (req, res, next) => {
  try {
    const profile = await authService.updateDeliveryPartnerProfile(req.deliveryPartner.id, req.body)

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
    const riderId = req.deliveryPartner.id

    logger.info('Online status toggle request', {
      tag: 'rider',
      riderId,
      is_online,
    })

    const result = await authService.setDeliveryPartnerOnlineStatus(riderId, is_online)

    if (result.is_online) {
      orderService.dispatchPendingOrders(5).catch((error) => {
        logger.error('Failed to retry pending dispatch after rider came online', {
          tag: 'dispatch',
          error: error.message,
          riderId,
        })
      })
    }

    // Emit websocket events for realtime sync
    const io = req.app?.get('io')
    if (io) {
      const room = `delivery_partner:${riderId}`
      io.to(room).emit('riderStatusUpdated', {
        riderId,
        isOnline: result.is_online,
        currentStatus: result.current_status,
        timestamp: new Date().toISOString(),
      })

      io.to('delivery:fleet').emit('riderStatusChanged', {
        riderId,
        isOnline: result.is_online,
        currentStatus: result.current_status,
        timestamp: new Date().toISOString(),
      })

      logger.debug('Websocket events emitted for online status change', {
        tag: 'realtime',
        riderId,
        room,
        fleetEvent: 'riderStatusChanged',
      })
    }

    res.json({
      success: true,
      is_online: result.is_online,
      current_status: result.current_status,
      online_since: result.online_since,
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
  updateProfile,
  refreshSession,
  setOnlineStatus,
  updateStatus,
}
