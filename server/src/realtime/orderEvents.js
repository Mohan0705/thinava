const pool = require('../database/connection')
const { emitToRoom, ROOMS } = require('./socketServer')

const EVENTS = {
  ADMIN_ORDER_UPDATED: 'admin:order_updated',
  CUSTOMER_ORDER_UPDATED: 'customer:order_updated',
  RESTAURANT_ORDER_UPDATED: 'restaurant:order_updated',
  DELIVERY_ACTIVE_ORDER_UPDATED: 'delivery:active_order_updated',
  DELIVERY_OFFER_AVAILABLE: 'delivery:offer_available',
  DELIVERY_OFFER_REMOVED: 'delivery:offer_removed',
  DELIVERY_STATUS_UPDATED: 'delivery:status_updated',
  DELIVERY_LOCATION_UPDATED: 'delivery:location_updated',
}

const getOrderRealtimeSnapshot = async (orderId) => {
  const result = await pool.query(
    `SELECT
       o.id,
       o.user_id,
       o.restaurant_id,
       o.delivery_partner_id,
       o.status,
       o.delivery_status,
       o.payment_method,
       o.total,
       o.route_distance_km,
       o.estimated_total_eta_minutes,
       o.created_at,
       o.updated_at,
       u.name AS customer_name,
       r.name AS restaurant_name,
       dp.full_name AS rider_name,
       a.full_address AS customer_address,
       a.latitude AS customer_latitude,
       a.longitude AS customer_longitude,
       r.latitude AS restaurant_latitude,
       r.longitude AS restaurant_longitude
     FROM orders o
     JOIN users u ON u.id = o.user_id
     JOIN restaurants r ON r.id = o.restaurant_id
     LEFT JOIN delivery_partners dp ON dp.id = o.delivery_partner_id
     LEFT JOIN addresses a ON a.id = o.address_id
     WHERE o.id = $1`,
    [orderId]
  )

  const row = result.rows[0]
  if (!row) {
    return null
  }

  return {
    id: row.id,
    user_id: row.user_id,
    restaurant_id: row.restaurant_id,
    delivery_partner_id: row.delivery_partner_id,
    status: row.status,
    delivery_status: row.delivery_status,
    payment_method: row.payment_method,
    total: Number(row.total || 0),
    route_distance_km: row.route_distance_km !== null ? Number(row.route_distance_km) : null,
    estimated_total_eta_minutes:
      row.estimated_total_eta_minutes !== null ? Number(row.estimated_total_eta_minutes) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    customer_name: row.customer_name,
    restaurant_name: row.restaurant_name,
    rider_name: row.rider_name,
    customer_address: row.customer_address,
    customer_latitude: row.customer_latitude !== null ? Number(row.customer_latitude) : null,
    customer_longitude: row.customer_longitude !== null ? Number(row.customer_longitude) : null,
    restaurant_latitude: row.restaurant_latitude !== null ? Number(row.restaurant_latitude) : null,
    restaurant_longitude: row.restaurant_longitude !== null ? Number(row.restaurant_longitude) : null,
  }
}

const emitOrderScopedUpdate = async (orderId, event, extraPayload = {}) => {
  const order = await getOrderRealtimeSnapshot(orderId)
  if (!order) {
    return null
  }

  const payload = {
    event,
    order,
    changed_at: new Date().toISOString(),
    ...extraPayload,
  }

  emitToRoom(ROOMS.ADMIN_GLOBAL, EVENTS.ADMIN_ORDER_UPDATED, payload)
  emitToRoom(ROOMS.customer(order.user_id), EVENTS.CUSTOMER_ORDER_UPDATED, payload)
  emitToRoom(ROOMS.restaurant(order.restaurant_id), EVENTS.RESTAURANT_ORDER_UPDATED, payload)

  if (order.delivery_partner_id) {
    emitToRoom(
      ROOMS.deliveryPartner(order.delivery_partner_id),
      EVENTS.DELIVERY_ACTIVE_ORDER_UPDATED,
      payload
    )
  }

  return payload
}

const emitOrderCreated = async (orderId) => {
  const payload = await emitOrderScopedUpdate(orderId, 'order_created')

  if (payload) {
    emitToRoom(ROOMS.DELIVERY_FLEET, EVENTS.DELIVERY_OFFER_REMOVED, {
      order_id: orderId,
      reason: 'awaiting_restaurant_acceptance',
      changed_at: payload.changed_at,
    })
  }

  return payload
}

const emitOrderReadyForDispatch = async (orderId) => {
  const payload = await emitOrderScopedUpdate(orderId, 'order_ready_for_dispatch')

  if (payload) {
    emitToRoom(ROOMS.DELIVERY_FLEET, EVENTS.DELIVERY_OFFER_AVAILABLE, payload)
  }

  return payload
}

const emitOrderAssigned = async (orderId, extraPayload = {}) => {
  const payload = await emitOrderScopedUpdate(orderId, 'order_assigned', extraPayload)

  if (payload) {
    emitToRoom(ROOMS.DELIVERY_FLEET, EVENTS.DELIVERY_OFFER_REMOVED, {
      order_id: orderId,
      reason: 'assigned',
      delivery_partner_id: payload.order.delivery_partner_id,
      changed_at: payload.changed_at,
    })
  }

  return payload
}

const emitOrderStatusUpdated = async (orderId, extraPayload = {}) =>
  emitOrderScopedUpdate(orderId, 'order_status_updated', extraPayload)

const emitDeliveryStatusUpdated = async (orderId, extraPayload = {}) =>
  emitOrderScopedUpdate(orderId, 'delivery_status_updated', extraPayload)

const emitDeliveryLocationUpdated = async (orderId, extraPayload = {}) => {
  const payload = await emitOrderScopedUpdate(orderId, 'delivery_location_updated', extraPayload)

  if (!payload?.order?.delivery_partner_id) {
    return payload
  }

  emitToRoom(ROOMS.customer(payload.order.user_id), EVENTS.DELIVERY_LOCATION_UPDATED, payload)
  emitToRoom(ROOMS.restaurant(payload.order.restaurant_id), EVENTS.DELIVERY_LOCATION_UPDATED, payload)
  emitToRoom(ROOMS.ADMIN_GLOBAL, EVENTS.DELIVERY_LOCATION_UPDATED, payload)
  emitToRoom(
    ROOMS.deliveryPartner(payload.order.delivery_partner_id),
    EVENTS.DELIVERY_LOCATION_UPDATED,
    payload
  )

  return payload
}

module.exports = {
  EVENTS,
  emitDeliveryLocationUpdated,
  emitDeliveryStatusUpdated,
  emitOrderAssigned,
  emitOrderCreated,
  emitOrderReadyForDispatch,
  emitOrderStatusUpdated,
  getOrderRealtimeSnapshot,
}
