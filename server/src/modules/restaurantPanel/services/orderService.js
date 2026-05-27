const pool = require('../../../database/connection')
const {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  normalizeOrderStatus,
} = require('../constants')
const {
  emitOrderStatusUpdated,
} = require('../../../realtime/orderEvents')
const { autoAssignOrder } = require('../../delivery/services/orderService')
const { applyRestaurantAvailability } = require('../../../utils/restaurantAvailability')

// PRIVACY-FIRST: Restaurant only sees food prep info
// NO customer address, NO location, NO route, NO totals, NO commissions
const buildOrderQuery = `
  SELECT
    o.id,
    o.restaurant_id,
    o.status,
    o.total,
    o.payment_method,
    o.payment_status,
    o.estimated_delivery,
    o.created_at,
    o.updated_at,
    u.name AS customer_name,
    u.phone AS customer_phone,
    COALESCE(
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', oi.id,
          'menu_item_id', oi.menu_item_id,
          'quantity', oi.quantity,
          'price', oi.price,
          'name', mi.name,
          'image', mi.image,
          'notes', oi.notes
        )
      ) FILTER (WHERE oi.id IS NOT NULL),
      '[]'::json
    ) AS items,
    dp.full_name AS rider_name,
    dp.phone AS rider_phone
  FROM orders o
  JOIN users u ON u.id = o.user_id
  LEFT JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
  LEFT JOIN delivery_partners dp ON dp.id = o.delivery_partner_id
`

const mapOrder = (row) => ({
  id: row.id,
  restaurant_id: row.restaurant_id,
  status: normalizeOrderStatus(row.status) || ORDER_STATUSES.PLACED,
  total: Number(row.total || 0),
  payment_method: row.payment_method,
  payment_status: row.payment_status || 'pending',
  estimated_delivery: row.estimated_delivery,
  created_at: row.created_at,
  updated_at: row.updated_at,
  customer: {
    name: row.customer_name || 'Customer',
    phone: row.customer_phone || '',
  },
  items: (row.items || []).map(item => ({
    id: item.id,
    menu_item_id: item.menu_item_id,
    quantity: item.quantity,
    price: Number(item.price),
    name: item.name,
    image: item.image,
    notes: item.notes || '',
  })),
  rider: row.rider_name ? {
    name: row.rider_name,
    phone: row.rider_phone || '',
  } : null,
})

const listRestaurantOrders = async (restaurantId) => {
  const result = await pool.query(
    `${buildOrderQuery}
     WHERE o.restaurant_id = $1
     GROUP BY o.id, u.id, dp.id
     ORDER BY o.created_at DESC`,
    [restaurantId]
  )

  return result.rows.map(mapOrder)
}

const getRestaurantDashboardSummary = async (restaurantId) => {
  const [statsResult, statusResult] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) AS total_orders_today,
         COUNT(*) FILTER (
           WHERE UPPER(status) NOT IN ('DELIVERED', 'CANCELLED')
         ) AS pending_orders
       FROM orders
       WHERE restaurant_id = $1`,
      [restaurantId]
    ),
    pool.query(
      `SELECT
         r.status,
         r.opening_time,
         r.closing_time,
         r.timezone,
         r.is_manually_closed,
         r.offer,
         r.average_rating,
         r.rating_count,
         COUNT(mi.id) FILTER (WHERE mi.in_stock = TRUE) AS active_menu_items
       FROM restaurants r
       LEFT JOIN menu_items mi ON mi.restaurant_id = r.id
       WHERE r.id = $1
       GROUP BY r.id`,
      [restaurantId]
    ),
  ])

  const stats = statsResult.rows[0]
  const details = statusResult.rows[0]
  const availability = details ? applyRestaurantAvailability(details) : null

  return {
    total_orders_today: Number(stats.total_orders_today || 0),
    pending_orders: Number(stats.pending_orders || 0),
    active_menu_items: Number(details?.active_menu_items || 0),
    restaurant_status: availability?.displayStatus || 'OPEN',
    active_offer: details?.offer || '',
    average_rating: Number(details?.average_rating || 0),
    total_reviews: Number(details?.rating_count || 0),
  }
}

const { updateOrderLifecycleState, ORDER_STATUS, normalizeStatus, VALID_TRANSITIONS } = require('../../orders/orderLifecycleService')

const updateRestaurantOrderStatus = async (restaurantId, orderId, nextStatusValue) => {
  const nextStatus = normalizeStatus(nextStatusValue)

  if (!nextStatus) {
    const error = new Error('Invalid status')
    error.status = 400
    throw error
  }

  const orderResult = await pool.query(
    'SELECT id, status FROM orders WHERE id = $1 AND restaurant_id = $2',
    [orderId, restaurantId]
  )

  if (orderResult.rows.length === 0) {
    const error = new Error('Order not found')
    error.status = 404
    throw error
  }

  const currentStatus = normalizeStatus(orderResult.rows[0].status) || ORDER_STATUS.PLACED
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] || []

  if (currentStatus !== nextStatus && !allowedTransitions.includes(nextStatus)) {
    const error = new Error(`Cannot move order from ${currentStatus} to ${nextStatus}`)
    error.status = 400
    throw error
  }

  const result = await updateOrderLifecycleState(orderId, nextStatus, {
    source: 'restaurant_panel',
  })

  const orderDetailsResult = await pool.query(
    `${buildOrderQuery}
     WHERE o.id = $1
       AND o.restaurant_id = $2
     GROUP BY o.id, u.id, dp.id`,
    [orderId, restaurantId]
  )

  if (orderDetailsResult.rows.length === 0) {
    const error = new Error('Order not found after update')
    error.status = 404
    throw error
  }

  if (nextStatus === ORDER_STATUS.PREPARING) {
    try {
      await autoAssignOrder(orderId, {
        source: 'restaurant_preparing',
        dispatchNote: 'Automatic assignment triggered when restaurant started preparing order',
      })
    } catch (error) {
      console.error('Failed to auto-assign delivery partner after restaurant started preparing', error)
    }
  }

  if (nextStatus === ORDER_STATUS.READY_FOR_PICKUP) {
    try {
      await autoAssignOrder(orderId, {
        source: 'restaurant_ready_for_pickup',
        dispatchNote: 'Assignment requested when restaurant marked order ready for pickup',
      })
    } catch (error) {
      console.error('Failed to auto-assign delivery partner', error)
    }
  }

  return mapOrder(orderDetailsResult.rows[0])
}

module.exports = {
  getRestaurantDashboardSummary,
  listRestaurantOrders,
  updateRestaurantOrderStatus,
}
