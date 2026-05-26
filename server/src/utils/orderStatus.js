/**
 * THINAVA Centralized Order Status Normalization
 *
 * SINGLE source of truth for all order status comparisons.
 * Every route and service MUST use this module instead of inline string checks.
 *
 * Database stores status as lowercase: 'placed', 'delivered', 'cancelled'
 * This module normalizes all input to lowercase for comparison.
 */

const ORDER_STATUS = {
  PLACED: 'placed',
  ACCEPTED: 'accepted',
  PREPARING: 'preparing',
  READY_FOR_PICKUP: 'ready_for_pickup',
  PICKED_UP: 'picked_up',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  CONFIRMED: 'confirmed',
}

const DELIVERY_STATUS = {
  PENDING: 'pending',
  READY_FOR_ASSIGNMENT: 'ready_for_assignment',
  ASSIGNED: 'assigned',
  ARRIVED_AT_RESTAURANT: 'arrived_at_restaurant',
  PICKED_UP: 'picked_up',
  ON_THE_WAY: 'on_the_way',
  REACHED_CUSTOMER: 'reached_customer',
  CASH_COLLECTED: 'cash_collected',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
}

const TERMINAL_STATUSES = new Set([
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.REJECTED,
])

/**
 * Normalize any input to lowercase.
 * Handles null, undefined, uppercase, mixed case.
 */
const normalize = (value) => {
  if (!value || typeof value !== 'string') return ''
  return value.toLowerCase().trim()
}

/**
 * Check if a status is delivered (any casing, any format).
 */
const isDelivered = (status) => {
  return normalize(status) === ORDER_STATUS.DELIVERED
}

/**
 * Check if a status is terminal (delivered, cancelled, rejected).
 */
const isTerminal = (status) => {
  return TERMINAL_STATUSES.has(normalize(status))
}

/**
 * Check if a status is cancelled or rejected.
 */
const isCancelled = (status) => {
  const n = normalize(status)
  return n === ORDER_STATUS.CANCELLED || n === ORDER_STATUS.REJECTED
}

module.exports = {
  ORDER_STATUS,
  DELIVERY_STATUS,
  TERMINAL_STATUSES,
  normalize,
  isDelivered,
  isTerminal,
  isCancelled,
}
