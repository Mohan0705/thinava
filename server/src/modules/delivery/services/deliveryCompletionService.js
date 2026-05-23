const pool = require('../../../database/connection')
const { ORDER_DELIVERY_STATUSES, ASSIGNMENT_STATUSES } = require('../constants')
const { emitOrderStatusUpdated, emitDeliveryStatusUpdated } = require('../../../realtime/orderEvents')
const SocketEventsHandler = require('../../../realtime/socketEventsHandler')
const { getIO } = require('../../../realtime/socketServer')
const { validateOrderTransition } = require('../../orders/orderLifecycleService')

const ACTIVE_TERMINAL_STATUSES = [
  ORDER_DELIVERY_STATUSES.DELIVERED,
  ORDER_DELIVERY_STATUSES.CANCELLED,
]

const toNumber = (value) => Number(value || 0)

/**
 * MASTER DELIVERY COMPLETION SERVICE
 * 
 * This is the single source of truth for completing a delivery.
 * Called by:
 * - Rider app (via locationService.updateDeliveryStatus)
 * - Admin panel (via admin mark delivered action)
 * 
 * Guarantees:
 * - Idempotent: safe to call multiple times
 * - Atomic: all updates in one transaction
 * - Realtime: emits events to all connected clients
 * - Earnings: records rider payout exactly once
 */
const completeDelivery = async (orderId, partnerId, options = {}) => {
  const client = await pool.connect()
  const io = getIO()
  const socketHandler = new SocketEventsHandler()

  try {
    await client.query('BEGIN')

    // 1. Lock and validate order
    const orderResult = await client.query(
      `SELECT
         o.id, o.status, o.delivery_status, o.payment_method, o.total,
         o.delivery_partner_id, o.restaurant_id, o.user_id,
         o.route_distance_km, o.dropoff_distance_km,
         o.base_delivery_pay, o.distance_delivery_pay,
         o.surge_bonus, o.rain_bonus, o.night_bonus,
         o.cod_handling_bonus, o.tip_amount, o.estimated_earning,
         o.delivery_assigned_at, o.delivered_at,
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

    // SAFETY: Prevent duplicate completion
    if (order.delivery_status === ORDER_DELIVERY_STATUSES.DELIVERED) {
      await client.query('COMMIT')
      return {
        success: true,
        already_completed: true,
        message: 'Delivery already completed',
        order_id: orderId,
      }
    }

    // SAFETY: Prevent completing cancelled orders
    if (order.delivery_status === ORDER_DELIVERY_STATUSES.CANCELLED) {
      const error = new Error('Cannot complete a cancelled order')
      error.status = 400
      throw error
    }

    // Validate partner if provided
    if (partnerId && order.delivery_partner_id !== partnerId) {
      const error = new Error('Order not assigned to this rider')
      error.status = 403
      throw error
    }

    const resolvedPartnerId = partnerId || order.delivery_partner_id

    // 2. Calculate delivery duration
    const assignedAt = order.delivery_assigned_at ? new Date(order.delivery_assigned_at) : new Date()
    const completedAt = new Date()
    const durationMinutes = Math.round((completedAt - assignedAt) / 60000)

    // 3. Calculate final payout
    const payoutAmount =
      toNumber(order.estimated_earning) ||
      toNumber(order.base_delivery_pay) +
        toNumber(order.distance_delivery_pay) +
        toNumber(order.surge_bonus) +
        toNumber(order.rain_bonus) +
        toNumber(order.night_bonus) +
        toNumber(order.cod_handling_bonus) +
        toNumber(order.tip_amount)

    const finalDistance = toNumber(order.dropoff_distance_km || order.route_distance_km)

    // 4. Update order to delivered
    await client.query(
      `UPDATE orders
       SET status = 'delivered',
           delivery_status = $1,
           delivered_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2::uuid`,
      [ORDER_DELIVERY_STATUSES.DELIVERED, orderId]
    )

    // 5. Update delivery assignment
    await client.query(
      `UPDATE delivery_assignments
       SET assignment_status = $1,
           delivered_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $2::uuid AND delivery_partner_id = $3::uuid`,
      [ASSIGNMENT_STATUSES.DELIVERED, orderId, resolvedPartnerId]
    )

    // 6. Update active deliveries
    await client.query(
      `UPDATE active_deliveries
       SET status = $1,
           delivered_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $2::uuid AND delivery_partner_id = $3::uuid`,
      [ORDER_DELIVERY_STATUSES.DELIVERED, orderId, resolvedPartnerId]
    )

    // 7. Update delivery tracking
    await client.query(
      `UPDATE delivery_tracking
       SET last_status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $2::uuid AND delivery_partner_id = $3::uuid`,
      [ORDER_DELIVERY_STATUSES.DELIVERED, orderId, resolvedPartnerId]
    )

    // 8. Free up rider for new orders
    await client.query(
      `UPDATE delivery_partners
       SET current_order_id = NULL,
           current_status = 'AVAILABLE',
           total_deliveries = total_deliveries + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [resolvedPartnerId]
    )

    // 9. Record rider earnings (idempotent - checked inside recordEarning)
    if (resolvedPartnerId) {
      const earningsService = require('./earningsService')
      await earningsService.recordEarning(
        resolvedPartnerId,
        orderId,
        finalDistance,
        durationMinutes,
        payoutAmount,
        0,
        client
      )
    }

    // 9b. Update floating cash for COD orders
    if (resolvedPartnerId && order.payment_method === 'cod') {
      await client.query(
        `UPDATE rider_wallets
         SET floating_cash = floating_cash + $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE delivery_partner_id = $1`,
        [resolvedPartnerId, order.total]
      )
    }

    await client.query('COMMIT')

    // 10. Emit realtime events (outside transaction)
    const completionPayload = {
      order_id: orderId,
      rider_id: resolvedPartnerId,
      rider_name: order.rider_name,
      restaurant_id: order.restaurant_id,
      restaurant_name: order.restaurant_name,
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      payout_amount: payoutAmount,
      distance_km: finalDistance,
      duration_minutes: durationMinutes,
      completed_at: completedAt.toISOString(),
      source: options.source || 'delivery_completion',
    }

    // Emit via orderEvents (broadcasts to admin, customer, restaurant, rider rooms)
    emitOrderStatusUpdated(orderId, {
      source: options.source || 'delivery_completion',
      normalized_status: 'DELIVERED',
      delivery_status: ORDER_DELIVERY_STATUSES.DELIVERED,
      payout_amount: payoutAmount,
      duration_minutes: durationMinutes,
    }).catch((err) => console.error('Failed to emit order status update:', err))

    emitDeliveryStatusUpdated(orderId, {
      source: options.source || 'delivery_completion',
      status: ORDER_DELIVERY_STATUSES.DELIVERED,
      order_status: 'delivered',
    }).catch((err) => console.error('Failed to emit delivery status update:', err))

    // Emit granular events via SocketEventsHandler
    socketHandler.emitOrderDelivered(orderId, {
      userId: order.customer_id,
    }).catch((err) => console.error('Failed to emit order delivered event:', err))

    // Emit to rider room directly
    if (io && resolvedPartnerId) {
      const riderRoom = `delivery_partner:${resolvedPartnerId}`
      
      // STEP 3: Log delivery_completed emission
      console.log('[EMIT_delivery_completed]', {
        orderId,
        riderId: resolvedPartnerId,
        room: riderRoom,
        payout: payoutAmount,
      })
      
      io.to(riderRoom).emit('delivery_completed', {
        order_id: orderId,
        payout_amount: payoutAmount,
        distance_km: finalDistance,
        duration_minutes: durationMinutes,
        message: 'Delivery completed! Earnings added to your wallet.',
        timestamp: completedAt.toISOString(),
      })

      // 11. Fetch and emit updated rider stats to dashboard
      try {
        const riderStatsResult = await pool.query(
          `SELECT
             dp.id,
             dp.full_name,
             dp.total_deliveries,
             dp.average_rating,
             dp.is_online,
             COALESCE(rw.floating_cash, 0) AS floating_cash,
             COALESCE(rw.total_earned, 0) AS total_earned
           FROM delivery_partners dp
           LEFT JOIN rider_wallets rw ON rw.delivery_partner_id = dp.id
           WHERE dp.id = $1::uuid`,
          [resolvedPartnerId]
        )

        if (riderStatsResult.rows.length > 0) {
          const riderStats = riderStatsResult.rows[0]

          // STEP 3: Log earnings_updated emission
          console.log('[EMIT_earnings_updated]', {
            riderId: resolvedPartnerId,
            room: riderRoom,
            totalEarnings: riderStats.total_earned,
            deliveries: riderStats.total_deliveries,
          })

          // Emit earnings update
          io.to(riderRoom).emit('delivery:earnings_updated', {
            earnings: {
              total_amount: Number(riderStats.total_earned || 0),
              deliveries: Number(riderStats.total_deliveries || 0),
              payout_amount: payoutAmount,
              latest_order_id: orderId,
            },
            changed_at: completedAt.toISOString(),
          })

          // Emit wallet update
          if (order.payment_method === 'cod') {
            console.log('[EMIT_wallet_updated]', {
              riderId: resolvedPartnerId,
              room: riderRoom,
              floatingCash: riderStats.floating_cash,
            })

            io.to(riderRoom).emit('delivery:wallet_updated', {
              wallet: {
                floating_cash: Number(riderStats.floating_cash || 0),
                latest_order_id: orderId,
              },
              changed_at: completedAt.toISOString(),
            })
          }

          // STEP 3: Log stats_updated emission
          console.log('[EMIT_stats_updated]', {
            riderId: resolvedPartnerId,
            room: riderRoom,
            deliveries: riderStats.total_deliveries,
            rating: riderStats.average_rating,
            earnings: riderStats.total_earned,
            floating_cash: riderStats.floating_cash,
          })

          // Emit stats update (consolidated)
          io.to(riderRoom).emit('delivery:stats_updated', {
            stats: {
              total_deliveries: Number(riderStats.total_deliveries || 0),
              average_rating: Number(riderStats.average_rating || 0),
              is_online: Boolean(riderStats.is_online),
              floating_cash: Number(riderStats.floating_cash || 0),
              total_earned: Number(riderStats.total_earned || 0),
            },
            changed_at: completedAt.toISOString(),
          })

          console.log('[REALTIME_STATS]', {
            riderId: resolvedPartnerId,
            event: 'delivery_completed',
            stats: {
              deliveries: riderStats.total_deliveries,
              earnings: riderStats.total_earned,
              floating_cash: riderStats.floating_cash,
              rating: riderStats.average_rating,
            },
          })
        }
      } catch (err) {
        console.error('[REALTIME_STATS_ERROR] Failed to emit rider stats:', err.message)
      }
    }

    // Emit to admin global
    if (io) {
      io.to('admin:global').emit('delivery_completed', completionPayload)
    }

    return {
      success: true,
      order_id: orderId,
      rider_id: resolvedPartnerId,
      payout_amount: payoutAmount,
      distance_km: finalDistance,
      duration_minutes: durationMinutes,
      completed_at: completedAt.toISOString(),
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * CANCEL DELIVERY SERVICE
 * 
 * Master cancellation flow that syncs across all systems.
 * Called by:
 * - Admin panel cancel action
 * - Restaurant cancel action
 * - Rider cancel action (with restrictions)
 */
const cancelDelivery = async (orderId, reason, cancelledBy, options = {}) => {
  const client = await pool.connect()
  const io = getIO()
  const socketHandler = new SocketEventsHandler()

  try {
    await client.query('BEGIN')

    // 1. Lock and validate order
    const orderResult = await client.query(
      `SELECT
         o.id, o.status, o.delivery_status, o.payment_method, o.total,
         o.delivery_partner_id, o.restaurant_id, o.user_id,
         o.cancellation_reason, o.delivered_at,
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

    // Validate transition — blocks cancel on delivered/cancelled terminal states
    try {
      validateOrderTransition(order.status, 'CANCELLED')
    } catch (transitionError) {
      await client.query('ROLLBACK')
      throw transitionError
    }

    // Determine payment refund status
    let paymentStatus = order.payment_status || 'pending'
    if (order.payment_method === 'cod') {
      paymentStatus = 'not_collected'
    } else if (paymentStatus === 'paid') {
      paymentStatus = 'refunded'
    } else {
      paymentStatus = 'refund_processing'
    }

    const riderId = order.delivery_partner_id

    // 2. Update order to cancelled
    await client.query(
      `UPDATE orders
       SET status = 'cancelled',
           delivery_status = $1,
           payment_status = $2,
           cancellation_reason = $3,
           cancelled_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4::uuid`,
      [ORDER_DELIVERY_STATUSES.CANCELLED, paymentStatus, reason || 'Cancelled by ' + cancelledBy, orderId]
    )

    // 3. Update delivery assignment if rider was assigned
    if (riderId) {
      await client.query(
        `UPDATE delivery_assignments
         SET assignment_status = $1,
             cancelled_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $2::uuid AND delivery_partner_id = $3::uuid`,
        [ASSIGNMENT_STATUSES.CANCELLED, orderId, riderId]
      )

      // 4. Update active deliveries
      await client.query(
        `UPDATE active_deliveries
         SET status = $1,
             cancelled_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $2::uuid AND delivery_partner_id = $3::uuid`,
        [ORDER_DELIVERY_STATUSES.CANCELLED, orderId, riderId]
      )

      // 5. Update delivery tracking
      await client.query(
        `UPDATE delivery_tracking
         SET last_status = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $2::uuid AND delivery_partner_id = $3::uuid`,
        [ORDER_DELIVERY_STATUSES.CANCELLED, orderId, riderId]
      )

      // 6. Free up rider for new orders
      await client.query(
        `UPDATE delivery_partners
         SET current_order_id = NULL,
             current_status = 'AVAILABLE',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1::uuid`,
        [riderId]
      )
    }

    await client.query('COMMIT')

    // 7. Emit realtime events
    const cancellationPayload = {
      order_id: orderId,
      rider_id: riderId,
      rider_name: order.rider_name,
      restaurant_id: order.restaurant_id,
      restaurant_name: order.restaurant_name,
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      reason: reason || 'Cancelled by ' + cancelledBy,
      cancelled_by: cancelledBy,
      payment_status: paymentStatus,
      payment_method: order.payment_method,
      refund_status: paymentStatus === 'refunded' ? 'Refunded' : paymentStatus === 'cancelled' ? 'Cancelled' : 'Refund Pending',
      cancelled_at: new Date().toISOString(),
      source: options.source || 'cancellation',
    }

    // Emit via orderEvents
    emitOrderStatusUpdated(orderId, {
      source: options.source || 'cancellation',
      normalized_status: 'CANCELLED',
      delivery_status: ORDER_DELIVERY_STATUSES.CANCELLED,
      reason: reason || 'Cancelled by ' + cancelledBy,
      payment_status: paymentStatus,
    }).catch((err) => console.error('Failed to emit order status update:', err))

    emitDeliveryStatusUpdated(orderId, {
      source: options.source || 'cancellation',
      status: ORDER_DELIVERY_STATUSES.CANCELLED,
      order_status: 'cancelled',
      reason: reason || 'Cancelled by ' + cancelledBy,
    }).catch((err) => console.error('Failed to emit delivery status update:', err))

    // Emit granular cancellation event to customer
    socketHandler.emitOrderRejected(orderId, {
      userId: order.customer_id,
    }, reason || 'Order cancelled').catch((err) => console.error('Failed to emit order rejected event:', err))

    // Emit to rider room
    if (io && riderId) {
      io.to(`delivery_partner:${riderId}`).emit('order_cancelled', {
        order_id: orderId,
        reason: reason || 'Order cancelled',
        message: 'This delivery has been cancelled. You are now available for new orders.',
        timestamp: new Date().toISOString(),
      })
    }

    // Emit to admin global
    if (io) {
      io.to('admin:global').emit('order_cancelled', cancellationPayload)
    }

    return {
      success: true,
      order_id: orderId,
      rider_id: riderId,
      reason: reason || 'Cancelled by ' + cancelledBy,
      payment_status: paymentStatus,
      refund_status: cancellationPayload.refund_status,
      cancelled_at: cancellationPayload.cancelled_at,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Get delivery completion details for an order
 */
const getDeliveryCompletionDetails = async (orderId) => {
  const result = await pool.query(
    `SELECT
       o.id, o.status, o.delivery_status, o.delivered_at, o.cancelled_at,
       o.delivery_partner_id, o.restaurant_id, o.user_id,
       o.route_distance_km, o.dropoff_distance_km,
       o.base_delivery_pay, o.distance_delivery_pay,
       o.surge_bonus, o.rain_bonus, o.night_bonus,
       o.cod_handling_bonus, o.tip_amount, o.estimated_earning,
       o.delivery_assigned_at,
       de.amount AS earned_amount, de.incentive AS earned_incentive,
       de.earned_at, de.distance_km AS earned_distance, de.duration_minutes AS earned_duration,
       dp.full_name AS rider_name,
       r.name AS restaurant_name,
       u.name AS customer_name
     FROM orders o
     LEFT JOIN delivery_earnings de ON de.order_id = o.id
     LEFT JOIN delivery_partners dp ON dp.id = o.delivery_partner_id
     LEFT JOIN restaurants r ON r.id = o.restaurant_id
     LEFT JOIN users u ON u.id = o.user_id
     WHERE o.id = $1::uuid`,
    [orderId]
  )

  if (result.rows.length === 0) {
    const error = new Error('Order not found')
    error.status = 404
    throw error
  }

  const row = result.rows[0]
  const assignedAt = row.delivery_assigned_at ? new Date(row.delivery_assigned_at) : null
  const deliveredAt = row.delivered_at ? new Date(row.delivered_at) : null
  const durationMinutes = assignedAt && deliveredAt
    ? Math.round((deliveredAt - assignedAt) / 60000)
    : row.earned_duration || 0

  return {
    order_id: row.id,
    status: row.status,
    delivery_status: row.delivery_status,
    delivered_at: row.delivered_at,
    cancelled_at: row.cancelled_at,
    rider_id: row.delivery_partner_id,
    rider_name: row.rider_name,
    restaurant_id: row.restaurant_id,
    restaurant_name: row.restaurant_name,
    customer_id: row.user_id,
    customer_name: row.customer_name,
    distance_km: toNumber(row.earned_distance || row.dropoff_distance_km || row.route_distance_km),
    duration_minutes: durationMinutes,
    payout: {
      amount: toNumber(row.earned_amount || row.estimated_earning),
      incentive: toNumber(row.earned_incentive),
      breakdown: {
        base_pay: toNumber(row.base_delivery_pay),
        distance_pay: toNumber(row.distance_delivery_pay),
        surge_bonus: toNumber(row.surge_bonus),
        rain_bonus: toNumber(row.rain_bonus),
        night_bonus: toNumber(row.night_bonus),
        cod_handling: toNumber(row.cod_handling_bonus),
        tip: toNumber(row.tip_amount),
      },
    },
    earned_at: row.earned_at,
  }
}

module.exports = {
  completeDelivery,
  cancelDelivery,
  getDeliveryCompletionDetails,
}
