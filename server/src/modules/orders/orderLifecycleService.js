/**
 * THINAVA Centralized Order Status System
 * 
 * Single source of truth for ALL order status operations.
 * 
 * Rules:
 * - ALL statuses are UPPERCASE constants
 * - status and delivery_status are ALWAYS synchronized
 * - ALL updates go through updateOrderLifecycleState()
 * - Transactions ensure atomicity
 */

const pool = require('../../database/connection')
const { emitOrderStatusUpdated, emitDeliveryStatusUpdated } = require('../../realtime/orderEvents')
const SocketEventsHandler = require('../../realtime/socketEventsHandler')
const { getIO } = require('../../realtime/socketServer')

// ============================================================
// CENTRALIZED ORDER STATUS CONSTANTS
// ============================================================

const ORDER_STATUS = {
  PLACED: 'PLACED',
  ACCEPTED: 'ACCEPTED',
  PREPARING: 'PREPARING',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
}

const DELIVERY_STATUS = {
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  ARRIVED_AT_RESTAURANT: 'ARRIVED_AT_RESTAURANT',
  PICKED_UP: 'PICKED_UP',
  REACHED_CUSTOMER: 'REACHED_CUSTOMER',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
}

// ============================================================
// STATUS MAPPING: order status -> delivery status
// ============================================================

const ORDER_TO_DELIVERY_MAP = {
  [ORDER_STATUS.PLACED]: DELIVERY_STATUS.PENDING,
  [ORDER_STATUS.ACCEPTED]: DELIVERY_STATUS.PENDING,
  [ORDER_STATUS.PREPARING]: DELIVERY_STATUS.PENDING,
  [ORDER_STATUS.READY_FOR_PICKUP]: DELIVERY_STATUS.PENDING,
  [ORDER_STATUS.OUT_FOR_DELIVERY]: DELIVERY_STATUS.ASSIGNED,
  [ORDER_STATUS.DELIVERED]: DELIVERY_STATUS.DELIVERED,
  [ORDER_STATUS.CANCELLED]: DELIVERY_STATUS.CANCELLED,
}

// ============================================================
// STATUS NORMALIZATION
// ============================================================

const STATUS_ALIASES = {
  // Order status aliases
  placed: ORDER_STATUS.PLACED,
  accepted: ORDER_STATUS.ACCEPTED,
  preparing: ORDER_STATUS.PREPARING,
  ready_for_pickup: ORDER_STATUS.READY_FOR_PICKUP,
  picked_up: ORDER_STATUS.READY_FOR_PICKUP,
  out_for_delivery: ORDER_STATUS.OUT_FOR_DELIVERY,
  on_the_way: ORDER_STATUS.OUT_FOR_DELIVERY,
  delivered: ORDER_STATUS.DELIVERED,
  cancelled: ORDER_STATUS.CANCELLED,
  // Delivery status aliases
  pending: DELIVERY_STATUS.PENDING,
  assigned: DELIVERY_STATUS.ASSIGNED,
  arrived_at_restaurant: DELIVERY_STATUS.ARRIVED_AT_RESTAURANT,
  reached_restaurant: DELIVERY_STATUS.ARRIVED_AT_RESTAURANT,
  reached_customer: DELIVERY_STATUS.REACHED_CUSTOMER,
}

const normalizeStatus = (value) => {
  if (!value) return null
  const upper = String(value).trim().toUpperCase()
  // Check if already a valid constant
  if (Object.values(ORDER_STATUS).includes(upper) || Object.values(DELIVERY_STATUS).includes(upper)) {
    return upper
  }
  // Check aliases
  return STATUS_ALIASES[String(value).toLowerCase().trim()] || null
}

// ============================================================
// VALID TRANSITIONS
// ============================================================

const VALID_TRANSITIONS = {
  [ORDER_STATUS.PLACED]: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.ACCEPTED]: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]: [ORDER_STATUS.READY_FOR_PICKUP, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.READY_FOR_PICKUP]: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
}

const isTerminalStatus = (status) => {
  return status === ORDER_STATUS.DELIVERED || status === ORDER_STATUS.CANCELLED
}

// ============================================================
// TRANSITION VALIDATOR (standalone, no DB calls)
// ============================================================

/**
 * Validate that a transition from currentStatus to nextStatus is legal.
 * Throws with a descriptive message and statusCode if invalid.
 * 
 * This is a PURE validation function — it makes NO database queries.
 * It can be called safely from any API before any write operation.
 */
const validateOrderTransition = (currentStatus, nextStatus) => {
  const current = normalizeStatus(currentStatus)
  const next = normalizeStatus(nextStatus)

  if (!current) {
    const error = new Error(`Invalid current status: ${currentStatus}`)
    error.statusCode = 400
    throw error
  }
  if (!next) {
    const error = new Error(`Invalid target status: ${nextStatus}`)
    error.statusCode = 400
    throw error
  }

  // Terminal states are FINAL — no transition allowed
  if (isTerminalStatus(current)) {
    const error = new Error(`${current.charAt(0) + current.slice(1).toLowerCase()} orders cannot be updated.`)
    error.statusCode = 400
    throw error
  }

  // Check state machine transitions
  const allowed = VALID_TRANSITIONS[current] || []
  if (current !== next && !allowed.includes(next)) {
    const error = new Error(`Cannot transition from ${current} to ${next}. Allowed: ${allowed.join(', ') || 'none (terminal)'}`)
    error.statusCode = 400
    throw error
  }

  return true
}

// ============================================================
// CENTRALIZED LIFECYCLE UPDATE
// ============================================================

/**
 * Master function to update order lifecycle state.
 * 
 * Updates atomically:
 * - orders.status
 * - orders.delivery_status
 * - orders.delivered_at / cancelled_at timestamps
 * - delivery_assignments
 * - active_deliveries
 * - delivery_tracking
 * - delivery_partners (free rider if terminal)
 * - rider earnings (if delivered)
 * 
 * Emits realtime events to all connected clients.
 */
const updateOrderLifecycleState = async (orderId, newStatus, options = {}) => {
  const client = await pool.connect()
  const io = getIO()
  const socketHandler = new SocketEventsHandler()

  const normalizedStatus = normalizeStatus(newStatus)

  if (!normalizedStatus) {
    const error = new Error(`Invalid order status: ${newStatus}`)
    error.status = 400
    throw error
  }

  const newDeliveryStatus = ORDER_TO_DELIVERY_MAP[normalizedStatus] || DELIVERY_STATUS.PENDING
  const isTerminal = isTerminalStatus(normalizedStatus)
  const isDelivered = normalizedStatus === ORDER_STATUS.DELIVERED
  const isCancelled = normalizedStatus === ORDER_STATUS.CANCELLED

  try {
    await client.query('BEGIN')

    // 1. Lock and fetch current order state
    const orderResult = await client.query(
      `SELECT
         o.id, o.status, o.delivery_status, o.payment_method, o.total,
         o.delivery_partner_id, o.restaurant_id, o.user_id,
         o.route_distance_km, o.dropoff_distance_km,
         o.base_delivery_pay, o.distance_delivery_pay,
         o.surge_bonus, o.rain_bonus, o.night_bonus,
         o.cod_handling_bonus, o.tip_amount, o.estimated_earning,
         o.delivery_assigned_at, o.delivered_at, o.cancelled_at,
         r.name AS restaurant_name,
         u.name AS customer_name, u.id AS customer_id,
         dp.full_name AS rider_name, dp.id AS rider_id
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
       JOIN users u ON u.id = o.user_id
       LEFT JOIN delivery_partners dp ON dp.id = o.delivery_partner_id
       WHERE o.id = $1::uuid
       FOR UPDATE OF o`,
      [orderId]
    )

    if (orderResult.rows.length === 0) {
      const error = new Error('Order not found')
      error.status = 404
      throw error
    }

    const order = orderResult.rows[0]
    const currentStatus = normalizeStatus(order.status) || ORDER_STATUS.PLACED

    // 2. Terminal state guard — runs BEFORE force bypass
    //    Terminal states (DELIVERED, CANCELLED) are FINAL.
    //    NO transition is allowed out of a terminal state, ever.
    if (isTerminalStatus(currentStatus)) {
      const error = new Error(`${currentStatus.charAt(0) + currentStatus.slice(1).toLowerCase()} orders cannot be updated.`)
      error.statusCode = 400
      throw error
    }

    // 3. Validate transition against state machine
    const allowedTransitions = VALID_TRANSITIONS[currentStatus] || []
    if (currentStatus !== normalizedStatus && !allowedTransitions.includes(normalizedStatus)) {
      // Allow admin override for non-terminal transitions only
      if (!options.force) {
        const error = new Error(`Cannot transition from ${currentStatus} to ${normalizedStatus}`)
        error.status = 400
        throw error
      }
    }

    // 4. Build update query with timestamps
    const timestampUpdates = []
    const timestampValues = []
    let paramIndex = 3

    if (isDelivered && !order.delivered_at) {
      timestampUpdates.push(`delivered_at = CURRENT_TIMESTAMP`)
    }
    if (isCancelled && !order.cancelled_at) {
      timestampUpdates.push(`cancelled_at = CURRENT_TIMESTAMP`)
    }

    const timestampClause = timestampUpdates.length > 0
      ? `, ${timestampUpdates.join(', ')}`
      : ''

    // 5. Update orders table
    const updateResult = await client.query(
      `UPDATE orders
       SET status = $1,
           delivery_status = $2,
           updated_at = CURRENT_TIMESTAMP${timestampClause}
       WHERE id = $3::uuid
       RETURNING id, status, delivery_status`,
      [normalizedStatus, newDeliveryStatus, orderId]
    )

    if (updateResult.rows.length === 0) {
      const error = new Error('Order update failed')
      error.status = 500
      throw error
    }

    const riderId = order.delivery_partner_id

    // 6. Update delivery assignments if rider exists
    if (riderId) {
      const assignmentStatus = isDelivered ? 'DELIVERED' : isCancelled ? 'CANCELLED' : null
      if (assignmentStatus) {
        await client.query(
          `UPDATE delivery_assignments
           SET assignment_status = $1::text,
               delivered_at = CASE WHEN $1::text = 'DELIVERED' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
               cancelled_at = CASE WHEN $1::text = 'CANCELLED' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
               updated_at = CURRENT_TIMESTAMP
           WHERE order_id = $2::uuid AND delivery_partner_id = $3::uuid`,
          [assignmentStatus, orderId, riderId]
        )
      }

      // 7. Update active deliveries
      await client.query(
        `UPDATE active_deliveries
         SET status = $1::text,
             delivered_at = CASE WHEN $1::text = 'DELIVERED' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
             cancelled_at = CASE WHEN $1::text = 'CANCELLED' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $2::uuid AND delivery_partner_id = $3::uuid`,
        [newDeliveryStatus, orderId, riderId]
      )

      // 8. Update delivery tracking
      await client.query(
        `UPDATE delivery_tracking
         SET last_status = $1::text,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $2::uuid AND delivery_partner_id = $3::uuid`,
        [newDeliveryStatus, orderId, riderId]
      )

      // 9. Free rider if terminal status
      if (isTerminal) {
        await client.query(
          `UPDATE delivery_partners
           SET current_order_id = NULL,
               current_status = 'AVAILABLE',
               total_deliveries = CASE WHEN $1::text = 'DELIVERED' THEN total_deliveries + 1 ELSE total_deliveries END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2::uuid`,
          [normalizedStatus, riderId]
        )
      }
    }

    // 10. Record earnings if delivered
    if (isDelivered && riderId) {
      const earningsService = require('../delivery/services/earningsService')
      const assignedAt = order.delivery_assigned_at ? new Date(order.delivery_assigned_at) : new Date()
      const completedAt = new Date()
      const durationMinutes = Math.round((completedAt - assignedAt) / 60000)
      const finalDistance = Number(order.dropoff_distance_km || order.route_distance_km || 0)
      const payoutAmount =
        Number(order.estimated_earning || 0) ||
        Number(order.base_delivery_pay || 0) +
          Number(order.distance_delivery_pay || 0) +
          Number(order.surge_bonus || 0) +
          Number(order.rain_bonus || 0) +
          Number(order.night_bonus || 0) +
          Number(order.cod_handling_bonus || 0) +
          Number(order.tip_amount || 0)

      await earningsService.recordEarning(riderId, orderId, finalDistance, durationMinutes, payoutAmount, 0, client)
    }

    // 11. Update payment status for cancelled orders
    if (isCancelled) {
      let paymentStatus = order.payment_status || 'pending'
      if (order.payment_method === 'cod') {
        paymentStatus = 'not_collected'
      } else if (paymentStatus === 'paid') {
        paymentStatus = 'refunded'
      } else {
        paymentStatus = 'refund_processing'
      }

      await client.query(
        `UPDATE orders
         SET payment_status = $1,
             cancellation_reason = $2
         WHERE id = $3::uuid`,
        [paymentStatus, options.reason || 'Cancelled', orderId]
      )
    }

    await client.query('COMMIT')

    // 12. Emit realtime events (outside transaction)
    const eventPayload = {
      order_id: orderId,
      rider_id: riderId,
      rider_name: order.rider_name,
      restaurant_id: order.restaurant_id,
      restaurant_name: order.restaurant_name,
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      status: normalizedStatus,
      delivery_status: newDeliveryStatus,
      source: options.source || 'lifecycle_update',
      timestamp: new Date().toISOString(),
    }

    emitOrderStatusUpdated(orderId, {
      source: options.source || 'lifecycle_update',
      normalized_status: normalizedStatus,
      delivery_status: newDeliveryStatus,
    }).catch((err) => console.error('Failed to emit order status update:', err))

    emitDeliveryStatusUpdated(orderId, {
      source: options.source || 'lifecycle_update',
      status: newDeliveryStatus,
      order_status: normalizedStatus.toLowerCase(),
    }).catch((err) => console.error('Failed to emit delivery status update:', err))

    // Emit granular events
    if (isDelivered) {
      socketHandler.emitOrderDelivered(orderId, { userId: order.customer_id })
        .catch((err) => console.error('Failed to emit order delivered event:', err))
    }
    if (isCancelled) {
      socketHandler.emitOrderRejected(orderId, { userId: order.customer_id }, options.reason || 'Order cancelled')
        .catch((err) => console.error('Failed to emit order rejected event:', err))
    }

    // Emit to rider room
    if (io && riderId && isTerminal) {
      const eventName = isDelivered ? 'delivery_completed' : 'order_cancelled'
      io.to(`delivery_partner:${riderId}`).emit(eventName, {
        order_id: orderId,
        message: isDelivered
          ? 'Delivery completed! Earnings added to your wallet.'
          : 'This delivery has been cancelled. You are now available for new orders.',
        timestamp: eventPayload.timestamp,
      })
    }

    // Emit to admin global
    if (io) {
      const eventName = isDelivered ? 'delivery_completed' : isCancelled ? 'order_cancelled' : 'order_status_updated'
      io.to('admin:global').emit(eventName, eventPayload)
    }

    return {
      success: true,
      order_id: orderId,
      status: normalizedStatus,
      delivery_status: newDeliveryStatus,
      rider_id: riderId,
      is_terminal: isTerminal,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  ORDER_STATUS,
  DELIVERY_STATUS,
  ORDER_TO_DELIVERY_MAP,
  STATUS_ALIASES,
  VALID_TRANSITIONS,
  normalizeStatus,
  isTerminalStatus,
  validateOrderTransition,
  updateOrderLifecycleState,
}
