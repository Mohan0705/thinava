/**
 * THINAVA Frontend Order Status Constants
 * 
 * Single source of truth for ALL order status values in the frontend.
 * ALL statuses are UPPERCASE to match backend constants.
 */

export const ORDER_STATUS = {
  PLACED: 'PLACED',
  ACCEPTED: 'ACCEPTED',
  PREPARING: 'PREPARING',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
}

export const DELIVERY_STATUS = {
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  ARRIVED_AT_RESTAURANT: 'ARRIVED_AT_RESTAURANT',
  PICKED_UP: 'PICKED_UP',
  REACHED_CUSTOMER: 'REACHED_CUSTOMER',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
}

export const TERMINAL_STATUSES = [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED]

export const isTerminalStatus = (status: string): boolean => {
  return TERMINAL_STATUSES.includes(status?.toUpperCase())
}

export const normalizeStatus = (value: string | null | undefined): string | null => {
  if (!value) return null
  const upper = value.trim().toUpperCase()
  if (Object.values(ORDER_STATUS).includes(upper as any)) return upper
  if (Object.values(DELIVERY_STATUS).includes(upper as any)) return upper
  return null
}

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    PLACED: 'Placed',
    ACCEPTED: 'Accepted',
    PREPARING: 'Preparing',
    READY_FOR_PICKUP: 'Ready for Pickup',
    OUT_FOR_DELIVERY: 'Out for Delivery',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
  }
  return labels[status?.toUpperCase()] || status || 'Unknown'
}

export const getDeliveryStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    PENDING: 'Pending',
    ASSIGNED: 'Assigned',
    ARRIVED_AT_RESTAURANT: 'At Restaurant',
    PICKED_UP: 'Picked Up',
    REACHED_CUSTOMER: 'Reached Customer',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
  }
  return labels[status?.toUpperCase()] || status || 'Unknown'
}
