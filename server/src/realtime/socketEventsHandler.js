/**
 * THINAVA Socket.IO Events Handler
 * Central hub for all real-time events
 * 
 * Events:
 * - restaurantStatusUpdated
 * - orderAssigned
 * - orderAccepted
 * - orderRejected
 * - orderPickedUp
 * - orderDelivered
 * - riderLocationUpdated
 * - restaurantApproved
 * - restaurantRejected
 * - riderApproved
 * - riderRejected
 */

const pool = require('../database/connection')

class SocketEventsHandler {
  constructor(io) {
    this.io = io
  }

  // ============================================================
  // RESTAURANT EVENTS
  // ============================================================

  /**
   * Emit when restaurant changes status (OPEN, TEMPORARILY_UNAVAILABLE, CLOSED)
   */
  async emitRestaurantStatusUpdated(restaurantId, status, timestamp = new Date()) {
    if (!this.io) return

    // Emit to admin
    this.io.to('admin:global').emit('restaurantStatusUpdated', {
      restaurantId,
      status,
      timestamp,
      type: 'restaurant_status_change'
    })

    // Emit to customers (so they see restaurants greyed out/hidden)
    this.io.emit('restaurantStatusUpdated', {
      restaurantId,
      status,
      timestamp
    })

    // Log event
    await this.logSocketEvent('restaurantStatusUpdated', restaurantId, 'restaurant', { status })
  }

  /**
   * Emit when admin approves restaurant
   */
  async emitRestaurantApproved(restaurantId, details = {}) {
    if (!this.io) return

    this.io.to('admin:global').emit('restaurantApproved', {
      restaurantId,
      timestamp: new Date(),
      ...details
    })

    this.io.to(`restaurant:${restaurantId}`).emit('restaurantApproved', {
      message: 'Your restaurant has been approved! You can now start managing orders.',
      timestamp: new Date()
    })

    await this.logSocketEvent('restaurantApproved', restaurantId, 'restaurant', {})
  }

  /**
   * Emit when admin rejects restaurant
   */
  async emitRestaurantRejected(restaurantId, reason = '') {
    if (!this.io) return

    this.io.to('admin:global').emit('restaurantRejected', {
      restaurantId,
      reason,
      timestamp: new Date()
    })

    this.io.to(`restaurant:${restaurantId}`).emit('restaurantRejected', {
      message: 'Your restaurant application was not approved',
      reason,
      timestamp: new Date()
    })

    await this.logSocketEvent('restaurantRejected', restaurantId, 'restaurant', { reason })
  }

  // ============================================================
  // ORDER EVENTS
  // ============================================================

  /**
   * Emit when order is assigned to a rider
   */
  async emitOrderAssigned(orderId, riderId, restaurantId, customerData = {}) {
    if (!this.io) return

    // Get rider details
    const riderResult = await pool.query(
      'SELECT full_name, phone, profile_image FROM delivery_partners WHERE id = $1',
      [riderId]
    )

    const rider = riderResult.rows[0]

    // To customer - show assigned rider details
    this.io.to(`customer:${customerData.userId}`).emit('orderAssigned', {
      orderId,
      riderId,
      riderName: rider?.full_name,
      riderPhone: rider?.phone,
      riderImage: rider?.profile_image,
      message: 'Your order is being picked up!',
      timestamp: new Date()
    })

    // To rider - notify about assignment
    this.io.to(`delivery_partner:${riderId}`).emit('orderAssigned', {
      orderId,
      restaurantId,
      message: 'New order assigned. Please proceed to restaurant.',
      timestamp: new Date()
    })

    // To restaurant - confirm assignment
    this.io.to(`restaurant:${restaurantId}`).emit('orderAssigned', {
      orderId,
      riderName: rider?.full_name,
      timestamp: new Date()
    })

    await this.logSocketEvent('orderAssigned', orderId, 'order', { riderId, restaurantId })
  }

  /**
   * Emit when restaurant accepts order
   */
  async emitOrderAccepted(orderId, restaurantId, customerData = {}) {
    if (!this.io) return

    this.io.to(`customer:${customerData.userId}`).emit('orderAccepted', {
      orderId,
      message: 'Restaurant has confirmed your order!',
      timestamp: new Date()
    })

    this.io.to(`restaurant:${restaurantId}`).emit('orderAccepted', {
      orderId,
      message: 'Order confirmed. Start preparing!',
      timestamp: new Date()
    })

    await this.logSocketEvent('orderAccepted', orderId, 'order', {})
  }

  /**
   * Emit when restaurant rejects order (WITH ANIMATED POPUP)
   */
  async emitOrderRejected(orderId, customerData = {}, reason = 'Order rejected') {
    if (!this.io) return

    // This is critical - show POPUP to customer
    this.io.to(`customer:${customerData.userId}`).emit('orderRejected', {
      orderId,
      title: 'Order Cancelled',
      message: 'Sorry! Your order was cancelled by the restaurant.',
      reason,
      refundMessage: 'Your payment will be refunded within 2-3 business days.',
      actionable: true,
      actions: [
        { text: 'Retry Order', action: 'retry' },
        { text: 'Go Home', action: 'home' }
      ],
      timestamp: new Date(),
      animate: true // Show animation
    })

    await this.logSocketEvent('orderRejected', orderId, 'order', { reason })
  }

  /**
   * Emit when rider picks up order
   */
  async emitOrderPickedUp(orderId, customerData = {}, restaurantName = '') {
    if (!this.io) return

    this.io.to(`customer:${customerData.userId}`).emit('orderPickedUp', {
      orderId,
      message: 'Your order is on the way!',
      restaurantName,
      status: 'ON_THE_WAY',
      timestamp: new Date(),
      showLiveTracking: true
    })

    await this.logSocketEvent('orderPickedUp', orderId, 'order', {})
  }

  /**
   * Emit when order is delivered
   */
  async emitOrderDelivered(orderId, customerData = {}) {
    if (!this.io) return

    this.io.to(`customer:${customerData.userId}`).emit('orderDelivered', {
      orderId,
      message: 'Your order has been delivered!',
      timestamp: new Date(),
      showRating: true // Show rating popup
    })

    await this.logSocketEvent('orderDelivered', orderId, 'order', {})
  }

  // ============================================================
  // RIDER EVENTS
  // ============================================================

  /**
   * Emit rider location update for live tracking
   */
  async emitRiderLocationUpdated(riderId, orderId, lat, lon, details = {}) {
    if (!this.io) return

    // Broadcast to order room (customer + restaurant + rider)
    this.io.to(`order:${orderId}`).emit('riderLocationUpdated', {
      riderId,
      orderId,
      latitude: lat,
      longitude: lon,
      timestamp: new Date(),
      ...details
    })

    // Also broadcast globally for admin tracking
    this.io.to('admin:global').emit('riderLocationUpdated', {
      riderId,
      orderId,
      latitude: lat,
      longitude: lon,
      timestamp: new Date()
    })

    await this.logSocketEvent('riderLocationUpdated', orderId, 'order', { riderId, lat, lon })
  }

  /**
   * Emit active order notification to rider (floating banner)
   */
  async emitRiderActiveOrderNotification(riderId, orderId, orderData = {}) {
    if (!this.io) return

    this.io.to(`delivery_partner:${riderId}`).emit('activeOrderNotification', {
      orderId,
      message: 'You have an active delivery in progress',
      orderData,
      actionable: true,
      timestamp: new Date()
    })

    await this.logSocketEvent('activeOrderNotification', orderId, 'order', { riderId })
  }

  /**
   * Emit when admin approves rider
   */
  async emitRiderApproved(riderId, details = {}) {
    if (!this.io) return

    this.io.to('admin:global').emit('riderApproved', {
      riderId,
      timestamp: new Date(),
      ...details
    })

    this.io.to(`delivery_partner:${riderId}`).emit('riderApproved', {
      message: 'Congratulations! You have been approved. You can now start accepting deliveries.',
      timestamp: new Date()
    })

    await this.logSocketEvent('riderApproved', riderId, 'rider', {})
  }

  /**
   * Emit when admin rejects rider
   */
  async emitRiderRejected(riderId, reason = '') {
    if (!this.io) return

    this.io.to('admin:global').emit('riderRejected', {
      riderId,
      reason,
      timestamp: new Date()
    })

    this.io.to(`delivery_partner:${riderId}`).emit('riderRejected', {
      message: 'Your application was not approved at this time.',
      reason,
      timestamp: new Date()
    })

    await this.logSocketEvent('riderRejected', riderId, 'rider', { reason })
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  // ============================================================
  // RATING EVENTS
  // ============================================================

  /**
   * Emit when an order is rated — updates ratings in real-time
   * across all platform surfaces (customer app, restaurant dashboard,
   * rider app, admin panel).
   */
  async emitOrderRated(orderId, restaurantId, riderId, restaurantRating, riderRating, customerData = {}) {
    if (!this.io) return

    // To customer — hide "Rate Order" button, show updated rating
    this.io.to(`customer:${customerData.userId}`).emit('orderRated', {
      orderId,
      restaurant_rating: restaurantRating,
      rider_rating: riderRating,
      timestamp: new Date(),
    })

    // To restaurant — update dashboard review analytics
    this.io.to(`restaurant:${restaurantId}`).emit('orderRated', {
      orderId,
      restaurant_rating: restaurantRating,
      timestamp: new Date(),
    })

    // To rider — update rider rating
    if (riderId) {
      this.io.to(`delivery_partner:${riderId}`).emit('orderRated', {
        orderId,
        rider_rating: riderRating,
        timestamp: new Date(),
      })
    }

    // To admin — update review analytics
    this.io.to('admin:global').emit('orderRated', {
      orderId,
      restaurantId,
      riderId,
      restaurant_rating: restaurantRating,
      rider_rating: riderRating,
      timestamp: new Date(),
    })

    // Log event
    await this.logSocketEvent('orderRated', orderId, 'order', {
      restaurantId, riderId, restaurantRating, riderRating
    })
  }

  /**
   * Log socket events to database for audit trail
   */
  async logSocketEvent(eventName, subjectId, subjectType, payload = {}) {
    try {
      await pool.query(
        `INSERT INTO socket_events_log (event_name, subject_id, subject_type, payload)
         VALUES ($1, $2, $3, $4)`,
        [eventName, subjectId, subjectType, JSON.stringify(payload)]
      )
    } catch (error) {
      console.error('Failed to log socket event:', error)
      // Don't throw - continue processing
    }
  }

  /**
   * Emit bulk status update
   */
  async emitBulkUpdate(updateType, data = {}) {
    if (!this.io) return
    this.io.emit(`bulk:${updateType}`, data)
  }
}

module.exports = SocketEventsHandler
