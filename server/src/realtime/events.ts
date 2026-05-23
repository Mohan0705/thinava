/**
 * Centralized Realtime Event Constants
 * 
 * Ensures consistency between backend emission and frontend listeners
 * All event names defined here to prevent typos and mismatches
 */

export const REALTIME_EVENTS = {
  // Order Events - Admin Scope
  ADMIN_ORDER_UPDATED: 'admin:order_updated',
  
  // Order Events - Customer Scope
  CUSTOMER_ORDER_UPDATED: 'customer:order_updated',
  
  // Order Events - Restaurant Scope
  RESTAURANT_ORDER_UPDATED: 'restaurant:order_updated',
  
  // Delivery Partner Events - Offers
  DELIVERY_OFFER_AVAILABLE: 'delivery:offer_available',
  DELIVERY_OFFER_REMOVED: 'delivery:offer_removed',
  
  // Delivery Partner Events - Active Order
  DELIVERY_ACTIVE_ORDER_UPDATED: 'delivery:active_order_updated',
  DELIVERY_STATUS_UPDATED: 'delivery:status_updated',
  DELIVERY_LOCATION_UPDATED: 'delivery:location_updated',
  
  // Delivery Partner Events - Stats & Wallet
  DELIVERY_STATS_UPDATED: 'delivery:stats_updated',
  DELIVERY_EARNINGS_UPDATED: 'delivery:earnings_updated',
  DELIVERY_WALLET_UPDATED: 'delivery:wallet_updated',
  DELIVERY_RATING_UPDATED: 'delivery:rating_updated',
} as const

export const REALTIME_ROOM_NAMES = {
  ADMIN_GLOBAL: 'admin:global',
  DELIVERY_FLEET: 'delivery:fleet',
  ADMIN: (adminId: string | number) => `admin:${adminId}`,
  CUSTOMER: (userId: string | number) => `customer:${userId}`,
  DELIVERY_PARTNER: (partnerId: string | number) => `delivery_partner:${partnerId}`,
  RESTAURANT: (restaurantId: string | number) => `restaurant:${restaurantId}`,
} as const

export type RealtimeEventName = typeof REALTIME_EVENTS[keyof typeof REALTIME_EVENTS]
