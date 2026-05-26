const bcrypt = require('bcryptjs')
const pool = require('../../../database/connection')
const { signAdminToken, verifyAdminTokenIgnoreExp } = require('../../../lib/auth/tokenService')
const { logger } = require('../../../lib/logger')
const {
  emitOrderAssigned,
  emitOrderStatusUpdated,
} = require('../../../realtime/orderEvents')
const { buildDeliveryOfferMetrics } = require('../../delivery/services/logisticsService')
const { updateOrderLifecycleState, ORDER_STATUS, normalizeStatus } = require('../../orders/orderLifecycleService')
const {
  ADMIN_ROLES,
  ROLE_PERMISSIONS,
  ORDER_STATUS_ALIASES,
  DELIVERY_STATUS_ALIASES,
} = require('../constants')

const TADEPALLIGUDEM_CENTER = {
  lat: 16.8148,
  lng: 81.527,
}

const AREA_NAMES = [
  'RTC Complex',
  'Old Bus Stand',
  'Railway Colony',
  'Pentapadu Road',
  'VN Reddy Colony',
  'Housing Board',
  'Fire Station Road',
  'Ganapavaram Road',
]

const hashNumber = (seed, min, max) => {
  const text = String(seed || 'thinava')
  let hash = 0

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0
  }

  const normalized = hash / 4294967295
  return min + normalized * (max - min)
}

const resolveCoordinate = (seed, actualValue, min, max) => {
  const parsed = Number(actualValue)
  if (Number.isFinite(parsed)) {
    return parsed
  }

  return Number(hashNumber(seed, min, max).toFixed(6))
}

const prettyLabel = (value) =>
  String(value || '')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const normalizeOrderStatus = (value) => {
  if (!value) {
    return 'PLACED'
  }

  const upper = String(value).trim().toUpperCase()
  return ORDER_STATUS_ALIASES[String(value).toLowerCase()] || upper
}

const normalizeDeliveryStatus = (value) => {
  if (!value) {
    return 'PENDING'
  }

  const upper = String(value).trim().toUpperCase()
  return DELIVERY_STATUS_ALIASES[String(value).toLowerCase()] || upper
}

const safeNumber = (value) => Number(value || 0)

const getMinutesBetween = (start, end = new Date()) => {
  if (!start) {
    return 0
  }

  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000))
}

const deriveAreaName = (seed, explicitZone) => {
  if (explicitZone) {
    return explicitZone
  }

  return AREA_NAMES[Math.abs(Math.floor(hashNumber(seed, 0, AREA_NAMES.length - 0.001)))] || AREA_NAMES[0]
}

const sanitizeAdmin = (row) => ({
  id: row.id,
  email: row.email,
  full_name: row.full_name,
  role: row.role,
  permissions:
    Array.isArray(row.permissions) && row.permissions.length > 0
      ? row.permissions
      : ROLE_PERMISSIONS[row.role] || [],
  last_login_at: row.last_login_at,
})

const buildAdminToken = (admin) => signAdminToken(admin)

const decodeAdminRefreshToken = (token) => {
  if (!token) {
    const error = new Error('Admin session token is required')
    error.status = 401
    throw error
  }

  try {
    return verifyAdminTokenIgnoreExp(token)
  } catch {
    const error = new Error('Invalid or expired admin token')
    error.status = 401
    throw error
  }
}

const uniqueBy = (list, key) => {
  const seen = new Set()
  return list.filter((item) => {
    const value = item[key]
    if (seen.has(value)) {
      return false
    }
    seen.add(value)
    return true
  })
}

const groupByCount = (items, selector) => {
  const groups = new Map()
  items.forEach((item) => {
    const key = selector(item)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key).push(item)
  })
  return Array.from(groups.entries())
}

const buildLiveMapPayload = (orders) => {
  const activeOrders = orders.filter(
    (order) => !['DELIVERED', 'CANCELLED'].includes(order.status)
  )

  const riders = activeOrders
    .filter((order) => order.rider)
    .map((order) => ({
      id: order.rider.id,
      name: order.rider.name,
      status: order.rider.current_status,
      latitude: order.rider.latitude,
      longitude: order.rider.longitude,
      order_id: order.id,
      area: order.area,
      is_online: order.rider.is_online,
    }))

  const restaurants = activeOrders.map((order) => ({
    id: order.restaurant.id,
    name: order.restaurant.name,
    latitude: order.restaurant.latitude,
    longitude: order.restaurant.longitude,
  }))

  const deliveries = activeOrders.map((order) => ({
    id: order.id,
    restaurant_name: order.restaurant.name,
    customer_name: order.customer.name,
    rider_name: order.rider?.name || 'Awaiting assignment',
    status: order.delivery_status,
    area: order.area,
    route: [
      {
        latitude: order.restaurant.latitude,
        longitude: order.restaurant.longitude,
      },
      {
        latitude: order.rider?.latitude || order.restaurant.latitude,
        longitude: order.rider?.longitude || order.restaurant.longitude,
      },
      {
        latitude: order.customer.latitude,
        longitude: order.customer.longitude,
      },
    ],
  }))

  const hotspots = Array.from(
    activeOrders.reduce((map, order) => {
      if (!map.has(order.area)) {
        map.set(order.area, {
          zone: order.area,
          intensity: 0,
          latitude: order.customer.latitude,
          longitude: order.customer.longitude,
        })
      }

      map.get(order.area).intensity += 1
      return map
    }, new Map())
  ).map(([, value]) => value)

  return {
    center: TADEPALLIGUDEM_CENTER,
    riders,
    restaurants,
    deliveries,
    hotspots,
  }
}

const fetchAdminById = async (adminUserId) => {
  const result = await pool.query(
    `SELECT id, email, full_name, role, permissions, is_active, last_login_at
     FROM admin_users
     WHERE id = $1`,
    [adminUserId]
  )

  if (result.rows.length === 0) {
    const error = new Error('Admin user not found')
    error.status = 404
    throw error
  }

  return sanitizeAdmin(result.rows[0])
}

const refreshAdminSession = async (token) => {
  const decoded = decodeAdminRefreshToken(token)
  const admin = await fetchAdminById(decoded.sub)

  return {
    token: buildAdminToken(admin),
    admin,
  }
}

const loginAdmin = async (email, password) => {
  const normalizedEmail = String(email || '').trim().toLowerCase()

  const result = await pool.query(
    `SELECT id, email, password_hash, full_name, role, permissions, is_active, last_login_at,
            failed_login_attempts, lockout_until
     FROM admin_users
     WHERE LOWER(email) = LOWER($1)`,
    [normalizedEmail]
  )

  const admin = result.rows[0]

  if (!admin) {
    logger.warn(`Login failed: admin not found for ${normalizedEmail}`, { tag: 'admin_auth' })
    const error = new Error('Admin account not found')
    error.status = 401
    throw error
  }

  if (!admin.is_active) {
    logger.warn(`Login failed: admin ${admin.email} is disabled`, { tag: 'admin_auth' })
    const error = new Error('Admin account is disabled')
    error.status = 401
    throw error
  }

  if (admin.lockout_until && new Date(admin.lockout_until) > new Date()) {
    logger.warn(`Login blocked: admin ${admin.email} locked until ${admin.lockout_until}`, { tag: 'admin_auth' })
    const error = new Error('Account is temporarily locked due to too many failed login attempts. Please try again later.')
    error.status = 423
    throw error
  }

  const passwordMatches = await bcrypt.compare(password, admin.password_hash)

  if (!passwordMatches) {
    const failedAttempts = (admin.failed_login_attempts || 0) + 1
    logger.warn(`Login failed: wrong password for ${admin.email} (attempt ${failedAttempts})`, { tag: 'admin_auth' })
    let lockoutUntil = null
    if (failedAttempts >= 5) {
      lockoutUntil = new Date(Date.now() + 15 * 60 * 1000)
    }

    await pool.query(
      `UPDATE admin_users 
       SET failed_login_attempts = $1, lockout_until = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [failedAttempts, lockoutUntil, admin.id]
    )

    const error = new Error('Invalid admin credentials')
    error.status = 401
    throw error
  }

  logger.info(`Login success: ${admin.email} (${admin.role})`, { tag: 'admin_auth' })

  await pool.query(
    `UPDATE admin_users 
     SET last_login_at = CURRENT_TIMESTAMP, 
         failed_login_attempts = 0, 
         lockout_until = NULL,
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1`,
    [admin.id]
  )

  const sessionAdmin = sanitizeAdmin({ ...admin, last_login_at: new Date().toISOString() })

  return {
    token: buildAdminToken(sessionAdmin),
    admin: sessionAdmin,
  }
}

const recordActivity = async ({
  adminUserId,
  action,
  entityType,
  entityId = null,
  description = null,
  metadata = {},
  ipAddress = null,
  userAgent = null,
}) => {
  await pool.query(
    `INSERT INTO admin_activity_logs (
      admin_user_id, action, entity_type, entity_id, description, metadata, ip_address, user_agent
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
    [
      adminUserId,
      action,
      entityType,
      entityId,
      description,
      JSON.stringify(metadata || {}),
      ipAddress,
      userAgent,
    ]
  )
}

const getOrderRows = async (limit = 150) => {
  const result = await pool.query(
    `SELECT
       o.id,
       o.total,
       o.subtotal,
       o.delivery_fee,
       o.tax,
       o.status,
       o.payment_method,
       o.created_at,
       o.updated_at,
       o.delivery_status,
       o.delivery_partner_id,
       o.delivery_assigned_at,
       o.delivered_at,
       o.platform_commission_amount,
       o.admin_flagged,
       o.cancellation_reason,
       o.payout_status,
       u.id AS customer_id,
       u.name AS customer_name,
       u.phone AS customer_phone,
       u.email AS customer_email,
       u.is_blocked AS customer_is_blocked,
       u.fraud_score AS customer_fraud_score,
       a.full_address,
       a.landmark,
       a.latitude AS customer_latitude,
       a.longitude AS customer_longitude,
       r.id AS restaurant_id,
       r.name AS restaurant_name,
       r.rating AS restaurant_rating,
       r.status AS restaurant_status,
       r.zone_name AS restaurant_zone_name,
       r.commission_percentage,
       r.latitude AS restaurant_latitude,
       r.longitude AS restaurant_longitude,
       dp.id AS rider_id,
       dp.full_name AS rider_name,
       dp.phone AS rider_phone,
       dp.is_online AS rider_is_online,
       dp.current_status AS rider_current_status,
       dp.approval_status AS rider_approval_status,
       loc.latitude AS rider_latitude,
       loc.longitude AS rider_longitude,
       loc.timestamp AS rider_location_timestamp,
       COUNT(oi.id)::int AS item_count
     FROM orders o
     JOIN users u ON u.id = o.user_id
     JOIN addresses a ON a.id = o.address_id
     JOIN restaurants r ON r.id = o.restaurant_id
     LEFT JOIN delivery_partners dp ON dp.id = o.delivery_partner_id
     LEFT JOIN LATERAL (
       SELECT latitude, longitude, timestamp
       FROM delivery_locations dl
       WHERE dl.delivery_partner_id = o.delivery_partner_id
       ORDER BY timestamp DESC
       LIMIT 1
     ) loc ON TRUE
     LEFT JOIN order_items oi ON oi.order_id = o.id
     GROUP BY
       o.id, u.id, a.id, r.id, dp.id, loc.latitude, loc.longitude, loc.timestamp
     ORDER BY o.created_at DESC
     LIMIT $1`,
    [limit]
  )

  return result.rows.map((row) => {
    const normalizedStatus = normalizeOrderStatus(row.status)
    const normalizedDeliveryStatus = normalizeDeliveryStatus(row.delivery_status)
    const elapsedMinutes = getMinutesBetween(row.created_at)
    const deliveredMinutes = row.delivered_at ? getMinutesBetween(row.created_at, row.delivered_at) : null
    const area = deriveAreaName(row.id, row.restaurant_zone_name)

    return {
      id: row.id,
      status: normalizedStatus,
      status_label: prettyLabel(normalizedStatus),
      delivery_status: normalizedDeliveryStatus,
      delivery_status_label: prettyLabel(normalizedDeliveryStatus),
      total: safeNumber(row.total),
      subtotal: safeNumber(row.subtotal),
      delivery_fee: safeNumber(row.delivery_fee),
      tax: safeNumber(row.tax),
      item_count: Number(row.item_count || 0),
      payment_method: String(row.payment_method || 'cod').toUpperCase(),
      created_at: row.created_at,
      updated_at: row.updated_at,
      delivery_assigned_at: row.delivery_assigned_at,
      delivered_at: row.delivered_at,
      elapsed_minutes: elapsedMinutes,
      delivered_minutes: deliveredMinutes,
      is_delayed:
        normalizedStatus !== 'DELIVERED' &&
        normalizedStatus !== 'CANCELLED' &&
        elapsedMinutes > 45,
      platform_commission_amount: safeNumber(row.platform_commission_amount),
      admin_flagged: Boolean(row.admin_flagged),
      cancellation_reason: row.cancellation_reason,
      payout_status: row.payout_status,
      area,
      customer: {
        id: row.customer_id,
        name: row.customer_name,
        phone: row.customer_phone,
        email: row.customer_email,
        is_blocked: Boolean(row.customer_is_blocked),
        fraud_score: Number(row.customer_fraud_score || 0),
        address: row.full_address,
        landmark: row.landmark,
        latitude: resolveCoordinate(row.customer_id, row.customer_latitude, 16.796, 16.834),
        longitude: resolveCoordinate(row.customer_id, row.customer_longitude, 81.5, 81.55),
      },
      restaurant: {
        id: row.restaurant_id,
        name: row.restaurant_name,
        rating: safeNumber(row.restaurant_rating),
        status: row.restaurant_status,
        commission_percentage: safeNumber(row.commission_percentage),
        latitude: resolveCoordinate(row.restaurant_id, row.restaurant_latitude, 16.801, 16.829),
        longitude: resolveCoordinate(row.restaurant_id, row.restaurant_longitude, 81.508, 81.544),
      },
      rider: row.rider_id
        ? {
            id: row.rider_id,
            name: row.rider_name,
            phone: row.rider_phone,
            is_online: Boolean(row.rider_is_online),
            current_status: row.rider_current_status,
            approval_status: row.rider_approval_status,
            latitude: resolveCoordinate(row.rider_id, row.rider_latitude, 16.799, 16.836),
            longitude: resolveCoordinate(row.rider_id, row.rider_longitude, 81.503, 81.551),
            location_timestamp: row.rider_location_timestamp,
          }
        : null,
    }
  })
}

const getDashboardData = async () => {
  const [orders, restaurantsResult, ridersResult, recentLogsResult] = await Promise.all([
    getOrderRows(120),
    pool.query('SELECT id, name, featured, is_open, is_suspended, approval_status FROM restaurants'),
    pool.query(
      `SELECT id, full_name, is_online, current_status, is_suspended, force_offline, rating
       FROM delivery_partners`
    ),
    pool.query(
      `SELECT action, entity_type, entity_id, description, metadata, created_at
       FROM admin_activity_logs
       ORDER BY created_at DESC
       LIMIT 10`
    ),
  ])

  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)

  const todaysOrders = orders.filter((order) => new Date(order.created_at) >= startOfDay)
  const activeOrders = orders.filter(
    (order) => !['DELIVERED', 'CANCELLED'].includes(order.status)
  )
  const onlineRiders = ridersResult.rows.filter(
    (partner) => partner.is_online && !partner.is_suspended && !partner.force_offline
  )
  const activeRestaurants = restaurantsResult.rows.filter(
    (restaurant) => restaurant.is_open && !restaurant.is_suspended
  )
  const deliveredOrders = orders.filter((order) => order.delivered_minutes)
  const averageDeliveryTime =
    deliveredOrders.length > 0
      ? Math.round(
          deliveredOrders.reduce((sum, order) => sum + safeNumber(order.delivered_minutes), 0) /
            deliveredOrders.length
        )
      : 0

  const revenueToday = todaysOrders.reduce((sum, order) => sum + order.total, 0)
  const failedOrders = todaysOrders.filter((order) => order.status === 'CANCELLED').length
  const commissionToday = todaysOrders.reduce(
    (sum, order) => sum + order.platform_commission_amount,
    0
  )

  const syntheticFeed = orders.slice(0, 6).map((order, index) => {
    const eventTypes = [
      'New order received',
      'Rider assigned',
      'Delivery completed',
      'Order delayed',
      'Payment settlement queued',
      'Restaurant complaint updated',
    ]

    return {
      id: `${order.id}-feed-${index}`,
      type: eventTypes[index % eventTypes.length],
      description: `${order.restaurant.name} for ${order.customer.name} in ${order.area}`,
      time: order.updated_at || order.created_at,
      severity: order.is_delayed ? 'warning' : order.status === 'CANCELLED' ? 'critical' : 'info',
    }
  })

  const auditFeed = recentLogsResult.rows.map((log, index) => ({
    id: `${log.entity_id || 'admin'}-${index}`,
    type: prettyLabel(log.action),
    description: log.description || `${prettyLabel(log.entity_type)} action recorded`,
    time: log.created_at,
    severity: 'info',
  }))

  const zoneMap = new Map()
  orders.forEach((order) => {
    if (!zoneMap.has(order.area)) {
      zoneMap.set(order.area, { zone: order.area, orders: 0, delayed: 0, revenue: 0 })
    }

    const zone = zoneMap.get(order.area)
    zone.orders += 1
    zone.revenue += order.total
    if (order.is_delayed) {
      zone.delayed += 1
    }
  })

  const revenueTrend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    date.setHours(0, 0, 0, 0)
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)

    const dayOrders = orders.filter((order) => {
      const orderDate = new Date(order.created_at)
      return orderDate >= date && orderDate < nextDate
    })

    return {
      day: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      orders: dayOrders.length,
      revenue: dayOrders.reduce((sum, order) => sum + order.total, 0),
    }
  })

  return {
    metrics: {
      orders_today: todaysOrders.length,
      active_deliveries: activeOrders.length,
      online_riders: onlineRiders.length,
      active_restaurants: activeRestaurants.length,
      revenue_today: revenueToday,
      failed_orders: failedOrders,
      average_delivery_time: averageDeliveryTime,
      platform_commission: commissionToday,
    },
    activity_feed: [...auditFeed, ...syntheticFeed]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 12),
    order_status_breakdown: ['PLACED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].map(
      (status) => ({
        status,
        label: prettyLabel(status),
        value: orders.filter((order) => order.status === status).length,
      })
    ),
    revenue_trend: revenueTrend,
    zone_performance: Array.from(zoneMap.values())
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 6),
    live_map: buildLiveMapPayload(orders),
  }
}

const listOrders = async (filters = {}) => {
  const orders = await getOrderRows(250)
  const normalizedStatus = filters.status ? normalizeOrderStatus(filters.status) : null
  const normalizedPayment = filters.payment_method
    ? String(filters.payment_method).toUpperCase()
    : null

  const filtered = orders.filter((order) => {
    if (normalizedStatus && order.status !== normalizedStatus && order.delivery_status !== normalizedStatus) {
      return false
    }
    if (filters.restaurant && order.restaurant.id !== filters.restaurant) {
      return false
    }
    if (filters.rider && order.rider?.id !== filters.rider) {
      return false
    }
    if (filters.area && order.area !== filters.area) {
      return false
    }
    if (normalizedPayment && order.payment_method !== normalizedPayment) {
      return false
    }
    return true
  })

  return {
    orders: filtered,
    summary: {
      active: filtered.filter((order) => !['DELIVERED', 'CANCELLED'].includes(order.status)).length,
      delayed: filtered.filter((order) => order.is_delayed).length,
      cancelled: filtered.filter((order) => order.status === 'CANCELLED').length,
      cod: filtered.filter((order) => order.payment_method === 'COD').length,
    },
    filters: {
      restaurants: uniqueBy(
        orders.map((order) => ({
          id: order.restaurant.id,
          name: order.restaurant.name,
        })),
        'id'
      ),
      riders: uniqueBy(
        orders
          .filter((order) => order.rider)
          .map((order) => ({
            id: order.rider.id,
            name: order.rider.name,
          })),
        'id'
      ),
      areas: [...new Set(orders.map((order) => order.area))],
      payment_methods: [...new Set(orders.map((order) => order.payment_method))],
      statuses: [...new Set(orders.flatMap((order) => [order.status, order.delivery_status]))],
    },
  }
}

const updateOrderStatus = async (orderId, status, adminUser, metadata = {}) => {
  const result = await updateOrderLifecycleState(orderId, status, {
    source: 'admin_panel',
    force: true,
    reason: metadata.reason,
  })

  await recordActivity({
    adminUserId: adminUser.id,
    action: 'order_status_updated',
    entityType: 'order',
    entityId: orderId,
    description: `Order moved to ${prettyLabel(result.status)}`,
    metadata,
  })

  return {
    id: result.order_id,
    status: result.status,
    delivery_status: result.delivery_status,
  }
}

const markDelivered = async (orderId, adminUser) => {
  const result = await updateOrderLifecycleState(orderId, ORDER_STATUS.DELIVERED, {
    source: 'admin_panel',
    force: true,
  })

  await recordActivity({
    adminUserId: adminUser.id,
    action: 'order_marked_delivered',
    entityType: 'order',
    entityId: orderId,
    description: 'Order marked as delivered by admin',
  })

  return result
}

const cancelOrder = async (orderId, reason, adminUser) => {
  const result = await updateOrderLifecycleState(orderId, ORDER_STATUS.CANCELLED, {
    source: 'admin_panel',
    force: true,
    reason: reason || 'Cancelled by admin',
  })

  await recordActivity({
    adminUserId: adminUser.id,
    action: 'order_cancelled',
    entityType: 'order',
    entityId: orderId,
    description: reason || 'Order cancelled by admin',
  })

  return result
}

const reassignRider = async (orderId, riderId, adminUser) => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const riderResult = await client.query(
      `SELECT id, full_name, is_suspended, force_offline
       FROM delivery_partners
       WHERE id = $1`,
      [riderId]
    )

    if (riderResult.rows.length === 0) {
      const error = new Error('Delivery partner not found')
      error.status = 404
      throw error
    }

    const rider = riderResult.rows[0]
    if (rider.is_suspended || rider.force_offline) {
      const error = new Error('Selected rider is not available for assignment')
      error.status = 400
      throw error
    }

    const orderDetails = await client.query(
      `SELECT
         o.id,
         o.delivery_partner_id AS previous_delivery_partner_id,
         o.payment_method,
         r.latitude AS restaurant_latitude,
         r.longitude AS restaurant_longitude,
         a.latitude AS customer_latitude,
         a.longitude AS customer_longitude,
         loc.latitude AS rider_latitude,
         loc.longitude AS rider_longitude
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
       JOIN addresses a ON a.id = o.address_id
       LEFT JOIN LATERAL (
         SELECT latitude, longitude
         FROM delivery_locations dl
         WHERE dl.delivery_partner_id = $1
         ORDER BY timestamp DESC
         LIMIT 1
       ) loc ON TRUE
       WHERE o.id = $2
       FOR UPDATE OF o`,
      [riderId, orderId]
    )

    if (orderDetails.rows.length === 0) {
      const error = new Error('Order not found')
      error.status = 404
      throw error
    }

    const order = orderDetails.rows[0]
    const offerMetrics = await buildDeliveryOfferMetrics({
      orderId,
      paymentMethod: order.payment_method,
      restaurantLatitude: order.restaurant_latitude,
      restaurantLongitude: order.restaurant_longitude,
      customerLatitude: order.customer_latitude,
      customerLongitude: order.customer_longitude,
      riderLatitude: order.rider_latitude,
      riderLongitude: order.rider_longitude,
    })

    const orderUpdate = await client.query(
      `UPDATE orders
       SET delivery_partner_id = $1,
           delivery_status = 'ASSIGNED',
           delivery_assigned_at = CURRENT_TIMESTAMP,
           route_distance_km = $2,
           pickup_distance_km = $3,
           dropoff_distance_km = $4,
           estimated_pickup_eta_minutes = $5,
           estimated_dropoff_eta_minutes = $6,
           estimated_total_eta_minutes = $7,
           base_delivery_pay = $8,
           distance_delivery_pay = $9,
           surge_bonus = $10,
           rain_bonus = $11,
           night_bonus = $12,
           cod_handling_bonus = $13,
           estimated_earning = $14,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $15
       RETURNING id`,
      [
        riderId,
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

    if (orderUpdate.rows.length === 0) {
      const error = new Error('Order not found')
      error.status = 404
      throw error
    }

    if (order.previous_delivery_partner_id && order.previous_delivery_partner_id !== riderId) {
      await client.query(
        `UPDATE delivery_partners
         SET current_order_id = NULL,
             current_status = 'AVAILABLE',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND current_order_id = $2`,
        [order.previous_delivery_partner_id, orderId]
      )
    }

    await client.query(
      `UPDATE delivery_partners
       SET current_order_id = $1, current_status = 'ASSIGNED', updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [orderId, riderId]
    )

    await client.query(
      `INSERT INTO delivery_assignments (order_id, delivery_partner_id, assignment_status, assigned_at, updated_at)
       VALUES ($1, $2, 'ASSIGNED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [orderId, riderId]
    )

    await client.query(
      `UPDATE delivery_assignments
       SET earnings = $1,
           distance_km = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $3 AND delivery_partner_id = $4`,
      [offerMetrics.pay.total, offerMetrics.route.dropoffDistanceKm, orderId, riderId]
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
         accepted_at,
         updated_at
       )
       VALUES ($1, $2, 'ASSIGNED', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
         accepted_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
      [
        orderId,
        riderId,
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
       VALUES ($1, $2, $3, $4, $5, 'ASSIGNED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
        riderId,
        order.rider_latitude || null,
        order.rider_longitude || null,
        offerMetrics.route.totalEtaMinutes,
      ]
    )

    await client.query(
      `INSERT INTO delivery_status_logs (order_id, delivery_partner_id, status, notes)
       VALUES ($1, $2, 'ASSIGNED', 'Reassigned by admin control center')`,
      [orderId, riderId]
    )

    await client.query('COMMIT')

    await recordActivity({
      adminUserId: adminUser.id,
      action: 'rider_reassigned',
      entityType: 'order',
      entityId: orderId,
      description: `Delivery reassigned to ${rider.full_name}`,
      metadata: {
        rider_id: riderId,
      },
    })

    emitOrderAssigned(orderId, {
      source: 'admin_reassignment',
      partner_id: riderId,
    }).catch((error) => {
      console.error('Failed to emit realtime admin reassignment event', error)
    })

    return { success: true }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

const listRestaurants = async () => {
  const result = await pool.query(
    `SELECT
       r.id,
       r.name,
       r.rating,
       r.cuisines,
       r.featured,
       r.is_open,
       r.status,
       r.approval_status,
       r.is_suspended,
       r.commission_percentage,
       r.complaints_count,
       r.zone_name,
       COUNT(o.id)::int AS total_orders,
       COUNT(*) FILTER (WHERE o.status = 'cancelled')::int AS cancelled_orders,
       COUNT(*) FILTER (WHERE o.status NOT IN ('cancelled', 'delivered'))::int AS active_orders,
       COALESCE(SUM(o.total), 0)::numeric AS revenue
     FROM restaurants r
     LEFT JOIN orders o ON o.restaurant_id = r.id
     GROUP BY r.id
     ORDER BY revenue DESC, r.created_at DESC`
  )

  const restaurants = result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    cuisines: row.cuisines || [],
    rating: safeNumber(row.rating),
    featured: Boolean(row.featured),
    is_open: Boolean(row.is_open),
    status: row.status,
    approval_status: row.approval_status,
    is_suspended: Boolean(row.is_suspended),
    commission_percentage: safeNumber(row.commission_percentage),
    complaints_count: Number(row.complaints_count || 0),
    zone_name: deriveAreaName(row.id, row.zone_name),
    total_orders: Number(row.total_orders || 0),
    cancelled_orders: Number(row.cancelled_orders || 0),
    active_orders: Number(row.active_orders || 0),
    revenue: safeNumber(row.revenue),
  }))

  return {
    restaurants,
    summary: {
      total: restaurants.length,
      active: restaurants.filter((restaurant) => restaurant.is_open && !restaurant.is_suspended).length,
      featured: restaurants.filter((restaurant) => restaurant.featured).length,
      under_review: restaurants.filter((restaurant) => restaurant.approval_status !== 'approved').length,
    },
  }
}

const updateRestaurant = async (restaurantId, updates, adminUser) => {
  const allowedFields = {
    approval_status: 'approval_status',
    commission_percentage: 'commission_percentage',
    is_suspended: 'is_suspended',
    featured: 'featured',
    is_open: 'is_open',
    status: 'status',
    complaints_count: 'complaints_count',
  }

  const entries = Object.entries(updates).filter(([key, value]) => key in allowedFields && value !== undefined)

  if (entries.length === 0) {
    const error = new Error('No valid restaurant updates provided')
    error.status = 400
    throw error
  }

  const values = []
  const setters = entries.map(([key, value], index) => {
    values.push(value)
    return `${allowedFields[key]} = $${index + 1}`
  })

  values.push(restaurantId)
  const result = await pool.query(
    `UPDATE restaurants
     SET ${setters.join(', ')}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${values.length}
     RETURNING id, name`,
    values
  )

  if (result.rows.length === 0) {
    const error = new Error('Restaurant not found')
    error.status = 404
    throw error
  }

  await recordActivity({
    adminUserId: adminUser.id,
    action: 'restaurant_updated',
    entityType: 'restaurant',
    entityId: restaurantId,
    description: `Restaurant settings updated for ${result.rows[0].name}`,
    metadata: updates,
  })

  return result.rows[0]
}

const listDeliveryPartners = async () => {
  const result = await pool.query(
    `SELECT
       dp.id,
       dp.full_name,
       dp.phone,
       dp.email,
       dp.vehicle_type,
       dp.vehicle_number,
       dp.is_online,
       dp.is_active,
       dp.rating,
       dp.total_deliveries,
       dp.current_status,
       dp.approval_status,
       dp.document_status,
       dp.vehicle_verification_status,
       dp.is_suspended,
       dp.force_offline,
       dp.earnings_balance,
       dp.last_seen_at,
       dp.home_zone,
       COALESCE(SUM(de.amount + de.incentive), 0)::numeric AS total_earnings,
       COUNT(da.id)::int AS assignment_count,
       loc.latitude,
       loc.longitude,
       loc.timestamp AS location_timestamp
     FROM delivery_partners dp
     LEFT JOIN delivery_earnings de ON de.delivery_partner_id = dp.id
     LEFT JOIN delivery_assignments da ON da.delivery_partner_id = dp.id
     LEFT JOIN LATERAL (
       SELECT latitude, longitude, timestamp
       FROM delivery_locations dl
       WHERE dl.delivery_partner_id = dp.id
       ORDER BY timestamp DESC
       LIMIT 1
     ) loc ON TRUE
     GROUP BY dp.id, loc.latitude, loc.longitude, loc.timestamp
     ORDER BY dp.created_at DESC`
  )

  const partners = result.rows.map((row) => ({
    id: row.id,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email,
    vehicle_type: row.vehicle_type,
    vehicle_number: row.vehicle_number,
    is_online: Boolean(row.is_online),
    is_active: Boolean(row.is_active),
    rating: safeNumber(row.rating),
    total_deliveries: Number(row.total_deliveries || 0),
    current_status: row.current_status,
    approval_status: row.approval_status,
    document_status: row.document_status,
    vehicle_verification_status: row.vehicle_verification_status,
    is_suspended: Boolean(row.is_suspended),
    force_offline: Boolean(row.force_offline),
    earnings_balance: safeNumber(row.earnings_balance),
    total_earnings: safeNumber(row.total_earnings),
    assignment_count: Number(row.assignment_count || 0),
    last_seen_at: row.last_seen_at || row.location_timestamp,
    home_zone: deriveAreaName(row.id, row.home_zone),
    latitude: resolveCoordinate(row.id, row.latitude, 16.799, 16.836),
    longitude: resolveCoordinate(row.id, row.longitude, 81.501, 81.552),
  }))

  return {
    partners,
    summary: {
      total: partners.length,
      online: partners.filter((partner) => partner.is_online && !partner.force_offline).length,
      suspended: partners.filter((partner) => partner.is_suspended).length,
      pending_approval: partners.filter((partner) => partner.approval_status !== 'approved').length,
    },
  }
}

const updateDeliveryPartner = async (partnerId, updates, adminUser) => {
  const allowedFields = {
    approval_status: 'approval_status',
    document_status: 'document_status',
    vehicle_verification_status: 'vehicle_verification_status',
    is_suspended: 'is_suspended',
    force_offline: 'force_offline',
    is_active: 'is_active',
    current_status: 'current_status',
  }

  const entries = Object.entries(updates).filter(([key, value]) => key in allowedFields && value !== undefined)

  if (entries.length === 0) {
    const error = new Error('No valid delivery partner updates provided')
    error.status = 400
    throw error
  }

  const values = []
  const setters = entries.map(([key, value], index) => {
    values.push(value)
    return `${allowedFields[key]} = $${index + 1}`
  })

  if (updates.force_offline === true) {
    setters.push('is_online = FALSE')
  }

  values.push(partnerId)
  const result = await pool.query(
    `UPDATE delivery_partners
     SET ${setters.join(', ')}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${values.length}
     RETURNING id, full_name`,
    values
  )

  if (result.rows.length === 0) {
    const error = new Error('Delivery partner not found')
    error.status = 404
    throw error
  }

  await recordActivity({
    adminUserId: adminUser.id,
    action: 'delivery_partner_updated',
    entityType: 'delivery_partner',
    entityId: partnerId,
    description: `Delivery partner updated: ${result.rows[0].full_name}`,
    metadata: updates,
  })

  return result.rows[0]
}

const listCustomers = async () => {
  const result = await pool.query(
    `SELECT
       u.id,
       u.name,
       u.phone,
       u.email,
       u.created_at,
       u.is_blocked,
       u.fraud_score,
       COUNT(o.id)::int AS total_orders,
       COALESCE(SUM(o.total), 0)::numeric AS total_spent,
       MAX(o.created_at) AS last_order_at,
       COUNT(st.id)::int AS complaint_count
     FROM users u
     LEFT JOIN orders o ON o.user_id = u.id
     LEFT JOIN support_tickets st ON st.customer_id = u.id
     GROUP BY u.id
     ORDER BY last_order_at DESC NULLS LAST, u.created_at DESC`
  )

  const customers = result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    created_at: row.created_at,
    is_blocked: Boolean(row.is_blocked),
    fraud_score: Number(row.fraud_score || 0),
    total_orders: Number(row.total_orders || 0),
    total_spent: safeNumber(row.total_spent),
    last_order_at: row.last_order_at,
    complaint_count: Number(row.complaint_count || 0),
  }))

  return {
    customers,
    summary: {
      total: customers.length,
      blocked: customers.filter((customer) => customer.is_blocked).length,
      flagged: customers.filter((customer) => customer.fraud_score >= 60).length,
      active: customers.filter((customer) => customer.total_orders > 0).length,
    },
  }
}

const updateCustomer = async (customerId, updates, adminUser) => {
  const allowedFields = {
    is_blocked: 'is_blocked',
    fraud_score: 'fraud_score',
    name: 'name',
    email: 'email',
  }

  const entries = Object.entries(updates).filter(([key, value]) => key in allowedFields && value !== undefined)

  if (entries.length === 0) {
    const error = new Error('No valid customer updates provided')
    error.status = 400
    throw error
  }

  const values = []
  const setters = entries.map(([key, value], index) => {
    values.push(value)
    return `${allowedFields[key]} = $${index + 1}`
  })

  values.push(customerId)
  const result = await pool.query(
    `UPDATE users
     SET ${setters.join(', ')}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${values.length}
     RETURNING id, name`,
    values
  )

  if (result.rows.length === 0) {
    const error = new Error('Customer not found')
    error.status = 404
    throw error
  }

  await recordActivity({
    adminUserId: adminUser.id,
    action: 'customer_updated',
    entityType: 'customer',
    entityId: customerId,
    description: `Customer profile updated for ${result.rows[0].name}`,
    metadata: updates,
  })

  return result.rows[0]
}

const getAnalytics = async () => {
  const [orders, restaurantsPayload, partnersPayload, customersPayload] = await Promise.all([
    getOrderRows(250),
    listRestaurants(),
    listDeliveryPartners(),
    listCustomers(),
  ])

  const orderTrends = Array.from({ length: 14 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (13 - index))
    date.setHours(0, 0, 0, 0)

    const end = new Date(date)
    end.setDate(end.getDate() + 1)

    const dayOrders = orders.filter((order) => {
      const orderDate = new Date(order.created_at)
      return orderDate >= date && orderDate < end
    })

    return {
      date: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      orders: dayOrders.length,
      revenue: dayOrders.reduce((sum, order) => sum + order.total, 0),
      commission: dayOrders.reduce((sum, order) => sum + order.platform_commission_amount, 0),
    }
  })

  const busiestZones = groupByCount(orders, (order) => order.area)
    .map(([zone, items]) => ({
      zone,
      orders: items.length,
      revenue: items.reduce((sum, order) => sum + order.total, 0),
      delays: items.filter((order) => order.is_delayed).length,
    }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 6)

  const riderEfficiency = partnersPayload.partners
    .map((partner) => ({
      name: partner.full_name,
      deliveries: partner.total_deliveries,
      rating: partner.rating,
      earnings: partner.total_earnings,
    }))
    .sort((a, b) => b.deliveries - a.deliveries)
    .slice(0, 6)

  const customerGrowth = Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (5 - index), 1)
    date.setHours(0, 0, 0, 0)

    const end = new Date(date)
    end.setMonth(end.getMonth() + 1)

    const customers = customersPayload.customers.filter((customer) => {
      const createdAt = new Date(customer.created_at)
      return createdAt >= date && createdAt < end
    })

    return {
      month: date.toLocaleDateString('en-IN', { month: 'short' }),
      users: customers.length,
    }
  })

  return {
    order_trends: orderTrends,
    busiest_zones: busiestZones,
    top_restaurants: restaurantsPayload.restaurants.slice(0, 6).map((restaurant) => ({
      name: restaurant.name,
      revenue: restaurant.revenue,
      orders: restaurant.total_orders,
      rating: restaurant.rating,
    })),
    rider_efficiency: riderEfficiency,
    customer_growth: customerGrowth,
    platform_health: {
      avg_delivery_time:
        orders.filter((order) => order.delivered_minutes).reduce((sum, order, _, list) => {
          if (list.length === 0) {
            return 0
          }
          return Math.round(sum + order.delivered_minutes / list.length)
        }, 0) || 0,
      fraud_alerts: customersPayload.customers.filter((customer) => customer.fraud_score >= 60).length,
      cancellation_rate:
        orders.length > 0
          ? Number(((orders.filter((order) => order.status === 'CANCELLED').length / orders.length) * 100).toFixed(1))
          : 0,
      active_restaurants: restaurantsPayload.summary.active,
    },
  }
}

const getPayments = async () => {
  const [orders, payoutsResult] = await Promise.all([
    getOrderRows(200),
    pool.query(
      `SELECT pt.*, r.name AS restaurant_name, dp.full_name AS rider_name
       FROM payout_transactions pt
       LEFT JOIN restaurants r ON pt.entity_id = r.id AND pt.entity_type = 'restaurant'
       LEFT JOIN delivery_partners dp ON pt.entity_id = dp.id AND pt.entity_type = 'delivery_partner'
       ORDER BY pt.created_at DESC
       LIMIT 50`
    ),
  ])

  const payoutTransactions = payoutsResult.rows.map((row) => ({
    id: row.id,
    entity_type: row.entity_type,
    entity_name: row.restaurant_name || row.rider_name || 'Platform Wallet',
    order_id: row.order_id,
    amount: safeNumber(row.amount),
    commission_amount: safeNumber(row.commission_amount),
    settlement_amount: safeNumber(row.settlement_amount),
    status: row.status,
    payout_reference: row.payout_reference,
    due_date: row.due_date,
    settled_at: row.settled_at,
    notes: row.notes,
    created_at: row.created_at,
  }))

  const platformRevenue = orders.reduce((sum, order) => sum + order.platform_commission_amount, 0)
  const codReconciliation = orders
    .filter((order) => order.payment_method === 'COD')
    .reduce((sum, order) => sum + order.total, 0)

  return {
    overview: {
      platform_revenue: platformRevenue,
      restaurant_payouts: payoutTransactions
        .filter((transaction) => transaction.entity_type === 'restaurant')
        .reduce((sum, transaction) => sum + transaction.settlement_amount, 0),
      rider_payouts: payoutTransactions
        .filter((transaction) => transaction.entity_type === 'delivery_partner')
        .reduce((sum, transaction) => sum + transaction.settlement_amount, 0),
      pending_settlements: payoutTransactions
        .filter((transaction) => transaction.status !== 'settled')
        .reduce((sum, transaction) => sum + transaction.settlement_amount, 0),
      cod_reconciliation: codReconciliation,
      commission_breakdown: platformRevenue,
    },
    payouts: payoutTransactions,
    settlement_status: groupByCount(payoutTransactions, (transaction) => transaction.status).map(
      ([status, items]) => ({
        status,
        count: items.length,
        amount: items.reduce((sum, item) => sum + item.settlement_amount, 0),
      })
    ),
  }
}

const getSupport = async () => {
  const result = await pool.query(
    `SELECT
       st.*,
       u.name AS customer_name,
       u.phone AS customer_phone,
       au.full_name AS assigned_admin_name,
       r.name AS restaurant_name
     FROM support_tickets st
     LEFT JOIN users u ON u.id = st.customer_id
     LEFT JOIN admin_users au ON au.id = st.assigned_admin_id
     LEFT JOIN orders o ON o.id = st.order_id
     LEFT JOIN restaurants r ON r.id = o.restaurant_id
     ORDER BY st.updated_at DESC, st.created_at DESC`
  )

  const tickets = result.rows.map((row) => ({
    id: row.id,
    customer_id: row.customer_id,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    order_id: row.order_id,
    restaurant_name: row.restaurant_name,
    assigned_admin_id: row.assigned_admin_id,
    assigned_admin_name: row.assigned_admin_name,
    category: row.category,
    subject: row.subject,
    description: row.description,
    status: row.status,
    priority: row.priority,
    resolution_notes: row.resolution_notes,
    refund_amount: safeNumber(row.refund_amount),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }))

  return {
    tickets,
    summary: {
      open: tickets.filter((ticket) => ticket.status === 'open').length,
      investigating: tickets.filter((ticket) => ticket.status === 'investigating').length,
      resolved: tickets.filter((ticket) => ticket.status === 'resolved').length,
      refunds: tickets.reduce((sum, ticket) => sum + ticket.refund_amount, 0),
    },
  }
}

const updateSupportTicket = async (ticketId, updates, adminUser) => {
  const allowedFields = {
    status: 'status',
    priority: 'priority',
    assigned_admin_id: 'assigned_admin_id',
    resolution_notes: 'resolution_notes',
    refund_amount: 'refund_amount',
  }

  const entries = Object.entries(updates).filter(([key, value]) => key in allowedFields && value !== undefined)

  if (entries.length === 0) {
    const error = new Error('No valid support ticket updates provided')
    error.status = 400
    throw error
  }

  const values = []
  const setters = entries.map(([key, value], index) => {
    values.push(value)
    return `${allowedFields[key]} = $${index + 1}`
  })

  values.push(ticketId)
  const result = await pool.query(
    `UPDATE support_tickets
     SET ${setters.join(', ')}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${values.length}
     RETURNING id, subject`,
    values
  )

  if (result.rows.length === 0) {
    const error = new Error('Support ticket not found')
    error.status = 404
    throw error
  }

  await recordActivity({
    adminUserId: adminUser.id,
    action: 'support_ticket_updated',
    entityType: 'support_ticket',
    entityId: ticketId,
    description: `Support ticket updated: ${result.rows[0].subject}`,
    metadata: updates,
  })

  return result.rows[0]
}

const getPromotions = async () => {
  const [couponResult, restaurantsPayload] = await Promise.all([
    pool.query(
      `SELECT cc.*, r.name AS featured_restaurant_name
       FROM coupon_codes cc
       LEFT JOIN restaurants r ON r.id = cc.featured_restaurant_id
       ORDER BY cc.created_at DESC`
    ),
    listRestaurants(),
  ])

  const coupons = couponResult.rows.map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    discount_type: row.discount_type,
    discount_value: safeNumber(row.discount_value),
    minimum_order_amount: safeNumber(row.minimum_order_amount),
    max_discount_amount: safeNumber(row.max_discount_amount),
    usage_limit: Number(row.usage_limit || 0),
    used_count: Number(row.used_count || 0),
    is_active: Boolean(row.is_active),
    target_audience: row.target_audience,
    featured_restaurant_id: row.featured_restaurant_id,
    featured_restaurant_name: row.featured_restaurant_name,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
  }))

  return {
    coupons,
    featured_restaurants: restaurantsPayload.restaurants
      .filter((restaurant) => restaurant.featured)
      .slice(0, 8),
  }
}

const createCoupon = async (payload, adminUser) => {
  const result = await pool.query(
    `INSERT INTO coupon_codes (
       code, title, description, discount_type, discount_value, minimum_order_amount, max_discount_amount,
       usage_limit, starts_at, ends_at, is_active, target_audience, featured_restaurant_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, CURRENT_TIMESTAMP), $10, COALESCE($11, TRUE), COALESCE($12, 'all'), $13)
     RETURNING id, code, title`,
    [
      String(payload.code || '').toUpperCase(),
      payload.title,
      payload.description || null,
      payload.discount_type || 'flat',
      payload.discount_value,
      payload.minimum_order_amount || 0,
      payload.max_discount_amount || 0,
      payload.usage_limit || 0,
      payload.starts_at || null,
      payload.ends_at || null,
      payload.is_active,
      payload.target_audience,
      payload.featured_restaurant_id || null,
    ]
  )

  await recordActivity({
    adminUserId: adminUser.id,
    action: 'coupon_created',
    entityType: 'coupon',
    entityId: result.rows[0].id,
    description: `Promotion created: ${result.rows[0].code}`,
    metadata: payload,
  })

  return result.rows[0]
}

const getSettings = async () => {
  const result = await pool.query(
    `SELECT ps.*, au.full_name AS updated_by_name
     FROM platform_settings ps
     LEFT JOIN admin_users au ON au.id = ps.updated_by
     ORDER BY ps.category, ps.setting_key`
  )

  return {
    settings: result.rows.map((row) => ({
      id: row.id,
      setting_key: row.setting_key,
      setting_value: row.setting_value,
      description: row.description,
      category: row.category,
      updated_by_name: row.updated_by_name,
      updated_at: row.updated_at,
    })),
  }
}

const updateSettings = async (settings, adminUser) => {
  if (!Array.isArray(settings) || settings.length === 0) {
    const error = new Error('Settings payload must include at least one setting')
    error.status = 400
    throw error
  }

  for (const setting of settings) {
    await pool.query(
      `INSERT INTO platform_settings (setting_key, setting_value, description, category, updated_by)
       VALUES ($1, $2::jsonb, $3, $4, $5)
       ON CONFLICT (setting_key)
       DO UPDATE SET
         setting_value = EXCLUDED.setting_value,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
      [
        setting.setting_key,
        JSON.stringify(setting.setting_value),
        setting.description || null,
        setting.category || 'general',
        adminUser.id,
      ]
    )
  }

  await recordActivity({
    adminUserId: adminUser.id,
    action: 'platform_settings_updated',
    entityType: 'platform_setting',
    description: `Updated ${settings.length} platform setting(s)`,
    metadata: {
      setting_keys: settings.map((setting) => setting.setting_key),
    },
  })

  return getSettings()
}

const getLiveMap = async () => {
  const orders = await getOrderRows(120)
  return buildLiveMapPayload(orders)
}

module.exports = {
  ADMIN_ROLES,
  fetchAdminById,
  loginAdmin,
  refreshAdminSession,
  recordActivity,
  getDashboardData,
  listOrders,
  updateOrderStatus,
  markDelivered,
  cancelOrder,
  reassignRider,
  listRestaurants,
  updateRestaurant,
  listDeliveryPartners,
  updateDeliveryPartner,
  listCustomers,
  updateCustomer,
  getAnalytics,
  getPayments,
  getSupport,
  updateSupportTicket,
  getPromotions,
  createCoupon,
  getSettings,
  updateSettings,
  getLiveMap,
}
