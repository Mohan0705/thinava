const pool = require('../database/connection')
const { getIO, emitToRoom, ROOMS } = require('./socketServer')
const {
  emitOrderStatusUpdated,
  emitDeliveryStatusUpdated,
  EVENTS,
} = require('./orderEvents')

const orderScopedLegacyEvents = async (orderId, eventName, extraPayload = {}) => {
  const io = getIO()
  if (!io) return

  const result = await pool.query(
    `SELECT o.id, o.user_id, o.restaurant_id, o.delivery_partner_id, o.status, o.delivery_status,
            u.name AS customer_name, r.name AS restaurant_name,
            dp.full_name AS rider_name
     FROM orders o
     JOIN users u ON u.id = o.user_id
     JOIN restaurants r ON r.id = o.restaurant_id
     LEFT JOIN delivery_partners dp ON dp.id = o.delivery_partner_id
     WHERE o.id = $1`,
    [orderId]
  )

  const row = result.rows[0]
  if (!row) return

  const payload = { orderId, timestamp: new Date().toISOString(), ...extraPayload }

  switch (eventName) {
    case 'orderAssigned':
      if (row.delivery_partner_id) {
        const riderResult = await pool.query(
          'SELECT full_name, phone, profile_image FROM delivery_partners WHERE id = $1',
          [row.delivery_partner_id]
        )
        const rider = riderResult.rows[0]
        const riderPayload = {
          ...payload,
          riderId: row.delivery_partner_id,
          riderName: rider?.full_name,
          riderPhone: rider?.phone,
          riderImage: rider?.profile_image,
          message: 'Your order is being picked up!',
        }
        emitToRoom(ROOMS.customer(row.user_id), 'orderAssigned', riderPayload)
        emitToRoom(ROOMS.deliveryPartner(row.delivery_partner_id), 'orderAssigned', {
          ...riderPayload,
          restaurantId: row.restaurant_id,
          message: 'New order assigned. Please proceed to restaurant.',
        })
        emitToRoom(ROOMS.restaurant(row.restaurant_id), 'orderAssigned', {
          ...riderPayload,
          riderName: rider?.full_name,
        })
      }
      break

    case 'orderAccepted':
      emitToRoom(ROOMS.customer(row.user_id), 'orderAccepted', {
        ...payload,
        message: 'Restaurant has confirmed your order!',
      })
      emitToRoom(ROOMS.restaurant(row.restaurant_id), 'orderAccepted', {
        ...payload,
        message: 'Order confirmed. Start preparing!',
      })
      break

    case 'orderRejected':
      emitToRoom(ROOMS.customer(row.user_id), 'orderRejected', {
        ...payload,
        title: 'Order Cancelled',
        message: extraPayload.message || 'Sorry! Your order was cancelled by the restaurant.',
        reason: extraPayload.reason || 'Order rejected',
        refundMessage: 'Your payment will be refunded within 2-3 business days.',
        actionable: true,
        actions: [
          { text: 'Retry Order', action: 'retry' },
          { text: 'Go Home', action: 'home' },
        ],
        animate: true,
      })
      break

    case 'orderPickedUp':
      emitToRoom(ROOMS.customer(row.user_id), 'orderPickedUp', {
        ...payload,
        message: 'Your order is on the way!',
        restaurantName: row.restaurant_name,
        status: 'ON_THE_WAY',
        showLiveTracking: true,
      })
      break

    case 'orderDelivered':
      emitToRoom(ROOMS.customer(row.user_id), 'orderDelivered', {
        ...payload,
        message: 'Your order has been delivered!',
        showRating: true,
      })
      break
  }

  await logSocketEvent(eventName, orderId, 'order', extraPayload)
}

class SocketEventsHandler {
  async emitRestaurantStatusUpdated(restaurantId, status, timestamp = new Date()) {
    const io = getIO()
    if (!io) return

    emitToRoom(ROOMS.ADMIN_GLOBAL, 'restaurantStatusUpdated', {
      restaurantId, status, timestamp, type: 'restaurant_status_change',
    })

    io.emit('restaurantStatusUpdated', { restaurantId, status, timestamp })

    await logSocketEvent('restaurantStatusUpdated', restaurantId, 'restaurant', { status })
  }

  async emitRestaurantApproved(restaurantId, details = {}) {
    const io = getIO()
    if (!io) return

    emitToRoom(ROOMS.ADMIN_GLOBAL, 'restaurantApproved', { restaurantId, timestamp: new Date(), ...details })
    emitToRoom(ROOMS.restaurant(restaurantId), 'restaurantApproved', {
      message: 'Your restaurant has been approved! You can now start managing orders.',
      timestamp: new Date(),
    })

    await logSocketEvent('restaurantApproved', restaurantId, 'restaurant', {})
  }

  async emitRestaurantRejected(restaurantId, reason = '') {
    if (!getIO()) return

    emitToRoom(ROOMS.ADMIN_GLOBAL, 'restaurantRejected', { restaurantId, reason, timestamp: new Date() })
    emitToRoom(ROOMS.restaurant(restaurantId), 'restaurantRejected', {
      message: 'Your restaurant application was not approved',
      reason, timestamp: new Date(),
    })

    await logSocketEvent('restaurantRejected', restaurantId, 'restaurant', { reason })
  }

  async emitOrderAssigned(orderId, riderId, restaurantId, customerData = {}) {
    await orderScopedLegacyEvents(orderId, 'orderAssigned', { riderId, restaurantId, customerData })
  }

  async emitOrderAccepted(orderId, restaurantId, customerData = {}) {
    await emitOrderStatusUpdated(orderId, { accepted: true })
    await orderScopedLegacyEvents(orderId, 'orderAccepted', { restaurantId, customerData })
  }

  async emitOrderRejected(orderId, customerData = {}, reason = 'Order rejected') {
    await emitOrderStatusUpdated(orderId, { cancelled: true })
    await orderScopedLegacyEvents(orderId, 'orderRejected', { customerData, reason, message: reason })
  }

  async emitOrderPickedUp(orderId, customerData = {}, restaurantName = '') {
    await emitDeliveryStatusUpdated(orderId, { picked_up: true })
    await orderScopedLegacyEvents(orderId, 'orderPickedUp', { customerData, restaurantName })
  }

  async emitOrderDelivered(orderId, customerData = {}) {
    await emitDeliveryStatusUpdated(orderId, { delivered: true })
    await orderScopedLegacyEvents(orderId, 'orderDelivered', { customerData })
  }

  async emitRiderLocationUpdated(riderId, orderId, lat, lon, details = {}) {
    const io = getIO()
    if (!io) return

    const payload = { riderId, orderId, latitude: lat, longitude: lon, timestamp: new Date(), ...details }

    emitToRoom(ROOMS.admin(riderId), 'riderLocationUpdated', payload)
    io.to(`order:${orderId}`).emit('riderLocationUpdated', payload)

    await logSocketEvent('riderLocationUpdated', orderId, 'order', { riderId, lat, lon })
  }

  async emitRiderActiveOrderNotification(riderId, orderId, orderData = {}) {
    if (!getIO()) return

    emitToRoom(ROOMS.deliveryPartner(riderId), 'activeOrderNotification', {
      orderId, message: 'You have an active delivery in progress',
      orderData, actionable: true, timestamp: new Date(),
    })

    await logSocketEvent('activeOrderNotification', orderId, 'order', { riderId })
  }

  async emitRiderApproved(riderId, details = {}) {
    if (!getIO()) return

    emitToRoom(ROOMS.ADMIN_GLOBAL, 'riderApproved', { riderId, timestamp: new Date(), ...details })
    emitToRoom(ROOMS.deliveryPartner(riderId), 'riderApproved', {
      message: 'Congratulations! You have been approved. You can now start accepting deliveries.',
      timestamp: new Date(),
    })

    await logSocketEvent('riderApproved', riderId, 'rider', {})
  }

  async emitRiderRejected(riderId, reason = '') {
    if (!getIO()) return

    emitToRoom(ROOMS.ADMIN_GLOBAL, 'riderRejected', { riderId, reason, timestamp: new Date() })
    emitToRoom(ROOMS.deliveryPartner(riderId), 'riderRejected', {
      message: 'Your application was not approved at this time.',
      reason, timestamp: new Date(),
    })

    await logSocketEvent('riderRejected', riderId, 'rider', { reason })
  }

  async emitOrderRated(orderId, restaurantId, riderId, restaurantRating, riderRating, customerData = {}) {
    if (!getIO()) return

    const payload = { orderId, restaurant_rating: restaurantRating, rider_rating: riderRating, timestamp: new Date() }

    emitToRoom(ROOMS.customer(customerData.userId), 'orderRated', payload)
    emitToRoom(ROOMS.restaurant(restaurantId), 'orderRated', { orderId, restaurant_rating: restaurantRating, timestamp: new Date() })

    if (riderId) {
      emitToRoom(ROOMS.deliveryPartner(riderId), 'orderRated', { orderId, rider_rating: riderRating, timestamp: new Date() })
    }

    emitToRoom(ROOMS.ADMIN_GLOBAL, 'orderRated', { ...payload, restaurantId, riderId })

    await logSocketEvent('orderRated', orderId, 'order', { restaurantId, riderId, restaurantRating, riderRating })
  }

  async emitBulkUpdate(updateType, data = {}) {
    const io = getIO()
    if (!io) return
    io.emit(`bulk:${updateType}`, data)
  }
}

const logSocketEvent = async (eventName, subjectId, subjectType, payload = {}) => {
  try {
    await pool.query(
      `INSERT INTO socket_events_log (event_name, subject_id, subject_type, payload)
       VALUES ($1, $2, $3, $4)`,
      [eventName, subjectId, subjectType, JSON.stringify(payload)]
    )
  } catch (error) {
    console.error('Failed to log socket event:', error)
  }
}

module.exports = SocketEventsHandler
