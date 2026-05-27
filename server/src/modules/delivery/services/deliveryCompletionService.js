const pool = require('../../../database/connection')
const { ORDER_DELIVERY_STATUSES, ASSIGNMENT_STATUSES } = require('../constants')
const { emitOrderStatusUpdated, emitDeliveryStatusUpdated } = require('../../../realtime/orderEvents')
const SocketEventsHandler = require('../../../realtime/socketEventsHandler')
const { getIO } = require('../../../realtime/socketServer')
const {
  ORDER_STATUS,
  updateOrderLifecycleState,
  validateOrderTransition,
} = require('../../orders/orderLifecycleService')
const { computeRiderPayout } = require('./logisticsService')

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
 * 
 * [TERMINAL LIFECYCLE FIX] Delegates to authoritative orderLifecycleService.
 * This ensures ALL terminal events (ORDER_COMPLETED, RIDER_AVAILABLE, etc.)
 * are emitted consistently by ONE function.
 */
const completeDelivery = async (orderId, partnerId, options = {}) => {
  console.log('[DELIVERY_COMPLETE_REQUEST]', {
    orderId,
    partnerId,
    source: options.source || 'delivery_completion',
    timestamp: new Date().toISOString(),
  })

  try {
    const result = await updateOrderLifecycleState(orderId, ORDER_STATUS.DELIVERED, {
      source: options.source || 'delivery_completion',
      deliveryStatus: ORDER_DELIVERY_STATUSES.DELIVERED,
      expectedRiderId: partnerId || undefined,
      force: !partnerId,
    })

    console.log('[DELIVERY_COMPLETE_SUCCESS]', {
      orderId,
      riderId: result.rider_id,
      isTerminal: result.is_terminal,
    })

    return result
  } catch (error) {
    console.error('[DELIVERY_COMPLETE_FAILED]', {
      orderId,
      error: error.message,
      statusCode: error.status || error.statusCode,
    })
    throw error
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
  console.log('[DELIVERY_CANCEL_REQUEST]', {
    orderId,
    reason,
    cancelledBy,
    source: options.source || 'cancellation',
    timestamp: new Date().toISOString(),
  })

  try {
    const result = await updateOrderLifecycleState(orderId, ORDER_STATUS.CANCELLED, {
      source: options.source || 'cancellation',
      deliveryStatus: ORDER_DELIVERY_STATUSES.CANCELLED,
      reason: reason || `Cancelled by ${cancelledBy}`,
      force: true,
    })

    console.log('[DELIVERY_CANCEL_SUCCESS]', {
      orderId,
      riderId: result.rider_id,
      isTerminal: result.is_terminal,
    })

    return result
  } catch (error) {
    console.error('[DELIVERY_CANCEL_FAILED]', {
      orderId,
      error: error.message,
      statusCode: error.status || error.statusCode,
    })
    throw error
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
