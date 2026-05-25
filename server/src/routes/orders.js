const express = require('express')
const router = express.Router()
const pool = require('../database/connection')
const { asyncHandler } = require('../utils/asyncHandler')
const { authenticateCustomer } = require('../modules/auth/middleware/auth')
const { authenticateAdmin } = require('../modules/admin/middleware/auth')
const { emitOrderCreated, emitOrderStatusUpdated } = require('../realtime/orderEvents')
const { applyRestaurantAvailability } = require('../utils/restaurantAvailability')

const normalizeOrderStatus = (status) => {
  const normalized = String(status || 'PLACED').trim().toUpperCase()

  const statusMap = {
    PLACED: 'placed',
    ACCEPTED: 'accepted',
    PREPARING: 'preparing',
    READY_FOR_PICKUP: 'ready_for_pickup',
    OUT_FOR_DELIVERY: 'out_for_delivery',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
  }

  return statusMap[normalized] || 'placed'
}

const mapOrderResponse = (order) => ({
  ...order,
  status: normalizeOrderStatus(order.status),
})

// Get user's orders
router.get('/user/:userId', authenticateCustomer, asyncHandler(async (req, res) => {
  if (req.customer.id !== req.params.userId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const result = await pool.query(
    `SELECT
       o.*,
       r.name as restaurant_name,
       r.image as restaurant_image,
       r.latitude as restaurant_latitude,
       r.longitude as restaurant_longitude,
       dp.full_name as rider_name,
       dp.phone as rider_phone,
       dp.profile_image as rider_profile_image,
       dp.vehicle_type as rider_vehicle_type,
       dp.vehicle_number as rider_vehicle_number,
       a.latitude as customer_latitude,
       a.longitude as customer_longitude,
       loc.latitude as rider_latitude,
       loc.longitude as rider_longitude
     FROM orders o 
     JOIN restaurants r ON o.restaurant_id = r.id 
     LEFT JOIN delivery_partners dp ON dp.id = o.delivery_partner_id
     LEFT JOIN addresses a ON a.id = o.address_id
     LEFT JOIN LATERAL (
       SELECT latitude, longitude
       FROM delivery_locations dl
       WHERE dl.delivery_partner_id = o.delivery_partner_id
       ORDER BY timestamp DESC
       LIMIT 1
     ) loc ON TRUE
     WHERE o.user_id = $1 
     ORDER BY o.created_at DESC`,
    [req.params.userId]
  )
  
  res.json({ success: true, orders: result.rows.map(mapOrderResponse) })
}))

// Get order by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const orderResult = await pool.query(
    `SELECT
       o.*,
       r.name as restaurant_name,
       r.image as restaurant_image,
       r.latitude as restaurant_latitude,
       r.longitude as restaurant_longitude,
       dp.full_name as rider_name,
       dp.phone as rider_phone,
       dp.profile_image as rider_profile_image,
       dp.vehicle_type as rider_vehicle_type,
       dp.vehicle_number as rider_vehicle_number,
       a.full_address,
       a.landmark,
       a.latitude as customer_latitude,
       a.longitude as customer_longitude,
       loc.latitude as rider_latitude,
       loc.longitude as rider_longitude
     FROM orders o 
     JOIN restaurants r ON o.restaurant_id = r.id 
     LEFT JOIN delivery_partners dp ON dp.id = o.delivery_partner_id
     LEFT JOIN addresses a ON o.address_id = a.id
     LEFT JOIN LATERAL (
       SELECT latitude, longitude
       FROM delivery_locations dl
       WHERE dl.delivery_partner_id = o.delivery_partner_id
       ORDER BY timestamp DESC
       LIMIT 1
     ) loc ON TRUE
     WHERE o.id = $1`,
    [req.params.id]
  )
  
  if (orderResult.rows.length === 0) {
    const error = new Error('Order not found')
    error.status = 404
    throw error
  }
  
  const order = mapOrderResponse(orderResult.rows[0])
  
  const itemsResult = await pool.query(
    `SELECT oi.*, mi.name, mi.image 
     FROM order_items oi 
     JOIN menu_items mi ON oi.menu_item_id = mi.id 
     WHERE oi.order_id = $1`,
    [req.params.id]
  )
  
  order.items = itemsResult.rows
  
  res.json({ success: true, order })
}))

// Create order
router.post('/', authenticateCustomer, asyncHandler(async (req, res) => {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    
    // Log incoming request for debugging
    console.log('📋 Order creation request:', {
      authenticatedUserId: req.customer.id,
      authenticatedCustomerData: { id: req.customer.id, name: req.customer.name },
      requestBodyKeys: Object.keys(req.body),
    })
    
    const {
      restaurant_id,
      address_id,
      delivery_address,
      items,
      subtotal,
      delivery_fee,
      tax,
      total,
      total_amount,
      status,
      payment_method
    } = req.body

    // SECURITY: Always use authenticated customer ID from JWT, never trust frontend-provided user_id
    // Frontend should NOT send user_id at all - auth is handled via JWT token
    const authenticatedUserId = req.customer.id
    
    console.log('✅ Using authenticated user ID:', authenticatedUserId)

    if (!restaurant_id || !Array.isArray(items) || items.length === 0 || !payment_method) {
      console.log('❌ Missing required fields:', { restaurant_id, itemsCount: items?.length, payment_method })
      return res.status(400).json({
        error: 'restaurant_id, items, and payment_method are required',
      })
    }

    if (!address_id && !delivery_address?.full_address) {
      console.log('❌ Missing delivery address')
      return res.status(400).json({
        error: 'delivery_address is required when address_id is not provided',
      })
    }

    const restaurantResult = await client.query(
      `SELECT id, name, opening_time, closing_time, timezone, is_manually_closed
       FROM restaurants
       WHERE id = $1`,
      [restaurant_id]
    )

    if (restaurantResult.rows.length === 0) {
      const error = new Error('Restaurant not found')
      error.status = 404
      throw error
    }

    const restaurantAvailability = applyRestaurantAvailability(restaurantResult.rows[0])
    if (!restaurantAvailability.isOpenNow) {
      const error = new Error('This restaurant is currently closed.')
      error.status = 409
      error.code = 'RESTAURANT_CLOSED'
      throw error
    }

    // Use authenticated user ID - this is the source of truth
    let resolvedUserId = authenticatedUserId
    console.log('🔒 Order will be created for authenticated user:', resolvedUserId)

    // Update authenticated user profile from delivery contact info if provided
    if (delivery_address?.contact_name || delivery_address?.phone || delivery_address?.email) {
      const contactName = delivery_address?.contact_name?.trim()
      const contactPhone = delivery_address?.phone?.trim()
      const contactEmail = delivery_address?.email?.trim()

      if (contactName || contactPhone || contactEmail) {
        console.log('📝 Updating user profile from delivery address')
        await client.query(
          'UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone), email = COALESCE($3, email), updated_at = CURRENT_TIMESTAMP WHERE id = $4',
          [
            contactName || null,
            contactPhone || null,
            contactEmail || null,
            authenticatedUserId
          ]
        )
      }
    }

    let resolvedAddressId = address_id

    if (!resolvedAddressId) {
      const createdAddress = await client.query(
        `INSERT INTO addresses (user_id, label, full_address, landmark, is_default)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          resolvedUserId,
          delivery_address?.label || 'Delivery Address',
          delivery_address?.full_address,
          delivery_address?.landmark || null,
          false,
        ]
      )

      resolvedAddressId = createdAddress.rows[0].id
    }

    const normalizedStatus = normalizeOrderStatus(status)
    const resolvedTotal = total ?? total_amount
    
    console.log('💾 Creating order in database:', {
      userId: resolvedUserId,
      restaurantId: restaurant_id,
      addressId: resolvedAddressId,
      itemsCount: items.length,
      total: resolvedTotal,
      paymentMethod: payment_method
    })
    
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, restaurant_id, address_id, subtotal, delivery_fee, tax, total, payment_method, status, estimated_delivery)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '25-35 mins')
       RETURNING *`,
      [
        resolvedUserId,
        restaurant_id,
        resolvedAddressId,
        subtotal,
        delivery_fee,
        tax,
        resolvedTotal,
        payment_method,
        normalizedStatus,
      ]
    )
    
    const order = orderResult.rows[0]
    
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, price)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.menu_item_id, item.quantity, item.price]
      )
    }
    
    await client.query('COMMIT')
    
    console.log('✅ Order created successfully:', {
      orderId: order.id,
      userId: order.user_id,
      restaurantId: order.restaurant_id,
      status: order.status,
      total: order.total
    })

    emitOrderCreated(order.id).catch((error) => {
      console.error('[REALTIME_ERROR] Failed to emit order creation event:', error.message)
    })
    
    res.status(201).json({ success: true, order })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('❌ Order creation error:', {
      message: error.message,
      authenticatedUserId: req.customer.id,
      stack: error.stack
    })
    throw error
  } finally {
    client.release()
  }
}))

// Update order status (admin only)
router.put('/:id/status', authenticateAdmin, asyncHandler(async (req, res) => {
  const normalizedStatus = normalizeOrderStatus(req.body.status)

  if (!normalizedStatus) {
    const error = new Error('Invalid status')
    error.status = 400
    throw error
  }
  
  const result = await pool.query(
    'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
    [normalizedStatus, req.params.id]
  )
  
  if (result.rows.length === 0) {
    const error = new Error('Order not found')
    error.status = 404
    throw error
  }

  emitOrderStatusUpdated(req.params.id, {
    source: 'orders_route',
    normalized_status: normalizedStatus,
  }).catch((error) => {
    console.error('[REALTIME_ERROR] Failed to emit order status event:', error.message)
  })
  
  res.json({ success: true, order: mapOrderResponse(result.rows[0]) })
}))

module.exports = router
