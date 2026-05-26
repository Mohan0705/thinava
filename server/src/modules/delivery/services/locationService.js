const pool = require('../../../database/connection')
const {
  ASSIGNMENT_STATUSES,
  DELIVERY_STATUS_ALIASES,
  DELIVERY_STATUS_TRANSITIONS,
  ORDER_DELIVERY_STATUSES,
} = require('../constants')
const {
  DEFAULT_GPS_RADIUS_METERS,
  buildDeliveryOfferMetrics,
  calculateDistanceMeters,
  coerceCoordinate,
} = require('./logisticsService')
const {
  emitDeliveryLocationUpdated,
  emitDeliveryStatusUpdated,
} = require('../../../realtime/orderEvents')
const { getIO } = require('../../../realtime/socketServer')

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const GPS_TARGET_SCOPE = {
  [ORDER_DELIVERY_STATUSES.ARRIVED_AT_RESTAURANT]: 'restaurant',
  [ORDER_DELIVERY_STATUSES.PICKED_UP]: 'restaurant',
  [ORDER_DELIVERY_STATUSES.REACHED_CUSTOMER]: 'customer',
  [ORDER_DELIVERY_STATUSES.CASH_COLLECTED]: 'customer',
  [ORDER_DELIVERY_STATUSES.DELIVERED]: 'customer',
}

const DELIVERY_TO_ORDER_STATUS = {
  [ORDER_DELIVERY_STATUSES.ASSIGNED]: 'out_for_delivery',
  [ORDER_DELIVERY_STATUSES.ARRIVED_AT_RESTAURANT]: 'out_for_delivery',
  [ORDER_DELIVERY_STATUSES.PICKED_UP]: 'out_for_delivery',
  [ORDER_DELIVERY_STATUSES.REACHED_CUSTOMER]: 'out_for_delivery',
  [ORDER_DELIVERY_STATUSES.CASH_COLLECTED]: 'out_for_delivery',
  [ORDER_DELIVERY_STATUSES.DELIVERED]: 'delivered',
  [ORDER_DELIVERY_STATUSES.CANCELLED]: 'cancelled',
}

const normalizeDeliveryStatus = (status) => {
  const upper = String(status || '').trim().toUpperCase()
  return DELIVERY_STATUS_ALIASES[upper] || upper
}

const ensureUuid = (value, fieldName) => {
  const normalized = String(value || '').trim()

  if (!UUID_PATTERN.test(normalized)) {
    const error = new Error(`${fieldName} must be a valid UUID`)
    error.status = 400
    throw error
  }

  return normalized
}

const normalizeCoordinate = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const createValidationSnapshot = (order, riderLocation) => {
  const restaurant = {
    latitude: Number(order.restaurant_latitude),
    longitude: Number(order.restaurant_longitude),
  }
  const customer = {
    latitude: Number(order.customer_latitude),
    longitude: Number(order.customer_longitude),
  }
  const restaurantDistance = calculateDistanceMeters(riderLocation, restaurant)
  const customerDistance = calculateDistanceMeters(riderLocation, customer)

  return {
    required_radius_meters: DEFAULT_GPS_RADIUS_METERS,
    restaurant: {
      distance_meters: restaurantDistance,
      inside_range:
        restaurantDistance !== null && restaurantDistance <= DEFAULT_GPS_RADIUS_METERS,
    },
    customer: {
      distance_meters: customerDistance,
      inside_range:
        customerDistance !== null && customerDistance <= DEFAULT_GPS_RADIUS_METERS,
    },
  }
}

const getLocationForStatusValidation = async (client, partnerId, orderId, latitude, longitude) => {
  const liveLatitude = normalizeCoordinate(latitude)
  const liveLongitude = normalizeCoordinate(longitude)

  if (liveLatitude !== null && liveLongitude !== null) {
    return {
      latitude: liveLatitude,
      longitude: liveLongitude,
    }
  }

  const lastLocationResult = await client.query(
    `SELECT latitude, longitude
     FROM delivery_locations
     WHERE delivery_partner_id = $1::uuid
       AND ($2::uuid IS NULL OR order_id = $2::uuid OR order_id IS NULL)
     ORDER BY timestamp DESC
     LIMIT 1`,
    [partnerId, orderId || null]
  )

  if (lastLocationResult.rows.length === 0) {
    return null
  }

  return {
    latitude: Number(lastLocationResult.rows[0].latitude),
    longitude: Number(lastLocationResult.rows[0].longitude),
  }
}

const saveDeliveryLocation = async (partnerId, orderId, latitude, longitude, accuracy = null) => {
  const normalizedPartnerId = ensureUuid(partnerId, 'partnerId')
  const normalizedOrderId = orderId ? ensureUuid(orderId, 'orderId') : null
  const liveLatitude = normalizeCoordinate(latitude)
  const liveLongitude = normalizeCoordinate(longitude)
  const liveAccuracy = normalizeCoordinate(accuracy)

  if (liveLatitude === null || liveLongitude === null) {
    const error = new Error('latitude and longitude are required numeric values')
    error.status = 400
    throw error
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const result = await client.query(
      `INSERT INTO delivery_locations (delivery_partner_id, order_id, latitude, longitude, accuracy)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, delivery_partner_id, order_id, latitude, longitude, accuracy, timestamp`,
      [normalizedPartnerId, normalizedOrderId, liveLatitude, liveLongitude, liveAccuracy]
    )

    await client.query(
      `UPDATE delivery_partners
       SET last_seen_at = CURRENT_TIMESTAMP,
           last_latitude = $2,
           last_longitude = $3,
           last_location_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [normalizedPartnerId, liveLatitude, liveLongitude]
    )

    if (normalizedOrderId) {
      const deliveryResult = await client.query(
        `SELECT
           o.id,
           o.payment_method,
           o.delivery_status,
           r.latitude AS restaurant_latitude,
           r.longitude AS restaurant_longitude,
           a.latitude AS customer_latitude,
           a.longitude AS customer_longitude
         FROM orders o
         JOIN restaurants r ON r.id = o.restaurant_id
         JOIN addresses a ON a.id = o.address_id
         WHERE o.id = $1::uuid AND o.delivery_partner_id = $2::uuid`,
        [normalizedOrderId, normalizedPartnerId]
      )

      const delivery = deliveryResult.rows[0]
      if (delivery) {
        const offerMetrics = await buildDeliveryOfferMetrics({
          orderId: normalizedOrderId,
          paymentMethod: delivery.payment_method,
          restaurantLatitude: delivery.restaurant_latitude,
          restaurantLongitude: delivery.restaurant_longitude,
          customerLatitude: delivery.customer_latitude,
          customerLongitude: delivery.customer_longitude,
          riderLatitude: liveLatitude,
          riderLongitude: liveLongitude,
        })
        const gpsValidationStatus = createValidationSnapshot(delivery, {
          latitude: liveLatitude,
          longitude: liveLongitude,
        })

        await client.query(
          `INSERT INTO delivery_tracking (
             order_id,
             delivery_partner_id,
             current_latitude,
             current_longitude,
             current_accuracy,
             current_eta_minutes,
             last_status,
             last_location_at,
             updated_at
           )
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, COALESCE((SELECT delivery_status FROM orders WHERE id = $1::uuid), 'ASSIGNED'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (order_id)
           DO UPDATE SET
             current_latitude = EXCLUDED.current_latitude,
             current_longitude = EXCLUDED.current_longitude,
             current_accuracy = EXCLUDED.current_accuracy,
             current_eta_minutes = EXCLUDED.current_eta_minutes,
             last_location_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP`,
          [
            normalizedOrderId,
            normalizedPartnerId,
            liveLatitude,
            liveLongitude,
            liveAccuracy,
            offerMetrics.route.totalEtaMinutes,
          ]
        )

        await client.query(
          `UPDATE active_deliveries
           SET gps_validation_status = $1::jsonb,
               updated_at = CURRENT_TIMESTAMP
           WHERE order_id = $2::uuid AND delivery_partner_id = $3::uuid`,
          [JSON.stringify(gpsValidationStatus), normalizedOrderId, normalizedPartnerId]
        )
      }
    }

    await client.query('COMMIT')

    if (normalizedOrderId) {
      emitDeliveryLocationUpdated(normalizedOrderId, {
        source: 'partner_location_ping',
        location: {
          latitude: liveLatitude,
          longitude: liveLongitude,
          accuracy: liveAccuracy,
        },
      }).catch((error) => {
        console.error('Failed to emit realtime location update', error)
      })
    }

    return result.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

const getLatestDeliveryLocation = async (partnerId) => {
  const normalizedPartnerId = ensureUuid(partnerId, 'partnerId')
  const result = await pool.query(
    `SELECT id, delivery_partner_id, order_id, latitude, longitude, accuracy, timestamp
     FROM delivery_locations
     WHERE delivery_partner_id = $1::uuid
     ORDER BY timestamp DESC
     LIMIT 1`,
    [normalizedPartnerId]
  )

  return result.rows[0] || null
}

const getDeliveryLocationHistory = async (partnerId, orderId, limit = 100) => {
  const normalizedPartnerId = ensureUuid(partnerId, 'partnerId')
  const normalizedOrderId = ensureUuid(orderId, 'orderId')
  const result = await pool.query(
    `SELECT id, latitude, longitude, accuracy, timestamp
     FROM delivery_locations
     WHERE delivery_partner_id = $1::uuid AND order_id = $2::uuid
     ORDER BY timestamp DESC
     LIMIT $3::int`,
    [normalizedPartnerId, normalizedOrderId, limit]
  )

  return result.rows
}

const updateDeliveryStatus = async (
  orderId,
  partnerId,
  requestedStatus,
  latitude = null,
  longitude = null,
  notes = null
) => {
  const normalizedOrderId = ensureUuid(orderId, 'orderId')
  const normalizedPartnerId = ensureUuid(partnerId, 'partnerId')
  const status = normalizeDeliveryStatus(requestedStatus)
  const client = await pool.connect()

  if (!Object.values(ORDER_DELIVERY_STATUSES).includes(status)) {
    const error = new Error(`Unsupported delivery status: ${requestedStatus}`)
    error.status = 400
    throw error
  }

  try {
    await client.query('BEGIN')

    const orderResult = await client.query(
      `SELECT
         o.id,
         o.status,
         o.delivery_status,
         o.payment_method,
         o.payment_status,
         o.cash_collected,
         o.collected_cash_amount,
         o.route_distance_km,
         o.dropoff_distance_km,
         o.base_delivery_pay,
         o.distance_delivery_pay,
         o.surge_bonus,
         o.rain_bonus,
         o.night_bonus,
         o.cod_handling_bonus,
         o.estimated_earning,
         o.tip_amount,
         o.total,
         o.delivery_assigned_at,
         r.latitude AS restaurant_latitude,
         r.longitude AS restaurant_longitude,
         a.latitude AS customer_latitude,
         a.longitude AS customer_longitude
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
       JOIN addresses a ON a.id = o.address_id
       WHERE o.id = $1::uuid AND o.delivery_partner_id = $2::uuid
       FOR UPDATE`,
      [normalizedOrderId, normalizedPartnerId]
    )

    if (orderResult.rows.length === 0) {
      const error = new Error('Order not found or not assigned to this partner')
      error.status = 404
      throw error
    }

    const order = orderResult.rows[0]
    const currentDeliveryStatus = normalizeDeliveryStatus(order.delivery_status || ORDER_DELIVERY_STATUSES.ASSIGNED)
    const allowedTransitions = DELIVERY_STATUS_TRANSITIONS[currentDeliveryStatus] || []

    if (currentDeliveryStatus === status) {
      await client.query('COMMIT')
      return {
        success: true,
        status,
        order_status: DELIVERY_TO_ORDER_STATUS[status] || order.status,
        already_applied: true,
        earnings_total: Number(order.estimated_earning || 0),
        distance_km: Number(order.dropoff_distance_km || 0),
        duration_minutes: Number(order.estimated_total_eta_minutes || 0),
        gps_validation: null,
      }
    }

    if (!allowedTransitions.includes(status)) {
      const error = new Error(`Cannot move delivery from ${currentDeliveryStatus} to ${status}`)
      error.status = 400
      throw error
    }

    const isCodOrder = String(order.payment_method || '').toLowerCase() === 'cod'
    if (status === ORDER_DELIVERY_STATUSES.CASH_COLLECTED && !isCodOrder) {
      const error = new Error('Cash collection is only available for COD orders')
      error.status = 400
      throw error
    }
    if (status === ORDER_DELIVERY_STATUSES.DELIVERED && isCodOrder && !order.cash_collected) {
      const error = new Error('Collect cash before completing this COD delivery')
      error.status = 400
      throw error
    }

    const riderLocation = await getLocationForStatusValidation(
      client,
      normalizedPartnerId,
      normalizedOrderId,
      latitude,
      longitude
    )
    const gpsValidationSnapshot = riderLocation
      ? createValidationSnapshot(order, riderLocation)
      : {
          required_radius_meters: DEFAULT_GPS_RADIUS_METERS,
          restaurant: { distance_meters: null, inside_range: false },
          customer: { distance_meters: null, inside_range: false },
        }
    const targetScope = GPS_TARGET_SCOPE[status]

    if (targetScope) {
      if (!riderLocation) {
        const error = new Error('Live GPS location is required for this delivery action')
        error.status = 400
        throw error
      }

      const checkpoint = gpsValidationSnapshot[targetScope]
      if (!checkpoint?.inside_range) {
        const remainingMeters = Number(checkpoint?.distance_meters || 0)
        const error = new Error(
          targetScope === 'customer'
            ? `You are too far from the customer. Remaining distance: ${remainingMeters} meters.`
            : `You are too far from the restaurant. Remaining distance: ${remainingMeters} meters.`
        )
        error.status = 400
        throw error
      }
    }

    let orderStatus = order.status
    const shouldMarkDeliveredAt = status === ORDER_DELIVERY_STATUSES.DELIVERED
    const shouldMarkPickedUpAt = status === ORDER_DELIVERY_STATUSES.PICKED_UP

    orderStatus = DELIVERY_TO_ORDER_STATUS[status] || orderStatus

    const updateResult = await client.query(
      `UPDATE orders
       SET delivery_status = $1::text,
           status = $2::text,
           cash_collected = CASE
             WHEN $7::boolean THEN TRUE
             ELSE cash_collected
           END,
           collected_cash_amount = CASE
             WHEN $7::boolean THEN COALESCE(NULLIF(collected_cash_amount, 0), total)
             ELSE collected_cash_amount
           END,
           cash_collected_at = CASE
             WHEN $7::boolean THEN COALESCE(cash_collected_at, CURRENT_TIMESTAMP)
             ELSE cash_collected_at
           END,
           payment_status = CASE
             WHEN $7::boolean THEN 'cod_collected'
             ELSE payment_status
           END,
           delivery_completed_at = CASE
             WHEN $6::boolean THEN COALESCE(delivery_completed_at, CURRENT_TIMESTAMP)
             ELSE delivery_completed_at
           END,
           picked_up_at = CASE
             WHEN $5::boolean THEN COALESCE(picked_up_at, CURRENT_TIMESTAMP)
             ELSE picked_up_at
           END,
           delivered_at = CASE
             WHEN $6::boolean THEN COALESCE(delivered_at, CURRENT_TIMESTAMP)
             ELSE delivered_at
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3::uuid AND delivery_partner_id = $4::uuid
       RETURNING
         id,
         delivery_status,
         status,
         route_distance_km,
         dropoff_distance_km,
         base_delivery_pay,
         distance_delivery_pay,
         surge_bonus,
         rain_bonus,
         night_bonus,
         cod_handling_bonus,
         estimated_earning,
         tip_amount`,
      [
        status,
        orderStatus,
        normalizedOrderId,
        normalizedPartnerId,
        shouldMarkPickedUpAt,
        shouldMarkDeliveredAt,
        status === ORDER_DELIVERY_STATUSES.CASH_COLLECTED,
      ]
    )

    if (updateResult.rows.length === 0) {
      throw new Error('Order not found or not assigned to this partner')
    }

    if (riderLocation) {
      await client.query(
        `INSERT INTO delivery_locations (delivery_partner_id, order_id, latitude, longitude, accuracy)
         VALUES ($1::uuid, $2::uuid, $3::numeric, $4::numeric, NULL)`,
        [
          normalizedPartnerId,
          normalizedOrderId,
          riderLocation.latitude,
          riderLocation.longitude,
        ]
      )

      await client.query(
        `UPDATE delivery_partners
         SET last_seen_at = CURRENT_TIMESTAMP,
             last_latitude = $2,
             last_longitude = $3,
             last_location_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1::uuid`,
        [normalizedPartnerId, riderLocation.latitude, riderLocation.longitude]
      )
    }

    await client.query(
      `INSERT INTO delivery_status_logs (order_id, delivery_partner_id, status, latitude, longitude, notes)
       VALUES ($1::uuid, $2::uuid, $3::text, $4::numeric, $5::numeric, $6::text)`,
      [
        normalizedOrderId,
        normalizedPartnerId,
        status,
        riderLocation?.latitude || null,
        riderLocation?.longitude || null,
        notes,
      ]
    )

    let assignmentStatus = ASSIGNMENT_STATUSES.ACCEPTED
    if (status === ORDER_DELIVERY_STATUSES.PICKED_UP) {
      assignmentStatus = ASSIGNMENT_STATUSES.PICKED_UP
    } else if (status === ORDER_DELIVERY_STATUSES.DELIVERED) {
      assignmentStatus = ASSIGNMENT_STATUSES.DELIVERED
    } else if (status === ORDER_DELIVERY_STATUSES.CANCELLED) {
      assignmentStatus = ASSIGNMENT_STATUSES.CANCELLED
    }

    await client.query(
       `UPDATE delivery_assignments
        SET assignment_status = $1::text,
            picked_up_at = CASE WHEN $1::text = 'PICKED_UP' THEN CURRENT_TIMESTAMP ELSE picked_up_at END,
            delivered_at = CASE WHEN $1::text = 'DELIVERED' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
            updated_at = CURRENT_TIMESTAMP
        WHERE order_id = $2::uuid AND delivery_partner_id = $3::uuid`,
       [assignmentStatus, normalizedOrderId, normalizedPartnerId]
    )

    const offerMetrics = await buildDeliveryOfferMetrics({
      orderId: normalizedOrderId,
      paymentMethod: order.payment_method,
      restaurantLatitude: order.restaurant_latitude,
      restaurantLongitude: order.restaurant_longitude,
      customerLatitude: order.customer_latitude,
      customerLongitude: order.customer_longitude,
      riderLatitude: riderLocation?.latitude,
      riderLongitude: riderLocation?.longitude,
    })

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
         updated_at,
         picked_up_at,
         delivered_at
       )
       VALUES (
         $1::uuid, $2::uuid, $3::text, $4::numeric, $5::numeric, $6::numeric, $7::numeric, $8::numeric, $9::numeric, $10::numeric, $11::int, $12::int, $13::int, $14::numeric, $15::numeric, $16::numeric, $17::numeric, $18::jsonb, CURRENT_TIMESTAMP,
         CASE WHEN $3::text = 'PICKED_UP' THEN CURRENT_TIMESTAMP ELSE NULL END,
         CASE WHEN $3::text = 'DELIVERED' THEN CURRENT_TIMESTAMP ELSE NULL END
       )
       ON CONFLICT (order_id)
       DO UPDATE SET
         status = EXCLUDED.status,
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
         picked_up_at = CASE WHEN EXCLUDED.status::text = 'PICKED_UP' THEN CURRENT_TIMESTAMP ELSE active_deliveries.picked_up_at END,
         delivered_at = CASE WHEN EXCLUDED.status::text = 'DELIVERED' THEN CURRENT_TIMESTAMP ELSE active_deliveries.delivered_at END,
         updated_at = CURRENT_TIMESTAMP`,
      [
        normalizedOrderId,
        normalizedPartnerId,
        status,
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
        Number(updateResult.rows[0].estimated_earning || 0) ||
          Number(updateResult.rows[0].base_delivery_pay || 0) +
            Number(updateResult.rows[0].distance_delivery_pay || 0) +
            Number(updateResult.rows[0].surge_bonus || 0) +
            Number(updateResult.rows[0].rain_bonus || 0) +
            Number(updateResult.rows[0].cod_handling_bonus || 0) +
            Number(updateResult.rows[0].tip_amount || 0),
        updateResult.rows[0].surge_bonus,
        updateResult.rows[0].rain_bonus,
        updateResult.rows[0].night_bonus,
        JSON.stringify(gpsValidationSnapshot),
      ]
    )

    await client.query(
      `INSERT INTO delivery_tracking (
         order_id,
         delivery_partner_id,
         current_latitude,
         current_longitude,
         current_accuracy,
         current_eta_minutes,
         last_status,
         last_location_at,
         updated_at
       )
       VALUES ($1::uuid, $2::uuid, $3::numeric, $4::numeric, NULL, $5::int, $6::text, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (order_id)
       DO UPDATE SET
         current_latitude = COALESCE(EXCLUDED.current_latitude, delivery_tracking.current_latitude),
         current_longitude = COALESCE(EXCLUDED.current_longitude, delivery_tracking.current_longitude),
         current_eta_minutes = EXCLUDED.current_eta_minutes,
         last_status = EXCLUDED.last_status,
         last_location_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
      [
        normalizedOrderId,
        normalizedPartnerId,
        riderLocation?.latitude || null,
        riderLocation?.longitude || null,
        offerMetrics.route.totalEtaMinutes,
        status,
      ]
    )

    const assignedAt = order.delivery_assigned_at ? new Date(order.delivery_assigned_at) : new Date()
    const durationMinutes = Math.max(0, Math.round((Date.now() - assignedAt.getTime()) / 60000))
    const totalEarning =
      Number(updateResult.rows[0].estimated_earning || 0) ||
      Number(updateResult.rows[0].base_delivery_pay || 0) +
        Number(updateResult.rows[0].distance_delivery_pay || 0) +
        Number(updateResult.rows[0].surge_bonus || 0) +
        Number(updateResult.rows[0].rain_bonus || 0) +
        Number(updateResult.rows[0].cod_handling_bonus || 0) +
        Number(updateResult.rows[0].tip_amount || 0)
    const distanceKm = Number(updateResult.rows[0].dropoff_distance_km || offerMetrics.route.dropoffDistanceKm || 0)

    if (status === ORDER_DELIVERY_STATUSES.DELIVERED) {
      const earningsService = require('./earningsService')
      await earningsService.recordEarning(
        normalizedPartnerId,
        normalizedOrderId,
        distanceKm,
        durationMinutes,
        totalEarning,
        0,
        client
      )

      if (String(order.payment_method || '').toLowerCase() === 'cod') {
        await client.query(
          `INSERT INTO rider_wallets (delivery_partner_id, floating_cash, floating_cash_limit)
           VALUES ($1::uuid, $2::numeric, 1500)
           ON CONFLICT (delivery_partner_id)
           DO UPDATE SET
             floating_cash = rider_wallets.floating_cash + EXCLUDED.floating_cash,
             updated_at = CURRENT_TIMESTAMP`,
          [normalizedPartnerId, Number(order.total || 0)]
        )
      }
    }

    if ([ORDER_DELIVERY_STATUSES.DELIVERED, ORDER_DELIVERY_STATUSES.CANCELLED].includes(status)) {
      await client.query(
        `UPDATE delivery_partners
         SET current_order_id = NULL,
             current_status = 'AVAILABLE',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1::uuid`,
        [normalizedPartnerId]
      )
    } else {
      await client.query(
        `UPDATE delivery_partners
         SET current_status = $1::text,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2::uuid`,
        [status, normalizedPartnerId]
      )
    }

    await client.query('COMMIT')

    emitDeliveryStatusUpdated(normalizedOrderId, {
      source: 'delivery_status_update',
      status,
      order_status: orderStatus,
      location:
        riderLocation
          ? {
              latitude: riderLocation.latitude,
              longitude: riderLocation.longitude,
            }
          : null,
      payout_amount: status === ORDER_DELIVERY_STATUSES.DELIVERED ? totalEarning : undefined,
      distance_km: distanceKm,
      duration_minutes: durationMinutes || offerMetrics.route.totalEtaMinutes,
    }).catch((error) => {
      console.error('Failed to emit realtime delivery status update', error)
    })

    const io = getIO()
    if (io && status === ORDER_DELIVERY_STATUSES.DELIVERED) {
      io.to(`delivery_partner:${normalizedPartnerId}`).emit('delivery_completed', {
        order_id: normalizedOrderId,
        payout_amount: totalEarning,
        distance_km: distanceKm,
        duration_minutes: durationMinutes || offerMetrics.route.totalEtaMinutes,
        message: 'Delivery completed! Earnings added to your wallet.',
        timestamp: new Date().toISOString(),
      })
      io.to('admin:global').emit('delivery_completed', {
        order_id: normalizedOrderId,
        rider_id: normalizedPartnerId,
        payout_amount: totalEarning,
        distance_km: distanceKm,
        duration_minutes: durationMinutes || offerMetrics.route.totalEtaMinutes,
        source: 'delivery_status_update',
        timestamp: new Date().toISOString(),
      })
    }

    return {
      success: true,
      status,
      order_status: orderStatus,
      earnings_total: totalEarning,
      distance_km: distanceKm,
      duration_minutes: durationMinutes || offerMetrics.route.totalEtaMinutes,
      gps_validation: gpsValidationSnapshot,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = {
  saveDeliveryLocation,
  getLatestDeliveryLocation,
  getDeliveryLocationHistory,
  updateDeliveryStatus,
}
