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
  CONFIRMED: 'ACCEPTED',
  PREPARING: 'PREPARING',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
}

const DELIVERY_STATUS = {
  PENDING: 'PENDING',
  READY_FOR_ASSIGNMENT: 'READY_FOR_ASSIGNMENT',
  ASSIGNED: 'ASSIGNED',
  ARRIVED_AT_RESTAURANT: 'ARRIVED_AT_RESTAURANT',
  PICKED_UP: 'PICKED_UP',
  REACHED_CUSTOMER: 'REACHED_CUSTOMER',
  CASH_COLLECTED: 'CASH_COLLECTED',
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
  confirmed: ORDER_STATUS.ACCEPTED,
  preparing: ORDER_STATUS.PREPARING,
  ready_for_pickup: ORDER_STATUS.READY_FOR_PICKUP,
  picked_up: ORDER_STATUS.OUT_FOR_DELIVERY,
  out_for_delivery: ORDER_STATUS.OUT_FOR_DELIVERY,
  on_the_way: ORDER_STATUS.OUT_FOR_DELIVERY,
  delivered: ORDER_STATUS.DELIVERED,
  cancelled: ORDER_STATUS.CANCELLED,
  // Delivery status aliases
  pending: DELIVERY_STATUS.PENDING,
  ready_for_assignment: DELIVERY_STATUS.READY_FOR_ASSIGNMENT,
  assigned: DELIVERY_STATUS.ASSIGNED,
  arrived_at_restaurant: DELIVERY_STATUS.ARRIVED_AT_RESTAURANT,
  reached_restaurant: DELIVERY_STATUS.ARRIVED_AT_RESTAURANT,
  reached_customer: DELIVERY_STATUS.REACHED_CUSTOMER,
  cash_collected: DELIVERY_STATUS.CASH_COLLECTED,
}

const normalizeStatus = (value) => {
  if (!value) return null
  const upper = String(value).trim().toUpperCase()
  // Check if already a valid constant
  if (Object.values(ORDER_STATUS).includes(upper) || Object.values(DELIVERY_STATUS).includes(upper)) {
    return upper
  }
  // Check aliases
  return STATUS_ALIASES[String(value).toLowerCase().trim()] ?? null
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

const logLifecycle = (tag, payload = {}) => {
  console.log(`[${tag}]`, {
    ...payload,
    timestamp: new Date().toISOString(),
  })
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

  const requestedDeliveryStatus = options.deliveryStatus ? normalizeStatus(options.deliveryStatus) : null
  const newDeliveryStatus =
    requestedDeliveryStatus && Object.values(DELIVERY_STATUS).includes(requestedDeliveryStatus)
      ? requestedDeliveryStatus
      : ORDER_TO_DELIVERY_MAP[normalizedStatus] || DELIVERY_STATUS.PENDING
  const isTerminal = isTerminalStatus(normalizedStatus)
  const isDelivered = normalizedStatus === ORDER_STATUS.DELIVERED
  const isCancelled = normalizedStatus === ORDER_STATUS.CANCELLED

  try {
    await client.query('BEGIN')

    // 1. Lock and fetch current order state
    const orderResult = await client.query(
      `SELECT
         o.id, o.status, o.delivery_status, o.payment_method, o.payment_type, o.total,
         o.payment_status, o.cash_collected, o.collected_cash_amount,
         o.delivery_partner_id, o.restaurant_id, o.user_id,
         o.route_distance_km, o.dropoff_distance_km,
         o.base_delivery_pay, o.distance_delivery_pay,
         o.surge_bonus, o.rain_bonus, o.night_bonus,
         o.cod_handling_bonus, o.tip_amount, o.estimated_earning,
         o.delivery_assigned_at, o.delivered_at, o.delivery_completed_at, o.cancelled_at,
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
    const currentRiderId = order.delivery_partner_id

    if (options.expectedRiderId && currentRiderId !== options.expectedRiderId) {
      const error = new Error('Order not assigned to this rider')
      error.status = 403
      throw error
    }

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
    if (isDelivered && !order.delivery_completed_at) {
      timestampUpdates.push(`delivery_completed_at = CURRENT_TIMESTAMP`)
    }
    if (isCancelled && !order.cancelled_at) {
      timestampUpdates.push(`cancelled_at = CURRENT_TIMESTAMP`)
    }

    const isCodOrder = String(order.payment_type || order.payment_method || '').toLowerCase() === 'cod'
    if (isDelivered && isCodOrder && !order.cash_collected) {
      timestampUpdates.push(`cash_collected = TRUE`)
      timestampUpdates.push(`collected_cash_amount = COALESCE(NULLIF(collected_cash_amount, 0), total)`)
      timestampUpdates.push(`cash_collected_at = COALESCE(cash_collected_at, CURRENT_TIMESTAMP)`)
      timestampUpdates.push(`payment_status = 'cod_collected'`)
    }

    const timestampClause = timestampUpdates.length > 0
      ? `, ${timestampUpdates.join(', ')}`
      : ''

    // 5. Update orders table
    const updateResult = await client.query(
      `UPDATE orders
       SET status = $1::text,
           delivery_status = $2::text,
           rider_assignment_status = CASE
             WHEN $2::text = 'ASSIGNED' THEN 'ACCEPTED'
             WHEN $2::text = 'DELIVERED' THEN 'DELIVERED'
             WHEN $2::text = 'CANCELLED' THEN 'CANCELLED'
             ELSE rider_assignment_status
           END,
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
      if (isTerminal) {
        logLifecycle('RIDER_CLEANUP_STARTED', {
          orderId,
          riderId,
          status: normalizedStatus,
          source: options.source || 'lifecycle_update',
        })
      }

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
      if (isTerminal) {
        await client.query(
          `DELETE FROM active_deliveries
           WHERE order_id = $1::uuid AND delivery_partner_id = $2::uuid`,
          [orderId, riderId]
        )
      } else {
        await client.query(
          `UPDATE active_deliveries
           SET status = $1::text,
               delivered_at = CASE WHEN $1::text = 'DELIVERED' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
               cancelled_at = CASE WHEN $1::text = 'CANCELLED' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
               updated_at = CURRENT_TIMESTAMP
           WHERE order_id = $2::uuid AND delivery_partner_id = $3::uuid`,
          [newDeliveryStatus, orderId, riderId]
        )
      }

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
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1::uuid
             AND (current_order_id = $2::uuid OR current_order_id IS NULL)`,
          [riderId, orderId]
        )

        logLifecycle('RIDER_CLEANUP_COMPLETED', {
          orderId,
          riderId,
          status: normalizedStatus,
        })
      }
    }

    let payoutAmount = 0
    let finalDistance = Number(order.dropoff_distance_km || order.route_distance_km || 0)
    let durationMinutes = 0

    // 10. Record earnings if delivered
    if (isDelivered && riderId) {
      const earningsService = require('../delivery/services/earningsService')
      const { computeRiderPayout } = require('../delivery/services/logisticsService')
      const assignedAt = order.delivery_assigned_at ? new Date(order.delivery_assigned_at) : new Date()
      const completedAt = new Date()
      durationMinutes = Math.max(0, Math.round((completedAt - assignedAt) / 60000))
      const payout = computeRiderPayout(finalDistance, {
        paymentMethod: order.payment_method,
        surgeBonus: Number(order.surge_bonus || 0),
        rainBonus: Number(order.rain_bonus || 0),
        codHandlingBonus: Number(order.cod_handling_bonus || 0),
        tipAmount: Number(order.tip_amount || 0),
      })
      payoutAmount = payout.total

      await client.query(
        `UPDATE orders
         SET base_delivery_pay = $1::numeric,
             distance_delivery_pay = $2::numeric,
             surge_bonus = $3::numeric,
             rain_bonus = $4::numeric,
             night_bonus = $5::numeric,
             cod_handling_bonus = $6::numeric,
             estimated_earning = $7::numeric,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $8::uuid`,
        [
          payout.basePay,
          payout.distancePay,
          payout.surgeBonus,
          payout.rainBonus,
          payout.nightBonus,
          payout.codHandlingBonus,
          payout.total,
          orderId,
        ]
      )

      await earningsService.recordEarning(riderId, orderId, finalDistance, durationMinutes, payoutAmount, 0, client)

      if (String(order.payment_method || '').toLowerCase() === 'cod') {
        await client.query(
          `INSERT INTO rider_wallets (delivery_partner_id, floating_cash, floating_cash_limit)
           VALUES ($1::uuid, $2::numeric, 1500)
           ON CONFLICT (delivery_partner_id)
           DO UPDATE SET
             floating_cash = rider_wallets.floating_cash + EXCLUDED.floating_cash,
             updated_at = CURRENT_TIMESTAMP`,
          [riderId, Number(order.total || 0)]
        )
      }
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
         SET payment_status = $1::text,
             cancellation_reason = $2::text
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
      payout_amount: payoutAmount,
      distance_km: finalDistance,
      duration_minutes: durationMinutes,
      source: options.source || 'lifecycle_update',
      timestamp: new Date().toISOString(),
    }

    if (isTerminal) {
      logLifecycle('ORDER_TERMINATED', {
        orderId,
        riderId,
        status: normalizedStatus,
        deliveryStatus: newDeliveryStatus,
        source: options.source || 'lifecycle_update',
      })
    }

    emitOrderStatusUpdated(orderId, {
      source: options.source || 'lifecycle_update',
      normalized_status: normalizedStatus,
      delivery_status: newDeliveryStatus,
      payout_amount: payoutAmount,
      distance_km: finalDistance,
      duration_minutes: durationMinutes,
    }).catch((err) => console.error('Failed to emit order status update:', err))

    emitDeliveryStatusUpdated(orderId, {
      source: options.source || 'lifecycle_update',
      status: newDeliveryStatus,
      order_status: normalizedStatus.toLowerCase(),
      payout_amount: payoutAmount,
      distance_km: finalDistance,
      duration_minutes: durationMinutes,
    }).catch((err) => console.error('Failed to emit delivery status update:', err))

    if (io && isTerminal) {
      const terminalOrderEvent = isDelivered ? 'ORDER_COMPLETED' : 'ORDER_CANCELLED'
      const orderTerminalPayload = {
        ...eventPayload,
        event: terminalOrderEvent,
        current_order_id: null,
        rider_status: riderId ? 'AVAILABLE' : undefined,
        active_delivery_id: null,
      }
      const terminalRooms = [
        'admin:global',
        `customer:${order.customer_id}`,
        `restaurant:${order.restaurant_id}`,
      ]

      if (riderId) {
        terminalRooms.push(`delivery_partner:${riderId}`)
      }

      terminalRooms.forEach((room) => {
        io.to(room).emit(terminalOrderEvent, orderTerminalPayload)
        io.to(room).emit('ORDER_MOVED_TO_HISTORY', {
          ...orderTerminalPayload,
          event: 'ORDER_MOVED_TO_HISTORY',
        })
      })
    }

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
      const riderRoom = `delivery_partner:${riderId}`
      const riderTerminalPayload = {
        order_id: orderId,
        rider_id: riderId,
        status: normalizedStatus,
        delivery_status: newDeliveryStatus,
        current_order_id: null,
        rider_status: 'AVAILABLE',
        active_delivery_id: null,
        payout_amount: payoutAmount,
        distance_km: finalDistance,
        duration_minutes: durationMinutes,
        message: isDelivered
          ? 'Delivery completed! Earnings added to your wallet.'
          : 'This delivery has been cancelled. You are now available for new orders.',
        timestamp: eventPayload.timestamp,
        source: options.source || 'lifecycle_update',
      }
      const terminalEvents = [
        eventName,
        isDelivered ? 'ORDER_COMPLETED' : 'ORDER_CANCELLED',
        'ORDER_MOVED_TO_HISTORY',
        'RIDER_ORDER_CLOSED',
        'RIDER_AVAILABLE',
        'ACTIVE_DELIVERY_CLEARED',
      ]

      terminalEvents.forEach((terminalEvent) => {
        logLifecycle('RIDER_SOCKET_EMIT', {
          orderId,
          riderId,
          room: riderRoom,
          event: terminalEvent,
        })
        io.to(riderRoom).emit(terminalEvent, riderTerminalPayload)
      })

      if (isDelivered) {
        try {
          const statsResult = await pool.query(
            `SELECT
               dp.total_deliveries,
               dp.average_rating,
               dp.is_online,
               COALESCE(rw.floating_cash, 0) AS floating_cash,
               COALESCE(SUM(de.amount) FILTER (WHERE DATE(de.earned_at) = CURRENT_DATE), 0) AS today_earnings,
               COUNT(de.id) FILTER (WHERE DATE(de.earned_at) = CURRENT_DATE)::int AS today_deliveries
             FROM delivery_partners dp
             LEFT JOIN rider_wallets rw ON rw.delivery_partner_id = dp.id
             LEFT JOIN delivery_earnings de ON de.delivery_partner_id = dp.id
             WHERE dp.id = $1::uuid
             GROUP BY dp.id, rw.id`,
            [riderId]
          )

          const stats = statsResult.rows[0]
          if (stats) {
            io.to(riderRoom).emit('delivery:earnings_updated', {
              earnings: {
                total_amount: Number(stats.today_earnings || 0),
                deliveries: Number(stats.today_deliveries || 0),
                payout_amount: payoutAmount,
                latest_order_id: orderId,
              },
              changed_at: eventPayload.timestamp,
            })

            io.to(riderRoom).emit('delivery:wallet_updated', {
              wallet: {
                floating_cash: Number(stats.floating_cash || 0),
                latest_order_id: orderId,
              },
              changed_at: eventPayload.timestamp,
            })

            io.to(riderRoom).emit('delivery:stats_updated', {
              stats: {
                total_deliveries: Number(stats.total_deliveries || 0),
                average_rating: Number(stats.average_rating || 0),
                is_online: Boolean(stats.is_online),
                floating_cash: Number(stats.floating_cash || 0),
                total_earned: Number(stats.today_earnings || 0),
              },
              changed_at: eventPayload.timestamp,
            })
          }
        } catch (error) {
          console.error('Failed to emit lifecycle rider stats update:', error.message)
        }
      }
    }

    // Emit to admin global
    if (io) {
      const eventName = isDelivered ? 'delivery_completed' : isCancelled ? 'order_cancelled' : 'order_status_updated'
      io.to('admin:global').emit(eventName, eventPayload)
      if (isTerminal) {
        io.to('admin:global').emit(isDelivered ? 'ORDER_COMPLETED' : 'ORDER_CANCELLED', eventPayload)
        io.to('admin:global').emit('ACTIVE_DELIVERY_CLEARED', eventPayload)
        io.to('admin:global').emit('RIDER_AVAILABLE', eventPayload)
      }
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
