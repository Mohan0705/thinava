const pool = require('../database/connection')
const { emitToRoom, ROOMS } = require('./socketServer')

const EVENTS = {
  ADMIN_ORDER_UPDATED: 'admin:order_updated',
  CUSTOMER_ORDER_UPDATED: 'customer:order_updated',
  RESTAURANT_ORDER_UPDATED: 'restaurant:order_updated',
  DELIVERY_ACTIVE_ORDER_UPDATED: 'delivery:active_order_updated',
  DELIVERY_ASSIGNMENT_REQUEST: 'delivery:assignment_request',
  DELIVERY_OFFER_AVAILABLE: 'delivery:offer_available',
  DELIVERY_OFFER_REMOVED: 'delivery:offer_removed',
  DELIVERY_STATUS_UPDATED: 'delivery:status_updated',
  DELIVERY_LOCATION_UPDATED: 'delivery:location_updated',
}

const LIFECYCLE_EVENTS = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_CONFIRMED: 'ORDER_CONFIRMED',
  ORDER_PREPARING: 'ORDER_PREPARING',
  ORDER_READY: 'ORDER_READY',
  RIDER_ASSIGNMENT_REQUEST: 'RIDER_ASSIGNMENT_REQUEST',
  ORDER_ASSIGNED: 'ORDER_ASSIGNED',
  RIDER_ASSIGNED: 'RIDER_ASSIGNED',
  RIDER_ACCEPTED: 'RIDER_ACCEPTED',
  RIDER_REJECTED: 'RIDER_REJECTED',
  RIDER_ARRIVED: 'RIDER_ARRIVED',
  PICKED_UP: 'PICKED_UP',
  ARRIVING: 'ARRIVING',
  CASH_COLLECTED: 'CASH_COLLECTED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  ORDER_MOVED_TO_HISTORY: 'ORDER_MOVED_TO_HISTORY',
}

const normalizeUpper = (value) => String(value || '').trim().toUpperCase()

const resolveLifecycleEventName = (event, payload) => {
  const orderStatus = normalizeUpper(payload?.normalized_status || payload?.order?.status)
  const deliveryStatus = normalizeUpper(payload?.status || payload?.delivery_status || payload?.order?.delivery_status)

  if (event === 'order_assigned') return LIFECYCLE_EVENTS.ORDER_ASSIGNED
  if (event === 'order_ready_for_dispatch') return LIFECYCLE_EVENTS.ORDER_READY
  if (event === 'order_created') return LIFECYCLE_EVENTS.ORDER_CREATED
  if (event === 'rider_assignment_request') return LIFECYCLE_EVENTS.RIDER_ASSIGNMENT_REQUEST
  if (event === 'rider_rejected') return LIFECYCLE_EVENTS.RIDER_REJECTED

  if (orderStatus === 'ACCEPTED' || orderStatus === 'CONFIRMED') return LIFECYCLE_EVENTS.ORDER_CONFIRMED
  if (orderStatus === 'PREPARING') return LIFECYCLE_EVENTS.ORDER_PREPARING
  if (orderStatus === 'READY_FOR_PICKUP' || orderStatus === 'READY_FOR_DELIVERY') return LIFECYCLE_EVENTS.ORDER_READY
  if (orderStatus === 'DELIVERED' || deliveryStatus === 'DELIVERED') return LIFECYCLE_EVENTS.DELIVERED
  if (orderStatus === 'CANCELLED' || deliveryStatus === 'CANCELLED') return LIFECYCLE_EVENTS.CANCELLED

  if (deliveryStatus === 'ASSIGNED') return LIFECYCLE_EVENTS.RIDER_ACCEPTED
  if (deliveryStatus === 'ARRIVED_AT_RESTAURANT' || deliveryStatus === 'AT_RESTAURANT') return LIFECYCLE_EVENTS.RIDER_ARRIVED
  if (deliveryStatus === 'PICKED_UP') return LIFECYCLE_EVENTS.PICKED_UP
  if (deliveryStatus === 'REACHED_CUSTOMER' || deliveryStatus === 'AT_CUSTOMER') return LIFECYCLE_EVENTS.ARRIVING
  if (deliveryStatus === 'CASH_COLLECTED') return LIFECYCLE_EVENTS.CASH_COLLECTED

  return null
}

const emitLifecycleAlias = (order, eventName, payload) => {
  if (!eventName) return

  const aliasPayload = {
    ...payload,
    lifecycle_event: eventName,
    order_id: order.id,
  }

  emitToRoom(ROOMS.ADMIN_GLOBAL, eventName, aliasPayload)
  emitToRoom(ROOMS.customer(order.user_id), eventName, aliasPayload)
  emitToRoom(ROOMS.restaurant(order.restaurant_id), eventName, aliasPayload)

  if (order.delivery_partner_id) {
    emitToRoom(ROOMS.deliveryPartner(order.delivery_partner_id), eventName, aliasPayload)
  }

  if (eventName === LIFECYCLE_EVENTS.ORDER_ASSIGNED) {
    const riderAssignedPayload = {
      ...aliasPayload,
      lifecycle_event: LIFECYCLE_EVENTS.RIDER_ASSIGNED,
    }
    emitToRoom(ROOMS.ADMIN_GLOBAL, LIFECYCLE_EVENTS.RIDER_ASSIGNED, riderAssignedPayload)
    emitToRoom(ROOMS.customer(order.user_id), LIFECYCLE_EVENTS.RIDER_ASSIGNED, riderAssignedPayload)
    emitToRoom(ROOMS.restaurant(order.restaurant_id), LIFECYCLE_EVENTS.RIDER_ASSIGNED, riderAssignedPayload)

    if (order.delivery_partner_id) {
      emitToRoom(ROOMS.deliveryPartner(order.delivery_partner_id), LIFECYCLE_EVENTS.RIDER_ASSIGNED, riderAssignedPayload)
    }
  }
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
       o.payment_type,
       o.payment_status,
       o.cash_collected,
       o.collected_cash_amount,
       o.rider_assignment_status,
       o.assignment_expires_at,
       o.delivery_completed_at,
       o.total,
       o.route_distance_km,
       o.estimated_total_eta_minutes,
       o.delivered_at,
       o.cancelled_at,
       o.created_at,
       o.updated_at,
       u.name AS customer_name,
       r.name AS restaurant_name,
       r.image AS restaurant_image,
       dp.full_name AS rider_name,
       dp.phone AS rider_phone,
       dp.profile_image AS rider_profile_image,
       dp.vehicle_type AS rider_vehicle_type,
       dp.vehicle_number AS rider_vehicle_number,
       a.full_address AS customer_address,
       a.latitude AS customer_latitude,
       a.longitude AS customer_longitude,
       r.latitude AS restaurant_latitude,
       r.longitude AS restaurant_longitude,
       loc.latitude AS rider_latitude,
       loc.longitude AS rider_longitude,
       COALESCE(item_snapshot.items, '[]'::json) AS items
     FROM orders o
     JOIN users u ON u.id = o.user_id
     JOIN restaurants r ON r.id = o.restaurant_id
     LEFT JOIN delivery_partners dp ON dp.id = o.delivery_partner_id
     LEFT JOIN addresses a ON a.id = o.address_id
     LEFT JOIN LATERAL (
       SELECT latitude, longitude
       FROM delivery_locations dl
       WHERE dl.delivery_partner_id = o.delivery_partner_id
       ORDER BY timestamp DESC
       LIMIT 1
     ) loc ON TRUE
     LEFT JOIN LATERAL (
       SELECT JSON_AGG(
         JSON_BUILD_OBJECT(
           'id', oi.id,
           'menu_item_id', oi.menu_item_id,
           'quantity', oi.quantity,
           'price', oi.price,
           'name', mi.name,
           'image', mi.image,
           'notes', oi.notes
         )
         ORDER BY mi.name ASC, oi.id ASC
       ) AS items
       FROM order_items oi
       LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE oi.order_id = o.id
     ) item_snapshot ON TRUE
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
    payment_type: row.payment_type || row.payment_method,
    payment_status: row.payment_status,
    cash_collected: Boolean(row.cash_collected),
    collected_cash_amount: Number(row.collected_cash_amount || 0),
    rider_assignment_status: row.rider_assignment_status,
    assignment_expires_at: row.assignment_expires_at,
    delivery_completed_at: row.delivery_completed_at,
    total: Number(row.total || 0),
    route_distance_km: row.route_distance_km !== null ? Number(row.route_distance_km) : null,
    estimated_total_eta_minutes:
      row.estimated_total_eta_minutes !== null ? Number(row.estimated_total_eta_minutes) : null,
    delivered_at: row.delivered_at,
    cancelled_at: row.cancelled_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    customer_name: row.customer_name,
    restaurant_name: row.restaurant_name,
    restaurant_image: row.restaurant_image,
    rider_name: row.rider_name,
    rider_phone: row.rider_phone,
    rider_profile_image: row.rider_profile_image,
    rider_vehicle_type: row.rider_vehicle_type,
    rider_vehicle_number: row.rider_vehicle_number,
    customer_address: row.customer_address,
    customer_latitude: row.customer_latitude !== null ? Number(row.customer_latitude) : null,
    customer_longitude: row.customer_longitude !== null ? Number(row.customer_longitude) : null,
    restaurant_latitude: row.restaurant_latitude !== null ? Number(row.restaurant_latitude) : null,
    restaurant_longitude: row.restaurant_longitude !== null ? Number(row.restaurant_longitude) : null,
    rider_latitude: row.rider_latitude !== null ? Number(row.rider_latitude) : null,
    rider_longitude: row.rider_longitude !== null ? Number(row.rider_longitude) : null,
    items: (row.items || []).map((item) => ({
      id: item.id,
      menu_item_id: item.menu_item_id,
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
      name: item.name,
      image: item.image,
      notes: item.notes || '',
    })),
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

  if (
    order.delivery_partner_id &&
    !['READY_FOR_ASSIGNMENT', 'PENDING'].includes(normalizeUpper(order.delivery_status)) &&
    !['REQUESTED', 'ASSIGNED'].includes(normalizeUpper(order.rider_assignment_status))
  ) {
    emitToRoom(
      ROOMS.deliveryPartner(order.delivery_partner_id),
      EVENTS.DELIVERY_ACTIVE_ORDER_UPDATED,
      payload
    )
  }

  emitLifecycleAlias(order, resolveLifecycleEventName(event, payload), payload)
  if (
    normalizeUpper(order.status) === 'DELIVERED' ||
    normalizeUpper(order.status) === 'CANCELLED' ||
    normalizeUpper(order.delivery_status) === 'DELIVERED' ||
    normalizeUpper(order.delivery_status) === 'CANCELLED'
  ) {
    emitLifecycleAlias(order, LIFECYCLE_EVENTS.ORDER_MOVED_TO_HISTORY, payload)
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

const emitRiderAssignmentRequest = async (orderId, deliveryPartnerId, extraPayload = {}) => {
  const payload = await emitOrderScopedUpdate(orderId, 'rider_assignment_request', extraPayload)

  if (payload) {
    emitToRoom(ROOMS.deliveryPartner(deliveryPartnerId), EVENTS.DELIVERY_ASSIGNMENT_REQUEST, payload)
    emitToRoom(ROOMS.deliveryPartner(deliveryPartnerId), LIFECYCLE_EVENTS.RIDER_ASSIGNMENT_REQUEST, {
      ...payload,
      lifecycle_event: LIFECYCLE_EVENTS.RIDER_ASSIGNMENT_REQUEST,
    })
  }

  return payload
}

const emitRiderAssignmentRemoved = (orderId, deliveryPartnerId, reason = 'removed') => {
  const payload = {
    order_id: orderId,
    reason,
    changed_at: new Date().toISOString(),
  }
  emitToRoom(ROOMS.deliveryPartner(deliveryPartnerId), EVENTS.DELIVERY_OFFER_REMOVED, payload)
  emitToRoom(ROOMS.deliveryPartner(deliveryPartnerId), LIFECYCLE_EVENTS.RIDER_REJECTED, {
    ...payload,
    lifecycle_event: LIFECYCLE_EVENTS.RIDER_REJECTED,
  })
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
  LIFECYCLE_EVENTS,
  emitDeliveryLocationUpdated,
  emitDeliveryStatusUpdated,
  emitOrderAssigned,
  emitOrderCreated,
  emitOrderReadyForDispatch,
  emitOrderStatusUpdated,
  emitRiderAssignmentRemoved,
  emitRiderAssignmentRequest,
  getOrderRealtimeSnapshot,
}
