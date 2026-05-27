/**
 * THINAVA Advanced Order Management APIs
 * Handles order assignment, rejection, pickup, delivery tracking, etc.
 * 
 * Endpoints:
 * - POST /api/orders/create
 * - POST /api/orders/:id/assign-rider
 * - POST /api/orders/:id/reject
 * - POST /api/orders/:id/accept
 * - POST /api/orders/:id/ready-for-pickup
 * - POST /api/orders/:id/picked-up
 * - POST /api/orders/:id/delivered
 * - GET /api/orders/:id/tracking
 * - GET /api/orders/rider/:riderId/active
 */

const express = require('express')
const router = express.Router()
const pool = require('../database/connection')
const { validateOrderTransition } = require('../modules/orders/orderLifecycleService')
const { authenticateCustomer } = require('../modules/auth/middleware/auth')
const { authenticateAdmin } = require('../modules/admin/middleware/auth')
const { authenticateRestaurantOwner } = require('../modules/restaurantPanel/middleware/auth')
const { authenticateDeliveryPartner } = require('../modules/delivery/middleware/auth')
const locationService = require('../modules/delivery/services/locationService')

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// ============================================================
// CREATE ORDER
// ============================================================
router.post('/create', authenticateCustomer, asyncHandler(async (req, res) => {
  const {
    userId,
    restaurantId,
    addressId,
    items,
    subtotal,
    deliveryFee,
    tax,
    total,
    paymentMethod,
    specialInstructions
  } = req.body

  if (!userId || !restaurantId || !addressId || !items || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields'
    })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Create order
    const orderResult = await client.query(
      `INSERT INTO orders 
       (user_id, restaurant_id, address_id, subtotal, delivery_fee, tax, total, status, payment_method, estimated_delivery)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::numeric, $5::numeric, $6::numeric, $7::numeric, $8::text, $9::text, $10::text)
       RETURNING id`,
      [userId, restaurantId, addressId, subtotal, deliveryFee, tax, total, 'PLACED', paymentMethod, '45 mins']
    )

    const orderId = orderResult.rows[0].id

    // Add order items
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, price)
         VALUES ($1::uuid, $2::uuid, $3::int, $4::numeric)`,
        [orderId, item.menuItemId, item.quantity, item.price]
      )
    }

    // Log status
    await client.query(
      `INSERT INTO order_status_history (order_id, new_status, updated_by)
       VALUES ($1::uuid, $2::text, $3::text)`,
      [orderId, 'PLACED', 'customer']
    )

    await client.query('COMMIT')

    // Emit socket event
    const io = req.app.get('io')
    if (io) {
      io.to(`restaurant:${restaurantId}`).emit('orderPlaced', {
        orderId,
        userId,
        restaurantId,
        timestamp: new Date()
      })

      io.to(`customer:${userId}`).emit('orderCreated', {
        orderId,
        status: 'PLACED',
        timestamp: new Date()
      })
    }

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      orderId,
      status: 'PLACED'
    })

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}))

// ============================================================
// ASSIGN RIDER TO ORDER
// ============================================================
router.post('/:id/assign-rider', authenticateAdmin, asyncHandler(async (req, res) => {
  const { id: orderId } = req.params
  const { riderId, assignmentMethod } = req.body // assignmentMethod: 'auto', 'manual'

  if (!riderId) {
    return res.status(400).json({
      success: false,
      error: 'Rider ID required'
    })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Get order and rider details
    const orderResult = await client.query(
      `SELECT o.*, u.id as user_id, r.name as restaurant_name
       FROM orders o
       JOIN users u ON u.id = o.user_id
       JOIN restaurants r ON r.id = o.restaurant_id
       WHERE o.id = $1::uuid`,
      [orderId]
    )

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ success: false, error: 'Order not found' })
    }

    const order = orderResult.rows[0]

    const riderResult = await pool.query(
      `SELECT dp.*, rd.vehicle_type, rd.vehicle_number
       FROM delivery_partners dp
       LEFT JOIN rider_details rd ON rd.delivery_partner_id = dp.id
       WHERE dp.id = $1::uuid`,
      [riderId]
    )

    if (riderResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ success: false, error: 'Rider not found' })
    }

    const rider = riderResult.rows[0]

    // Check if rider has active order
    const activeOrder = await client.query(
      'SELECT id FROM active_delivery_sessions WHERE delivery_partner_id = $1::uuid AND is_active = TRUE',
      [riderId]
    )

    if (activeOrder.rows.length > 0) {
      await client.query('ROLLBACK')
      return res.status(409).json({
        success: false,
        error: 'Rider already has an active delivery'
      })
    }

    // Update order with rider
    await client.query(
      `UPDATE orders 
       SET delivery_partner_id = $1::uuid, rider_name = $2::text, rider_phone = $3::text, status = 'ASSIGNED'
       WHERE id = $4::uuid`,
      [riderId, rider.full_name, rider.phone, orderId]
    )

    // Create active delivery session
    await client.query(
      `INSERT INTO active_delivery_sessions 
       (delivery_partner_id, order_id, pickup_lat, pickup_lon, delivery_lat, delivery_lon, is_active)
       VALUES ($1::uuid, $2::uuid, 0, 0, 0, 0, TRUE)`,[riderId, orderId]
    )

    // Update rider has_active_order flag
    await client.query(
      'UPDATE delivery_partners SET has_active_order = TRUE WHERE id = $1::uuid',
      [riderId]
    )

    // Log status
    await client.query(
      `INSERT INTO order_status_history (order_id, previous_status, new_status, updated_by, notes)
       VALUES ($1::uuid, $2::text, $3::text, $4::text, $5::text)`,
      [orderId, 'PLACED', 'ASSIGNED', 'admin', `Assigned via ${assignmentMethod || 'manual'} dispatch`]
    )

    await client.query('COMMIT')

    // Emit socket events
    const io = req.app.get('io')
    if (io) {
      io.to(`customer:${order.user_id}`).emit('orderAssigned', {
        orderId,
        riderId,
        riderName: rider.full_name,
        riderPhone: rider.phone,
        riderImage: rider.profile_image,
        vehicleType: rider.vehicle_type,
        vehicleNumber: rider.vehicle_number,
        timestamp: new Date()
      })

      io.to(`delivery_partner:${riderId}`).emit('orderAssigned', {
        orderId,
        restaurantName: order.restaurant_name,
        timestamp: new Date()
      })

      io.to(`restaurant:${order.restaurant_id}`).emit('orderAssigned', {
        orderId,
        riderId,
        timestamp: new Date()
      })
    }

    return res.json({
      success: true,
      message: 'Rider assigned successfully',
      orderId,
      riderId,
      status: 'ASSIGNED'
    })

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}))

// ============================================================
// RESTAURANT REJECTS ORDER
// ============================================================
router.post('/:id/reject', authenticateRestaurantOwner, asyncHandler(async (req, res) => {
  const { id: orderId } = req.params
  const { reason } = req.body

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Get order and customer
    const orderResult = await client.query(
      'SELECT user_id, status FROM orders WHERE id = $1::uuid',
      [orderId]
    )

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ success: false, error: 'Order not found' })
    }

    const order = orderResult.rows[0]
    const userId = order.user_id

    // Validate transition
    try {
      validateOrderTransition(order.status, 'CANCELLED')
    } catch (transitionError) {
      await client.query('ROLLBACK')
      return res.status(transitionError.statusCode || 400).json({
        success: false,
        error: transitionError.message,
      })
    }

    // Update order
    await client.query(
      `UPDATE orders 
       SET status = 'REJECTED', rejection_reason = $1::text, rejected_at = NOW()
       WHERE id = $2::uuid`,
      [reason || 'Order rejected by restaurant', orderId]
    )

    // Log status
    await client.query(
      `INSERT INTO order_status_history (order_id, new_status, updated_by, notes)
       VALUES ($1::uuid, $2::text, $3::text, $4::text)`,
      [orderId, 'REJECTED', 'restaurant', reason ?? null]
    )

    // If rider was assigned, release them
    const riderResult = await client.query(
      'SELECT delivery_partner_id FROM orders WHERE id = $1::uuid',
      [orderId]
    )

    if (riderResult.rows[0]?.delivery_partner_id) {
      const riderId = riderResult.rows[0].delivery_partner_id

      await client.query(
        'DELETE FROM active_delivery_sessions WHERE order_id = $1::uuid',
        [orderId]
      )

      await client.query(
        'UPDATE delivery_partners SET has_active_order = FALSE WHERE id = $1::uuid',
        [riderId]
      )
    }

    await client.query('COMMIT')

    // Emit socket event - REJECTION POPUP
    const io = req.app.get('io')
    if (io) {
      io.to(`customer:${userId}`).emit('orderRejected', {
        orderId,
        reason: reason || 'Order was rejected by restaurant',
        refundMessage: 'Full refund will be processed',
        timestamp: new Date(),
        actionable: true // Show retry button
      })
    }

    return res.json({
      success: true,
      message: 'Order rejected',
      orderId,
      status: 'REJECTED'
    })

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}))

// ============================================================
// RESTAURANT ACCEPTS/CONFIRMS ORDER
// ============================================================
router.post('/:id/accept', authenticateRestaurantOwner, asyncHandler(async (req, res) => {
  const { id: orderId } = req.params

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Get current order status for validation
    const preAcceptOrder = await client.query(
      'SELECT status FROM orders WHERE id = $1::uuid FOR UPDATE',
      [orderId]
    )

    if (preAcceptOrder.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ success: false, error: 'Order not found' })
    }

    // Validate transition
    try {
      validateOrderTransition(preAcceptOrder.rows[0].status, 'ACCEPTED')
    } catch (transitionError) {
      await client.query('ROLLBACK')
      return res.status(transitionError.statusCode || 400).json({
        success: false,
        error: transitionError.message,
      })
    }

    // Update order
    await client.query(
      `UPDATE orders SET status = 'CONFIRMED' WHERE id = $1::uuid`,
      [orderId]
    )

    // Log status
    await client.query(
      `INSERT INTO order_status_history (order_id, previous_status, new_status, updated_by)
       VALUES ($1::uuid, $2::text, $3::text, $4::text)`,
      [orderId, 'PLACED', 'CONFIRMED', 'restaurant']
    )

    const orderResult = await client.query(
      'SELECT user_id, delivery_partner_id FROM orders WHERE id = $1::uuid',
      [orderId]
    )

    await client.query('COMMIT')

    const order = orderResult.rows[0]

    // Emit socket events
    const io = req.app.get('io')
    if (io) {
      io.to(`customer:${order.user_id}`).emit('orderAccepted', {
        orderId,
        message: 'Restaurant has confirmed your order! Food will be ready soon.',
        timestamp: new Date()
      })

      if (order.delivery_partner_id) {
        io.to(`delivery_partner:${order.delivery_partner_id}`).emit('orderAccepted', {
          orderId,
          message: 'Order confirmed. Get ready for pickup.',
          timestamp: new Date()
        })
      }
    }

    return res.json({
      success: true,
      message: 'Order confirmed',
      orderId,
      status: 'CONFIRMED'
    })

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}))

// ============================================================
// RESTAURANT MARKS READY FOR PICKUP
// ============================================================
router.post('/:id/ready-for-pickup', authenticateRestaurantOwner, asyncHandler(async (req, res) => {
  const { id: orderId } = req.params

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Get order details
    const orderResult = await client.query(
      'SELECT user_id, delivery_partner_id, status FROM orders WHERE id = $1::uuid',
      [orderId]
    )

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ success: false, error: 'Order not found' })
    }

    const order = orderResult.rows[0]

    // Validate transition
    try {
      validateOrderTransition(order.status, 'READY_FOR_PICKUP')
    } catch (transitionError) {
      await client.query('ROLLBACK')
      return res.status(transitionError.statusCode || 400).json({
        success: false,
        error: transitionError.message,
      })
    }

    // Update order
    await client.query(
      `UPDATE orders SET status = 'READY_FOR_PICKUP' WHERE id = $1::uuid`,
      [orderId]
    )

    // Log status
    await client.query(
      `INSERT INTO order_status_history (order_id, previous_status, new_status, updated_by)
       VALUES ($1::uuid, $2::text, $3::text, $4::text)`,
      [orderId, order.status, 'READY_FOR_PICKUP', 'restaurant']
    )

    await client.query('COMMIT')

    // Emit socket events
    const io = req.app.get('io')
    if (io) {
      if (order.delivery_partner_id) {
        io.to(`delivery_partner:${order.delivery_partner_id}`).emit('orderReadyForPickup', {
          orderId,
          message: 'Order is ready! Please come pick it up.',
          timestamp: new Date()
        })
      }

      io.to(`customer:${order.user_id}`).emit('orderReadyForPickup', {
        orderId,
        message: 'Your order is ready! Rider will pick it up shortly.',
        timestamp: new Date()
      })
    }

    return res.json({
      success: true,
      message: 'Order marked ready for pickup',
      orderId,
      status: 'READY_FOR_PICKUP'
    })

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}))

// ============================================================
// RIDER PICKS UP ORDER
// ============================================================
router.post('/:id/picked-up', authenticateDeliveryPartner, asyncHandler(async (req, res) => {
  const { id: orderId } = req.params
  const partnerId = req.deliveryPartner.id
  const { latitude, longitude, notes } = req.body || {}

  const result = await locationService.updateDeliveryStatus(orderId, partnerId, 'PICKED_UP', latitude, longitude, notes)

  return res.json({
    success: true,
    message: 'Order picked up',
    orderId,
    status: 'PICKED_UP',
    ...result,
  })
}))

// ============================================================
// RIDER DELIVERS ORDER
// ============================================================
router.post('/:id/delivered', authenticateDeliveryPartner, asyncHandler(async (req, res) => {
  const { id: orderId } = req.params
  const partnerId = req.deliveryPartner.id
  const { latitude, longitude, notes } = req.body || {}
  const result = await locationService.updateDeliveryStatus(orderId, partnerId, 'DELIVERED', latitude, longitude, notes)

  return res.json({
    success: true,
    message: 'Order delivered',
    orderId,
    status: 'DELIVERED',
    ...result,
  })
}))

router.post('/:id/delivered-legacy-disabled', authenticateDeliveryPartner, asyncHandler(async (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Legacy delivery completion route is disabled. Use the centralized delivery status endpoint.',
  })

  const { id: orderId } = req.params

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Get order details
    const orderResult = await client.query(
      'SELECT user_id, delivery_partner_id, status FROM orders WHERE id = $1::uuid',
      [orderId]
    )

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ success: false, error: 'Order not found' })
    }

    const order = orderResult.rows[0]

    // Validate transition — this is the critical check that prevents
    // cancelled orders from ever being marked as delivered
    try {
      validateOrderTransition(order.status, 'DELIVERED')
    } catch (transitionError) {
      await client.query('ROLLBACK')
      return res.status(transitionError.statusCode || 400).json({
        success: false,
        error: transitionError.message,
      })
    }

    // Update order
    await client.query(
      `UPDATE orders SET status = 'DELIVERED', delivered_at = NOW() WHERE id = $1::uuid`,
      [orderId]
    )

    // Log status
    await client.query(
      `INSERT INTO order_status_history (order_id, previous_status, new_status, updated_by)
       VALUES ($1::uuid, $2::text, $3::text, $4::text)`,
      [orderId, order.status, 'DELIVERED', 'delivery_partner']
    )

    // Close active delivery session
    await client.query(
      `UPDATE active_delivery_sessions SET is_active = FALSE, session_ended_at = NOW() WHERE order_id = $1::uuid`,
      [orderId]
    )

    // Release rider from active order
    if (order.delivery_partner_id) {
      await client.query(
        'UPDATE delivery_partners SET has_active_order = FALSE WHERE id = $1::uuid',
        [order.delivery_partner_id]
      )
    }

    await client.query('COMMIT')

    // Emit socket events
    const io = req.app.get('io')
    if (io) {
      io.to(`customer:${order.user_id}`).emit('orderDelivered', {
        orderId,
        message: 'Order delivered successfully!',
        timestamp: new Date()
      })

      if (order.delivery_partner_id) {
        io.to(`delivery_partner:${order.delivery_partner_id}`).emit('orderDelivered', {
          orderId,
          message: 'Delivery completed!',
          timestamp: new Date()
        })
      }
    }

    return res.json({
      success: true,
      message: 'Order delivered',
      orderId,
      status: 'DELIVERED'
    })

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}))

// ============================================================
// GET ACTIVE ORDER FOR RIDER
// ============================================================
router.get('/rider/:riderId/active', authenticateDeliveryPartner, asyncHandler(async (req, res) => {
  const { riderId } = req.params

  const result = await pool.query(
    `SELECT o.*, r.name as restaurant_name, a.full_address as delivery_address
     FROM orders o
     JOIN restaurants r ON r.id = o.restaurant_id
     JOIN addresses a ON a.id = o.address_id
     WHERE o.delivery_partner_id = $1::uuid
       AND UPPER(COALESCE(o.status, 'PLACED')) NOT IN ('DELIVERED', 'REJECTED', 'CANCELLED')
     ORDER BY o.created_at DESC
     LIMIT 1`,
    [riderId]
  )

  return res.json({
    success: true,
    activeOrder: result.rows[0] ?? null
  })
}))

module.exports = router
