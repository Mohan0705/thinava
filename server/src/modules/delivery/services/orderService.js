const pool = require('../../../database/connection')
const {
  ASSIGNMENT_STATUSES,
  DELIVERY_STATUS_ALIASES,
  ORDER_DELIVERY_STATUSES,
} = require('../constants')
const {
  DEFAULT_GPS_RADIUS_METERS,
  buildDeliveryOfferMetrics,
  calculateDistanceMeters,
  coerceCoordinate,
  roundMetric,
} = require('./logisticsService')
const { emitDeliveryStatusUpdated, emitOrderAssigned, emitOrderStatusUpdated } = require('../../../realtime/orderEvents')

const ACTIVE_TERMINAL_STATUSES = [
  ORDER_DELIVERY_STATUSES.DELIVERED,
  ORDER_DELIVERY_STATUSES.CANCELLED,
]

const toNumber = (value) => Number(value || 0)

const toCurrency = (value) => roundMetric(value || 0)

const normalizeDeliveryStatus = (status) => {
  const upper = String(status || ORDER_DELIVERY_STATUSES.ASSIGNED).trim().toUpperCase()
  return DELIVERY_STATUS_ALIASES[upper] || upper
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ensureUuid = (value, fieldName) => {
  const normalized = String(value || '').trim()

  if (!UUID_PATTERN.test(normalized)) {
    const error = new Error(`${fieldName} must be a valid UUID`)
    error.status = 400
    throw error
  }

  return normalized
}

const DELIVERY_ACTIONS = {
  [ORDER_DELIVERY_STATUSES.ASSIGNED]: {
    next_status: ORDER_DELIVERY_STATUSES.ARRIVED_AT_RESTAURANT,
    label: 'Mark arrived',
    target: 'restaurant',
    helper: 'Reach the restaurant pickup point first.',
  },
  [ORDER_DELIVERY_STATUSES.ARRIVED_AT_RESTAURANT]: {
    next_status: ORDER_DELIVERY_STATUSES.PICKED_UP,
    label: 'Confirm pickup',
    target: 'restaurant',
    helper: 'Pickup unlocks after you are at the restaurant.',
  },
  [ORDER_DELIVERY_STATUSES.PICKED_UP]: {
    next_status: ORDER_DELIVERY_STATUSES.REACHED_CUSTOMER,
    label: 'Mark at customer',
    target: 'customer',
    helper: 'Head to the customer drop location.',
  },
  [ORDER_DELIVERY_STATUSES.REACHED_CUSTOMER]: {
    next_status: ORDER_DELIVERY_STATUSES.DELIVERED,
    label: 'Complete delivery',
    target: 'customer',
    helper: 'Delivery completes only after you reach the customer.',
  },
}

const buildDeliveryActionState = ({
  deliveryStatus,
  riderLocation,
  restaurant,
  customer,
}) => {
  const action = DELIVERY_ACTIONS[deliveryStatus] || null
  const target = action?.target === 'customer' ? customer : restaurant
  const distanceMeters = action ? calculateDistanceMeters(riderLocation, target) : null
  const nextActionEnabled = action ? distanceMeters !== null && distanceMeters <= DEFAULT_GPS_RADIUS_METERS : false

  const gpsValidation = {
    required_radius_meters: DEFAULT_GPS_RADIUS_METERS,
    restaurant: {
      distance_meters: calculateDistanceMeters(riderLocation, restaurant),
      inside_range:
        calculateDistanceMeters(riderLocation, restaurant) !== null &&
        calculateDistanceMeters(riderLocation, restaurant) <= DEFAULT_GPS_RADIUS_METERS,
    },
    customer: {
      distance_meters: calculateDistanceMeters(riderLocation, customer),
      inside_range:
        calculateDistanceMeters(riderLocation, customer) !== null &&
        calculateDistanceMeters(riderLocation, customer) <= DEFAULT_GPS_RADIUS_METERS,
    },
  }

  return {
    gps_validation: {
      ...gpsValidation,
      next_target: action
        ? {
            scope: action.target,
            label: action.target === 'customer' ? 'Customer drop location' : 'Restaurant pickup location',
            distance_meters: distanceMeters,
            inside_range: nextActionEnabled,
            required_radius_meters: DEFAULT_GPS_RADIUS_METERS,
          }
        : null,
    },
    action_state: {
      current_status: deliveryStatus,
      next_status: action?.next_status || null,
      next_action_label: action?.label || null,
      next_action_enabled: action ? nextActionEnabled : false,
      target_scope: action?.target || null,
      disabled_reason:
        action && !nextActionEnabled
          ? action.target === 'customer'
            ? 'You are too far from the customer. Please reach the drop location first.'
            : 'You are too far from the restaurant. Please reach pickup location first.'
          : null,
      helper_text: action?.helper || null,
    },
  }
}

const mapAvailableOrder = async (row, riderLocation) => {
  const offerMetrics = await buildDeliveryOfferMetrics({
    orderId: row.id,
    paymentMethod: row.payment_method,
    restaurantLatitude: row.restaurant_latitude,
    restaurantLongitude: row.restaurant_longitude,
    customerLatitude: row.customer_latitude,
    customerLongitude: row.customer_longitude,
    riderLatitude: riderLocation?.latitude,
    riderLongitude: riderLocation?.longitude,
  })

  return {
    id: row.id,
    subtotal: toCurrency(row.subtotal),
    delivery_fee: toCurrency(row.delivery_fee),
    tax: toCurrency(row.tax),
    total: toCurrency(row.total),
    created_at: row.created_at,
    payment_method: row.payment_method,
    payment_type: String(row.payment_method || '').toLowerCase() === 'cod' ? 'COD' : 'PREPAID',
    restaurant_id: row.restaurant_id,
    restaurant_name: row.restaurant_name,
    restaurant_image: row.restaurant_image,
    restaurant_address: row.restaurant_address || 'Restaurant address will appear after assignment',
    restaurant_latitude: offerMetrics.coordinates.restaurant.latitude,
    restaurant_longitude: offerMetrics.coordinates.restaurant.longitude,
    delivery_time: row.delivery_time,
    customer_address: row.customer_address,
    customer_landmark: row.customer_landmark,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    customer_latitude: offerMetrics.coordinates.customer.latitude,
    customer_longitude: offerMetrics.coordinates.customer.longitude,
    item_count: Number(row.item_count || 0),
    route_distance_km: offerMetrics.route.routeDistanceKm,
    pickup_distance_km: offerMetrics.route.pickupDistanceKm,
    dropoff_distance_km: offerMetrics.route.dropoffDistanceKm,
    estimated_pickup_eta_minutes: offerMetrics.route.pickupEtaMinutes,
    estimated_dropoff_eta_minutes: offerMetrics.route.dropoffEtaMinutes,
    estimated_total_eta_minutes: offerMetrics.route.totalEtaMinutes,
    estimated_earnings: offerMetrics.pay.total,
    payout_breakdown: {
      base_pay: offerMetrics.pay.basePay,
      distance_pay: offerMetrics.pay.distancePay,
      surge_bonus: offerMetrics.pay.surgeBonus,
      rain_bonus: offerMetrics.pay.rainBonus,
      night_bonus: offerMetrics.pay.nightBonus,
      cod_handling_bonus: offerMetrics.pay.codHandlingBonus,
      total: offerMetrics.pay.total,
    },
    surge_badge: offerMetrics.pay.surgeBonus > 0,
    rain_badge: offerMetrics.pay.rainBonus > 0,
    night_badge: offerMetrics.pay.nightBonus > 0,
    map_provider: offerMetrics.route.provider,
  }
}

const getLatestPartnerLocation = async (partnerId) => {
  const normalizedPartnerId = ensureUuid(partnerId, 'partnerId')
  const locationResult = await pool.query(
    `SELECT latitude, longitude, timestamp
     FROM delivery_locations
     WHERE delivery_partner_id = $1::uuid
     ORDER BY timestamp DESC
     LIMIT 1`,
    [normalizedPartnerId]
  )

  return locationResult.rows[0] || null
}

const getAvailableOrders = async (partnerId) => {
  if (!partnerId) {
    return []
  }

  const normalizedPartnerId = ensureUuid(partnerId, 'partnerId')

  const partnerResult = await pool.query(
    `SELECT id, is_online, current_order_id
     FROM delivery_partners
     WHERE id = $1::uuid`,
    [normalizedPartnerId]
  )

  if (partnerResult.rows.length === 0) {
    const error = new Error('Delivery partner not found')
    error.status = 404
    throw error
  }

  const partner = partnerResult.rows[0]
  if (partner.current_order_id) {
    return []
  }

  const riderLocation = await getLatestPartnerLocation(normalizedPartnerId)

  const result = await pool.query(
    `SELECT
       o.id,
       o.subtotal,
       o.delivery_fee,
       o.tax,
       o.total,
       o.created_at,
       o.payment_method,
       r.id AS restaurant_id,
       r.name AS restaurant_name,
       r.image AS restaurant_image,
       r.delivery_time,
       r.formatted_address AS restaurant_address,
       r.latitude AS restaurant_latitude,
       r.longitude AS restaurant_longitude,
       a.full_address AS customer_address,
       a.landmark AS customer_landmark,
       a.latitude AS customer_latitude,
       a.longitude AS customer_longitude,
       u.name AS customer_name,
       u.phone AS customer_phone,
       COUNT(oi.id)::int AS item_count
     FROM orders o
     JOIN restaurants r ON o.restaurant_id = r.id
     JOIN addresses a ON o.address_id = a.id
     JOIN users u ON o.user_id = u.id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.delivery_status = $1
       AND o.delivery_partner_id IS NULL
       AND UPPER(o.status) IN ('PREPARING', 'READY_FOR_PICKUP')
     GROUP BY o.id, r.id, a.id, u.id
     ORDER BY o.created_at DESC
     LIMIT 20`,
    [ORDER_DELIVERY_STATUSES.PENDING]
  )

  let orders = await Promise.all(result.rows.map((row) => mapAvailableOrder(row, riderLocation)))

  // Check floating cash limit - filter out COD orders if over limit
  try {
    const walletRes = await pool.query(
      `SELECT floating_cash, floating_cash_limit FROM rider_wallets WHERE delivery_partner_id = $1`,
      [normalizedPartnerId]
    )
    if (walletRes.rows.length > 0) {
      const { floating_cash, floating_cash_limit } = walletRes.rows[0]
      if (Number(floating_cash_limit) > 0 && Number(floating_cash) >= Number(floating_cash_limit)) {
        orders = orders.filter((o) => o.payment_method !== 'cod')
      }
    }
  } catch {
    // wallet table might not exist yet, skip restriction
  }

  return orders
}

const buildOrderPayload = async (row, riderLocation) => {
  const deliveryStatus = normalizeDeliveryStatus(row.delivery_status)
  const offerMetrics = await buildDeliveryOfferMetrics({
    orderId: row.id,
    paymentMethod: row.payment_method,
    restaurantLatitude: row.restaurant_latitude,
    restaurantLongitude: row.restaurant_longitude,
    customerLatitude: row.customer_latitude,
    customerLongitude: row.customer_longitude,
    riderLatitude: riderLocation?.latitude || row.current_latitude,
    riderLongitude: riderLocation?.longitude || row.current_longitude,
  })

  const basePay =
    coerceCoordinate(row.base_delivery_pay) !== null && Number(row.base_delivery_pay) >= 25
      ? toCurrency(row.base_delivery_pay)
      : offerMetrics.pay.basePay
  const distancePay =
    coerceCoordinate(row.distance_delivery_pay) !== null && Number(row.base_delivery_pay) >= 25
      ? toCurrency(row.distance_delivery_pay)
      : offerMetrics.pay.distancePay
  const surgeBonus = coerceCoordinate(row.surge_bonus) !== null ? toCurrency(row.surge_bonus) : offerMetrics.pay.surgeBonus
  const rainBonus = coerceCoordinate(row.rain_bonus) !== null ? toCurrency(row.rain_bonus) : offerMetrics.pay.rainBonus
  const nightBonus = coerceCoordinate(row.night_bonus) !== null ? toCurrency(row.night_bonus) : offerMetrics.pay.nightBonus
  const tipAmount = toCurrency(row.tip_amount)
  const estimatedEarnings = toCurrency(
    basePay + distancePay + surgeBonus + rainBonus + tipAmount + offerMetrics.pay.codHandlingBonus
  )
  const restaurantCoordinates = offerMetrics.coordinates.restaurant
  const customerCoordinates = offerMetrics.coordinates.customer
  const resolvedRiderLocation =
    riderLocation && coerceCoordinate(riderLocation.latitude) !== null && coerceCoordinate(riderLocation.longitude) !== null
      ? {
          latitude: Number(riderLocation.latitude),
          longitude: Number(riderLocation.longitude),
        }
      : coerceCoordinate(row.current_latitude) !== null && coerceCoordinate(row.current_longitude) !== null
        ? {
            latitude: Number(row.current_latitude),
            longitude: Number(row.current_longitude),
          }
        : null

  const deliveryState = buildDeliveryActionState({
    deliveryStatus,
    riderLocation: resolvedRiderLocation,
    restaurant: restaurantCoordinates,
    customer: customerCoordinates,
  })

  return {
    id: row.id,
    subtotal: toCurrency(row.subtotal),
    delivery_fee: toCurrency(row.delivery_fee),
    tax: toCurrency(row.tax),
    total: toCurrency(row.total),
    payment_method: row.payment_method,
    payment_type: String(row.payment_method || '').toLowerCase() === 'cod' ? 'COD' : 'PREPAID',
    created_at: row.created_at,
    delivery_assigned_at: row.delivery_assigned_at,
    delivery_status: deliveryStatus,
    assignment_status: row.assignment_status || ASSIGNMENT_STATUSES.ACCEPTED,
    restaurant_id: row.restaurant_id,
    restaurant_name: row.restaurant_name,
    restaurant_image: row.restaurant_image,
    restaurant_address: row.restaurant_address || 'Restaurant address unavailable',
    restaurant_latitude: restaurantCoordinates.latitude,
    restaurant_longitude: restaurantCoordinates.longitude,
    customer_id: row.customer_id,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    customer_address: row.customer_address,
    customer_landmark: row.customer_landmark,
    customer_latitude: customerCoordinates.latitude,
    customer_longitude: customerCoordinates.longitude,
    route_distance_km:
      coerceCoordinate(row.route_distance_km) !== null
        ? toNumber(row.route_distance_km)
        : offerMetrics.route.routeDistanceKm,
    pickup_distance_km:
      coerceCoordinate(row.pickup_distance_km) !== null
        ? toNumber(row.pickup_distance_km)
        : offerMetrics.route.pickupDistanceKm,
    dropoff_distance_km:
      coerceCoordinate(row.dropoff_distance_km) !== null
        ? toNumber(row.dropoff_distance_km)
        : offerMetrics.route.dropoffDistanceKm,
    estimated_pickup_eta_minutes:
      Number(row.estimated_pickup_eta_minutes || row.pickup_eta_minutes || offerMetrics.route.pickupEtaMinutes),
    estimated_dropoff_eta_minutes:
      Number(row.estimated_dropoff_eta_minutes || row.dropoff_eta_minutes || offerMetrics.route.dropoffEtaMinutes),
    estimated_total_eta_minutes:
      Number(row.estimated_total_eta_minutes || row.total_eta_minutes || offerMetrics.route.totalEtaMinutes),
    estimated_earnings: estimatedEarnings,
    payout_breakdown: {
      base_pay: basePay,
      distance_pay: distancePay,
      surge_bonus: surgeBonus,
      rain_bonus: rainBonus,
      night_bonus: nightBonus,
      tip_amount: tipAmount,
      cod_handling_bonus: offerMetrics.pay.codHandlingBonus,
      total: estimatedEarnings,
    },
    per_km_rate: offerMetrics.pay.perKmRate,
    night_badge: offerMetrics.pay.nightBonus > 0,
    map_provider: offerMetrics.route.provider,
    items: Array.isArray(row.items) ? row.items : [],
    ...deliveryState,
  }
}

const getLatestPartnerLocationForClient = async (client, partnerId) => {
  const result = await client.query(
    `SELECT latitude, longitude, timestamp
     FROM delivery_locations
     WHERE delivery_partner_id = $1::uuid
     ORDER BY timestamp DESC
     LIMIT 1`,
    [partnerId]
  )

  return result.rows[0] || null
}

const getOrderDispatchSnapshot = async (client, orderId) => {
  const result = await client.query(
    `SELECT
       o.id,
       o.delivery_partner_id,
       o.delivery_status,
       o.payment_method,
       o.status,
       o.tip_amount,
       r.formatted_address AS restaurant_address,
       r.latitude AS restaurant_latitude,
       r.longitude AS restaurant_longitude,
       a.latitude AS customer_latitude,
       a.longitude AS customer_longitude
     FROM orders o
     JOIN restaurants r ON r.id = o.restaurant_id
     JOIN addresses a ON a.id = o.address_id
     WHERE o.id = $1::uuid
     FOR UPDATE`,
    [orderId]
  )

  return result.rows[0] || null
}

const assignLockedOrderToPartner = async ({
  client,
  order,
  orderId,
  partnerId,
  riderLocation,
  assignmentStatus = ASSIGNMENT_STATUSES.ASSIGNED,
  dispatchNote = 'Assigned by Thinava dispatch engine',
}) => {
  const offerMetrics = await buildDeliveryOfferMetrics({
    orderId,
    paymentMethod: order.payment_method,
    restaurantLatitude: order.restaurant_latitude,
    restaurantLongitude: order.restaurant_longitude,
    customerLatitude: order.customer_latitude,
    customerLongitude: order.customer_longitude,
    riderLatitude: riderLocation?.latitude,
    riderLongitude: riderLocation?.longitude,
  })

  await client.query(
    `UPDATE orders
     SET delivery_partner_id = $1::uuid,
         delivery_status = $2,
         delivery_assigned_at = CURRENT_TIMESTAMP,
         route_distance_km = $3,
         pickup_distance_km = $4,
         dropoff_distance_km = $5,
         estimated_pickup_eta_minutes = $6,
         estimated_dropoff_eta_minutes = $7,
         estimated_total_eta_minutes = $8,
         base_delivery_pay = $9,
         distance_delivery_pay = $10,
         surge_bonus = $11,
         rain_bonus = $12,
         night_bonus = $13,
         cod_handling_bonus = $14,
         estimated_earning = $15,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $16::uuid`,
    [
      partnerId,
      ORDER_DELIVERY_STATUSES.ASSIGNED,
      offerMetrics.route.routeDistanceKm,
      offerMetrics.route.pickupDistanceKm,
      offerMetrics.route.dropoffDistanceKm,
      offerMetrics.route.pickupEtaMinutes,
      offerMetrics.route.dropoffEtaMinutes,
      offerMetrics.route.totalEtaMinutes,
      offerMetrics.pay.basePay,
      offerMetrics.pay.distancePay,
      offerMetrics.pay.surgeBonus,
      offerMetrics.pay.rainBonus,
      offerMetrics.pay.nightBonus,
      offerMetrics.pay.codHandlingBonus,
      offerMetrics.pay.total,
      orderId,
    ]
  )

  await client.query(
    `INSERT INTO delivery_assignments (
       order_id,
       delivery_partner_id,
       assignment_status,
       assigned_at,
       earnings,
       distance_km,
       updated_at
     )
     VALUES ($1::uuid, $2::uuid, $3, CURRENT_TIMESTAMP, $4, $5, CURRENT_TIMESTAMP)`,
    [
      orderId,
      partnerId,
      assignmentStatus,
      offerMetrics.pay.total,
      offerMetrics.route.dropoffDistanceKm,
    ]
  )

  await client.query(
    `INSERT INTO delivery_status_logs (order_id, delivery_partner_id, status, notes)
     VALUES ($1::uuid, $2::uuid, $3, $4)`,
    [orderId, partnerId, ORDER_DELIVERY_STATUSES.ASSIGNED, dispatchNote]
  )

  await client.query(
    `INSERT INTO active_deliveries (
       order_id,
       delivery_partner_id,
       status,
       restaurant_latitude,
       restaurant_longitude,
       customer_latitude,
       customer_longitude,
       route_distance_km,
       pickup_distance_km,
       dropoff_distance_km,
       pickup_eta_minutes,
       dropoff_eta_minutes,
       total_eta_minutes,
       earnings_total,
       surge_bonus,
       rain_bonus,
       night_bonus,
       gps_validation_status,
       accepted_at,
       updated_at
     )
     VALUES (
       $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
     )
     ON CONFLICT (order_id)
     DO UPDATE SET
       delivery_partner_id = EXCLUDED.delivery_partner_id,
       status = EXCLUDED.status,
       restaurant_latitude = EXCLUDED.restaurant_latitude,
       restaurant_longitude = EXCLUDED.restaurant_longitude,
       customer_latitude = EXCLUDED.customer_latitude,
       customer_longitude = EXCLUDED.customer_longitude,
       route_distance_km = EXCLUDED.route_distance_km,
       pickup_distance_km = EXCLUDED.pickup_distance_km,
       dropoff_distance_km = EXCLUDED.dropoff_distance_km,
       pickup_eta_minutes = EXCLUDED.pickup_eta_minutes,
       dropoff_eta_minutes = EXCLUDED.dropoff_eta_minutes,
       total_eta_minutes = EXCLUDED.total_eta_minutes,
       earnings_total = EXCLUDED.earnings_total,
       surge_bonus = EXCLUDED.surge_bonus,
       rain_bonus = EXCLUDED.rain_bonus,
       night_bonus = EXCLUDED.night_bonus,
       gps_validation_status = EXCLUDED.gps_validation_status,
       accepted_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP`,
    [
      orderId,
      partnerId,
      ORDER_DELIVERY_STATUSES.ASSIGNED,
      offerMetrics.coordinates.restaurant.latitude,
      offerMetrics.coordinates.restaurant.longitude,
      offerMetrics.coordinates.customer.latitude,
      offerMetrics.coordinates.customer.longitude,
      offerMetrics.route.routeDistanceKm,
      offerMetrics.route.pickupDistanceKm,
      offerMetrics.route.dropoffDistanceKm,
      offerMetrics.route.pickupEtaMinutes,
      offerMetrics.route.dropoffEtaMinutes,
      offerMetrics.route.totalEtaMinutes,
      offerMetrics.pay.total,
      offerMetrics.pay.surgeBonus,
      offerMetrics.pay.rainBonus,
      offerMetrics.pay.nightBonus,
      JSON.stringify({
        required_radius_meters: DEFAULT_GPS_RADIUS_METERS,
        restaurant: null,
        customer: null,
      }),
    ]
  )

  await client.query(
    `INSERT INTO delivery_tracking (
       order_id,
       delivery_partner_id,
       current_latitude,
       current_longitude,
       current_eta_minutes,
       last_status,
       last_location_at,
       updated_at
     )
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (order_id)
     DO UPDATE SET
       delivery_partner_id = EXCLUDED.delivery_partner_id,
       current_latitude = EXCLUDED.current_latitude,
       current_longitude = EXCLUDED.current_longitude,
       current_eta_minutes = EXCLUDED.current_eta_minutes,
       last_status = EXCLUDED.last_status,
       last_location_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP`,
    [
      orderId,
      partnerId,
      riderLocation?.latitude || null,
      riderLocation?.longitude || null,
      offerMetrics.route.totalEtaMinutes,
      ORDER_DELIVERY_STATUSES.ASSIGNED,
    ]
  )

  await client.query(
    `UPDATE delivery_partners
     SET current_order_id = $1::uuid,
         current_status = 'ASSIGNED',
         updated_at = CURRENT_TIMESTAMP,
         last_seen_at = CURRENT_TIMESTAMP
     WHERE id = $2::uuid`,
    [orderId, partnerId]
  )

  return offerMetrics
}

const findBestPartnerForOrder = async (client, order, excludedPartnerIds = []) => {
  const exclusionList = excludedPartnerIds
    .map((partnerId) => String(partnerId || '').trim())
    .filter(Boolean)

  const riderResult = await client.query(
    `SELECT
       dp.id,
       dp.current_order_id,
       dp.acceptance_rate,
       dp.cancellation_rate,
       dp.last_seen_at,
       loc.latitude,
       loc.longitude,
       loc.timestamp AS location_timestamp,
       EXISTS (
         SELECT 1
         FROM delivery_shifts ds
         WHERE ds.delivery_partner_id = dp.id
           AND ds.starts_at <= CURRENT_TIMESTAMP
           AND ds.ends_at >= CURRENT_TIMESTAMP
           AND ds.status IN ('booked', 'active')
       ) AS has_active_shift,
       (
         SELECT COUNT(*)::int
         FROM orders active_orders
         WHERE active_orders.delivery_partner_id = dp.id
           AND active_orders.delivery_status NOT IN ('DELIVERED', 'CANCELLED')
       ) AS active_orders
     FROM delivery_partners dp
     LEFT JOIN LATERAL (
       SELECT latitude, longitude, timestamp
       FROM delivery_locations dl
       WHERE dl.delivery_partner_id = dp.id
       ORDER BY timestamp DESC
       LIMIT 1
     ) loc ON TRUE
     WHERE dp.is_online = TRUE
       AND COALESCE(dp.is_active, TRUE) = TRUE
       AND COALESCE(dp.is_suspended, FALSE) = FALSE
       AND COALESCE(dp.force_offline, FALSE) = FALSE
       AND dp.current_order_id IS NULL
     ORDER BY has_active_shift DESC, loc.timestamp DESC NULLS LAST
     LIMIT 25`
  )

  const restaurantPoint = {
    latitude: Number(order.restaurant_latitude),
    longitude: Number(order.restaurant_longitude),
  }

  const ranked = riderResult.rows
    .filter((candidate) => !exclusionList.includes(candidate.id))
    .map((candidate) => {
      const riderPoint =
        coerceCoordinate(candidate.latitude) !== null && coerceCoordinate(candidate.longitude) !== null
          ? {
              latitude: Number(candidate.latitude),
              longitude: Number(candidate.longitude),
            }
          : null

      const pickupDistanceKm = riderPoint
        ? calculateDistanceMeters(riderPoint, restaurantPoint) / 1000
        : 999
      const activeOrders = Number(candidate.active_orders || 0)
      const lastSeenAt = candidate.location_timestamp || candidate.last_seen_at
      const lastSeenMinutes = lastSeenAt
        ? Math.max(0, Math.round((Date.now() - new Date(lastSeenAt).getTime()) / 60000))
        : 120
      const acceptanceRate = Number(candidate.acceptance_rate || 100)
      const cancellationRate = Number(candidate.cancellation_rate || 0)
      const shiftBonus = candidate.has_active_shift ? -18 : 0
      const score =
        pickupDistanceKm * 120 +
        activeOrders * 50 +
        lastSeenMinutes * 0.6 +
        (100 - acceptanceRate) * 0.8 +
        cancellationRate * 1.5 +
        shiftBonus

      return {
        ...candidate,
        pickupDistanceKm,
        score,
      }
    })
    .sort((left, right) => left.score - right.score)

  return ranked[0] || null
}

const autoAssignOrder = async (orderId, options = {}) => {
  const normalizedOrderId = ensureUuid(orderId, 'orderId')
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const order = await getOrderDispatchSnapshot(client, normalizedOrderId)

    if (!order) {
      const error = new Error('Order not found')
      error.status = 404
      throw error
    }

    if (ACTIVE_TERMINAL_STATUSES.includes(order.delivery_status)) {
      await client.query('ROLLBACK')
      return { success: false, reason: 'closed' }
    }

    if (!['PREPARING', 'READY_FOR_PICKUP'].includes(String(order.status || '').toUpperCase()) && !options.force) {
      await client.query('ROLLBACK')
      return { success: false, reason: 'restaurant_not_ready' }
    }

    if (order.delivery_partner_id) {
      await client.query('COMMIT')
      return {
        success: true,
        order_id: normalizedOrderId,
        partner_id: order.delivery_partner_id,
        reused_existing_assignment: true,
      }
    }

    const bestPartner = await findBestPartnerForOrder(client, order, options.excludedPartnerIds || [])

    if (!bestPartner) {
      await client.query(
        `UPDATE orders
         SET delivery_status = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2::uuid`,
        [ORDER_DELIVERY_STATUSES.PENDING, normalizedOrderId]
      )

      await client.query('COMMIT')

      emitOrderStatusUpdated(normalizedOrderId, {
        source: options.source || 'dispatch_engine',
        normalized_status: ORDER_DELIVERY_STATUSES.PENDING,
      }).catch((error) => {
        console.error('Failed to emit pending dispatch status event', error)
      })

      return { success: false, reason: 'no_online_rider' }
    }

    const offerMetrics = await assignLockedOrderToPartner({
      client,
      order,
      orderId: normalizedOrderId,
      partnerId: bestPartner.id,
      riderLocation:
        coerceCoordinate(bestPartner.latitude) !== null && coerceCoordinate(bestPartner.longitude) !== null
          ? {
              latitude: Number(bestPartner.latitude),
              longitude: Number(bestPartner.longitude),
            }
          : null,
      assignmentStatus: ASSIGNMENT_STATUSES.ASSIGNED,
      dispatchNote: options.dispatchNote || 'Automatically assigned by Thinava dispatch engine',
    })

    await client.query('COMMIT')

    emitOrderAssigned(normalizedOrderId, {
      source: options.source || 'dispatch_engine',
      partner_id: bestPartner.id,
      auto_assigned: true,
    }).catch((error) => {
      console.error('Failed to emit realtime auto-assignment event', error)
    })

    return {
      success: true,
      order_id: normalizedOrderId,
      partner_id: bestPartner.id,
      estimated_earnings: offerMetrics.pay.total,
      route_distance_km: offerMetrics.route.routeDistanceKm,
      estimated_total_eta_minutes: offerMetrics.route.totalEtaMinutes,
    }
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {}
    throw error
  } finally {
    client.release()
  }
}

const assignOrderToPartner = async (orderId, partnerId) => {
  const normalizedOrderId = ensureUuid(orderId, 'orderId')
  const normalizedPartnerId = ensureUuid(partnerId, 'partnerId')
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const partnerCheck = await client.query(
      `SELECT id, current_order_id, is_online
       FROM delivery_partners
       WHERE id = $1::uuid
       FOR UPDATE`,
      [normalizedPartnerId]
    )

    if (partnerCheck.rows.length === 0) {
      const error = new Error('Delivery partner not found')
      error.status = 404
      throw error
    }

    const partner = partnerCheck.rows[0]
    if (partner.current_order_id) {
      const error = new Error('Finish your current delivery before accepting another order')
      error.status = 400
      throw error
    }

    const order = await getOrderDispatchSnapshot(client, normalizedOrderId)

    if (!order) {
      const error = new Error('Order not found')
      error.status = 404
      throw error
    }

    if (order.delivery_partner_id) {
      const error = new Error('Order already assigned')
      error.status = 400
      throw error
    }

    if (order.delivery_status !== ORDER_DELIVERY_STATUSES.PENDING) {
      const error = new Error('Order is not available for assignment')
      error.status = 400
      throw error
    }

    const riderLocation = await getLatestPartnerLocationForClient(client, normalizedPartnerId)
    const offerMetrics = await assignLockedOrderToPartner({
      client,
      order,
      orderId: normalizedOrderId,
      partnerId: normalizedPartnerId,
      riderLocation,
      assignmentStatus: ASSIGNMENT_STATUSES.ACCEPTED,
      dispatchNote: 'Accepted by delivery partner',
    })

    await client.query('COMMIT')

    emitOrderAssigned(normalizedOrderId, {
      source: 'delivery_partner_accept',
      partner_id: normalizedPartnerId,
    }).catch((error) => {
      console.error('Failed to emit realtime assignment event', error)
    })

    emitDeliveryStatusUpdated(normalizedOrderId, {
      source: 'delivery_partner_accept',
      status: ORDER_DELIVERY_STATUSES.ASSIGNED,
    }).catch((error) => {
      console.error('Failed to emit realtime rider acceptance event', error)
    })

    return {
      success: true,
      order_id: normalizedOrderId,
      active_delivery_status: ORDER_DELIVERY_STATUSES.ASSIGNED,
      estimated_earnings: offerMetrics.pay.total,
      route_distance_km: offerMetrics.route.routeDistanceKm,
      estimated_total_eta_minutes: offerMetrics.route.totalEtaMinutes,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

const confirmAssignedOrder = async (orderId, partnerId) => {
  const normalizedOrderId = ensureUuid(orderId, 'orderId')
  const normalizedPartnerId = ensureUuid(partnerId, 'partnerId')
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const orderResult = await client.query(
      `SELECT id, delivery_status
       FROM orders
       WHERE id = $1::uuid AND delivery_partner_id = $2::uuid
       FOR UPDATE`,
      [normalizedOrderId, normalizedPartnerId]
    )

    if (orderResult.rows.length === 0) {
      const error = new Error('Assigned order not found')
      error.status = 404
      throw error
    }

    if (ACTIVE_TERMINAL_STATUSES.includes(orderResult.rows[0].delivery_status)) {
      const error = new Error('This delivery task is already closed')
      error.status = 400
      throw error
    }

    await client.query(
      `UPDATE delivery_assignments
       SET assignment_status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $2::uuid AND delivery_partner_id = $3::uuid`,
      [ASSIGNMENT_STATUSES.ACCEPTED, normalizedOrderId, normalizedPartnerId]
    )

    await client.query(
      `UPDATE delivery_partners
       SET current_order_id = $1::uuid,
           current_status = 'ASSIGNED',
           updated_at = CURRENT_TIMESTAMP,
           last_seen_at = CURRENT_TIMESTAMP
       WHERE id = $2::uuid`,
      [normalizedOrderId, normalizedPartnerId]
    )

    await client.query(
      `UPDATE active_deliveries
       SET status = $1,
           accepted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $2::uuid AND delivery_partner_id = $3::uuid`,
      [ORDER_DELIVERY_STATUSES.ASSIGNED, normalizedOrderId, normalizedPartnerId]
    )

    await client.query(
      `INSERT INTO delivery_status_logs (order_id, delivery_partner_id, status, notes)
       VALUES ($1, $2, $3, $4)`,
      [
        normalizedOrderId,
        normalizedPartnerId,
        ORDER_DELIVERY_STATUSES.ASSIGNED,
        'Accepted assigned order from rider app',
      ]
    )

    await client.query('COMMIT')

    emitOrderAssigned(normalizedOrderId, {
      source: 'rider_assignment_confirmed',
      partner_id: normalizedPartnerId,
    }).catch((error) => {
      console.error('Failed to emit realtime assignment confirmation event', error)
    })

    emitDeliveryStatusUpdated(normalizedOrderId, {
      source: 'rider_assignment_confirmed',
      status: ORDER_DELIVERY_STATUSES.ASSIGNED,
    }).catch((error) => {
      console.error('Failed to emit realtime assignment acceptance event', error)
    })

    return {
      success: true,
      order: await getOrderDetails(normalizedOrderId, normalizedPartnerId),
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

const rejectAssignedOrder = async (orderId, partnerId) => {
  const normalizedOrderId = ensureUuid(orderId, 'orderId')
  const normalizedPartnerId = ensureUuid(partnerId, 'partnerId')
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const orderResult = await client.query(
      `SELECT id, delivery_status
       FROM orders
       WHERE id = $1::uuid AND delivery_partner_id = $2::uuid
       FOR UPDATE`,
      [normalizedOrderId, normalizedPartnerId]
    )

    if (orderResult.rows.length === 0) {
      const error = new Error('Assigned order not found')
      error.status = 404
      throw error
    }

    if (ACTIVE_TERMINAL_STATUSES.includes(orderResult.rows[0].delivery_status)) {
      const error = new Error('This delivery task is already closed')
      error.status = 400
      throw error
    }

    await client.query(
      `UPDATE delivery_assignments
       SET assignment_status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $2::uuid AND delivery_partner_id = $3::uuid`,
      [ASSIGNMENT_STATUSES.REJECTED, normalizedOrderId, normalizedPartnerId]
    )

    await client.query(
      `DELETE FROM active_deliveries
       WHERE order_id = $1::uuid AND delivery_partner_id = $2::uuid`,
      [normalizedOrderId, normalizedPartnerId]
    )

    await client.query(
      `DELETE FROM delivery_tracking
       WHERE order_id = $1::uuid AND delivery_partner_id = $2::uuid`,
      [normalizedOrderId, normalizedPartnerId]
    )

    await client.query(
      `UPDATE orders
       SET delivery_partner_id = NULL,
           delivery_status = $1,
           delivery_assigned_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2::uuid AND delivery_partner_id = $3::uuid`,
      [ORDER_DELIVERY_STATUSES.PENDING, normalizedOrderId, normalizedPartnerId]
    )

    await client.query(
      `UPDATE delivery_partners
       SET current_order_id = NULL,
           current_status = 'AVAILABLE',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [normalizedPartnerId]
    )

    await client.query(
      `INSERT INTO delivery_status_logs (order_id, delivery_partner_id, status, notes)
       VALUES ($1, $2, $3, $4)`,
      [
        normalizedOrderId,
        normalizedPartnerId,
        ASSIGNMENT_STATUSES.REJECTED,
        'Rejected assigned order from rider app',
      ]
    )

    await client.query('COMMIT')

    const redispatchResult = await autoAssignOrder(normalizedOrderId, {
      excludedPartnerIds: [normalizedPartnerId],
      source: 'rider_assignment_rejected',
      dispatchNote: 'Reassigned after rider rejected the delivery',
    })

    emitOrderStatusUpdated(normalizedOrderId, {
      source: 'rider_assignment_rejected',
      partner_id: normalizedPartnerId,
      normalized_status: redispatchResult.success
        ? ORDER_DELIVERY_STATUSES.ASSIGNED
        : ORDER_DELIVERY_STATUSES.PENDING,
    }).catch((error) => {
      console.error('Failed to emit realtime assignment rejection event', error)
    })

    return {
      success: true,
      order_id: normalizedOrderId,
      redispatched: redispatchResult.success,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

const getOrderDetails = async (orderId, partnerId) => {
  const normalizedOrderId = ensureUuid(orderId, 'orderId')
  const normalizedPartnerId = ensureUuid(partnerId, 'partnerId')
  const riderLocation = await getLatestPartnerLocation(normalizedPartnerId)
  const result = await pool.query(
    `SELECT
       o.id,
       o.subtotal,
       o.delivery_fee,
       o.tax,
       o.total,
       o.payment_method,
       o.created_at,
       o.delivery_assigned_at,
       o.delivery_status,
       o.route_distance_km,
       o.pickup_distance_km,
       o.dropoff_distance_km,
       o.estimated_pickup_eta_minutes,
       o.estimated_dropoff_eta_minutes,
       o.estimated_total_eta_minutes,
       o.base_delivery_pay,
       o.distance_delivery_pay,
       o.surge_bonus,
       o.rain_bonus,
       o.night_bonus,
       o.tip_amount,
       r.id AS restaurant_id,
       r.name AS restaurant_name,
       r.image AS restaurant_image,
       r.formatted_address AS restaurant_address,
       r.latitude AS restaurant_latitude,
       r.longitude AS restaurant_longitude,
       u.id AS customer_id,
       u.name AS customer_name,
       u.phone AS customer_phone,
       a.full_address AS customer_address,
       a.landmark AS customer_landmark,
       a.latitude AS customer_latitude,
       a.longitude AS customer_longitude,
       ad.pickup_eta_minutes,
       ad.dropoff_eta_minutes,
       ad.total_eta_minutes,
       da.assignment_status,
       dt.current_latitude,
       dt.current_longitude,
       (SELECT JSON_AGG(
         JSON_BUILD_OBJECT(
           'id', oi.id,
           'name', mi.name,
           'quantity', oi.quantity,
           'price', oi.price,
           'image', mi.image
         )
       ) FROM order_items oi
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.order_id = o.id) AS items
     FROM orders o
     JOIN restaurants r ON o.restaurant_id = r.id
     JOIN addresses a ON o.address_id = a.id
     JOIN users u ON o.user_id = u.id
     LEFT JOIN active_deliveries ad ON ad.order_id = o.id
     LEFT JOIN delivery_tracking dt ON dt.order_id = o.id
     LEFT JOIN LATERAL (
       SELECT assignment_status
       FROM delivery_assignments
       WHERE order_id = o.id AND delivery_partner_id = $2::uuid
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1
     ) da ON TRUE
     WHERE o.id = $1::uuid AND o.delivery_partner_id = $2::uuid`,
    [normalizedOrderId, normalizedPartnerId]
  )

  if (result.rows.length === 0) {
    const error = new Error('Order not found or not assigned to you')
    error.status = 404
    throw error
  }

  return buildOrderPayload(result.rows[0], riderLocation)
}

const getActiveOrderForPartner = async (partnerId) => {
  const normalizedPartnerId = ensureUuid(partnerId, 'partnerId')
  const partnerResult = await pool.query(
    `SELECT current_order_id
     FROM delivery_partners
     WHERE id = $1::uuid`,
    [normalizedPartnerId]
  )

  if (partnerResult.rows.length === 0) {
    const error = new Error('Delivery partner not found')
    error.status = 404
    throw error
  }

  let currentOrderId = partnerResult.rows[0].current_order_id

  if (!currentOrderId) {
    const orderResult = await pool.query(
      `SELECT id
       FROM orders
       WHERE delivery_partner_id = $1::uuid
         AND delivery_status NOT IN ($2::text, $3::text)
       ORDER BY delivery_assigned_at DESC NULLS LAST, created_at DESC
       LIMIT 1`,
      [normalizedPartnerId, ORDER_DELIVERY_STATUSES.DELIVERED, ORDER_DELIVERY_STATUSES.CANCELLED]
    )

    currentOrderId = orderResult.rows[0]?.id || null

    if (currentOrderId) {
      await pool.query(
        `UPDATE delivery_partners
         SET current_order_id = $1::uuid, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2::uuid`,
        [currentOrderId, normalizedPartnerId]
      )
    }
  }

  if (!currentOrderId) {
    return null
  }

  const order = await getOrderDetails(currentOrderId, normalizedPartnerId)
  if (ACTIVE_TERMINAL_STATUSES.includes(order.delivery_status)) {
    await pool.query(
      `UPDATE delivery_partners
       SET current_order_id = NULL, current_status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [normalizedPartnerId]
    )
    return null
  }

  return order
}

const dispatchPendingOrders = async (limit = 5) => {
  const result = await pool.query(
    `SELECT id
     FROM orders
     WHERE delivery_partner_id IS NULL
       AND delivery_status = $1
       AND UPPER(status) IN ('PREPARING', 'READY_FOR_PICKUP')
     ORDER BY updated_at DESC, created_at ASC
     LIMIT $2::int`,
    [ORDER_DELIVERY_STATUSES.PENDING, limit]
  )

  const outcomes = []

  for (const row of result.rows) {
    try {
      outcomes.push(await autoAssignOrder(row.id, { source: 'dispatch_retry' }))
    } catch (error) {
      outcomes.push({
        success: false,
        order_id: row.id,
        reason: error instanceof Error ? error.message : 'dispatch_failed',
      })
    }
  }

  return outcomes
}

module.exports = {
  autoAssignOrder,
  dispatchPendingOrders,
  getAvailableOrders,
  assignOrderToPartner,
  confirmAssignedOrder,
  rejectAssignedOrder,
  getActiveOrderForPartner,
  getOrderDetails,
}
