const express = require('express')
const router = express.Router()
const pool = require('../database/connection')
const { asyncHandler } = require('../utils/asyncHandler')
const { authenticateCustomer } = require('../modules/auth/middleware/auth')
const { authenticateAdmin } = require('../modules/admin/middleware/auth')
const { emitOrderCreated, emitOrderStatusUpdated } = require('../realtime/orderEvents')
const { applyRestaurantAvailability } = require('../utils/restaurantAvailability')
const { logger } = require('../lib/logger')

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const createHttpError = (message, status = 400, code = 'ORDER_VALIDATION_FAILED', details = undefined) => {
  const error = new Error(message)
  error.status = status
  error.code = code
  if (details !== undefined) {
    error.details = details
  }
  return error
}

const roundCurrency = (value) => Math.round(Number(value || 0) * 100) / 100
const normalizeTipAmount = (value) => {
  const tip = roundCurrency(value ?? 0)
  return Number.isFinite(tip) && tip > 0 ? Math.min(tip, 500) : 0
}

const assertUuid = (value, fieldName) => {
  if (!value || !UUID_PATTERN.test(String(value))) {
    throw createHttpError(`${fieldName} is invalid`, 400, 'INVALID_ORDER_INPUT', { field: fieldName })
  }
}

const normalizePaymentMethod = (value) => {
  const method = String(value || '').trim().toLowerCase()
  if (method === 'cod' || method === 'upi') {
    return method
  }
  throw createHttpError('Select either COD or UPI payment before placing the order.', 400, 'INVALID_PAYMENT_METHOD')
}

const calculateDeliveryFee = (subtotal) => (Number(subtotal || 0) >= 300 ? 0 : 40)
const calculateTax = (subtotal) => Math.round(Number(subtotal || 0) * 0.05)

const getCouponDiscount = async (client, code, subtotal, deliveryFee) => {
  const normalizedCode = String(code || '').trim().toUpperCase()
  if (!normalizedCode) {
    return { code: null, discountAmount: 0, source: null }
  }

  let result = await client.query(
    `SELECT code, description, discount_type, discount_value, min_order, max_discount
     FROM coupons
     WHERE code = $1::text
       AND active = TRUE
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [normalizedCode]
  )

  let coupon = result.rows[0]
  let source = 'legacy'

  if (!coupon) {
    result = await client.query(
      `SELECT code, title AS description, discount_type, discount_value,
              minimum_order_amount AS min_order, max_discount_amount AS max_discount,
              usage_limit, used_count
       FROM coupon_codes
        WHERE code = $1::text
         AND is_active = TRUE
         AND (ends_at IS NULL OR ends_at > NOW())
         AND (usage_limit = 0 OR used_count < usage_limit)`,
      [normalizedCode]
    )
    coupon = result.rows[0]
    source = 'admin'
  }

  if (!coupon) {
    throw createHttpError('Coupon code is invalid or has expired.', 400, 'INVALID_COUPON')
  }

  const minOrder = Number(coupon.min_order || 0)
  if (Number(subtotal) < minOrder) {
    throw createHttpError(
      `${coupon.code} requires a minimum order of Rs. ${minOrder}.`,
      400,
      'COUPON_MINIMUM_NOT_MET'
    )
  }

  const discountType = String(coupon.discount_type || '').toLowerCase()
  const discountValue = Number(coupon.discount_value || 0)
  const maxDiscount = Number(coupon.max_discount || 0)
  let discountAmount = 0

  if (discountType === 'percentage') {
    discountAmount = (Number(subtotal) * discountValue) / 100
    if (maxDiscount > 0) {
      discountAmount = Math.min(discountAmount, maxDiscount)
    }
  } else {
    discountAmount = coupon.code === 'FREEDEL' ? Number(deliveryFee || 0) : discountValue
  }

  return {
    code: coupon.code,
    discountAmount: roundCurrency(Math.max(0, discountAmount)),
    source,
  }
}

const mapCreateOrderDbError = (error) => {
  if (!error?.code) return error

  if (error.code === '23503') {
    return createHttpError('One of the selected cart items, restaurant, or address no longer exists.', 400, 'ORDER_REFERENCE_INVALID')
  }
  if (error.code === '23502') {
    return createHttpError('Order is missing required information. Please review checkout details.', 400, 'ORDER_REQUIRED_FIELD_MISSING')
  }
  if (error.code === '22P02') {
    return createHttpError('Order contains an invalid identifier. Please refresh the cart and try again.', 400, 'ORDER_INVALID_IDENTIFIER')
  }

  return error
}

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
     WHERE o.user_id = $1::uuid 
     ORDER BY o.created_at DESC`,
    [req.params.userId]
  )
  
  const orders = result.rows.map(mapOrderResponse)
  const orderIds = orders.map((order) => order.id)

  if (orderIds.length > 0) {
    const itemsResult = await pool.query(
      `SELECT oi.order_id, oi.id, oi.menu_item_id, oi.quantity, oi.price, oi.notes, mi.name, mi.image
       FROM order_items oi
       LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE oi.order_id = ANY($1::uuid[])
       ORDER BY oi.order_id ASC, mi.name ASC, oi.id ASC`,
      [orderIds]
    )
    const itemsByOrderId = new Map()
    for (const item of itemsResult.rows) {
      const list = itemsByOrderId.get(item.order_id) || []
      list.push(item)
      itemsByOrderId.set(item.order_id, list)
    }

    orders.forEach((order) => {
      order.items = itemsByOrderId.get(order.id) || []
    })
  }

  res.json({ success: true, orders })
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
      WHERE o.id = $1::uuid`,
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
     WHERE oi.order_id = $1::uuid`,
    [req.params.id]
  )
  
  order.items = itemsResult.rows
  
  res.json({ success: true, order })
}))

// Create order
router.post('/', authenticateCustomer, asyncHandler(async (req, res) => {
  const client = await pool.connect()

  try {
    const {
      restaurant_id,
      address_id,
      delivery_address,
      items,
      total,
      total_amount,
      status,
      payment_method,
      coupon_code,
    } = req.body

    const authenticatedUserId = req.customer.id

    logger.info('Order creation requested', {
      tag: 'orders',
      requestId: req.id,
      customerId: authenticatedUserId,
      restaurantId: restaurant_id,
      addressId: address_id,
      itemsCount: Array.isArray(items) ? items.length : 0,
      paymentMethod: payment_method,
      hasCoupon: Boolean(coupon_code),
    })

    assertUuid(restaurant_id, 'restaurant_id')
    if (address_id) {
      assertUuid(address_id, 'address_id')
    }

    const paymentMethod = normalizePaymentMethod(payment_method)

    if (!Array.isArray(items) || items.length === 0) {
      throw createHttpError('Your cart is empty. Add at least one item before placing the order.', 400, 'EMPTY_CART')
    }

    if (!address_id && !delivery_address?.full_address) {
      throw createHttpError('Please choose or enter a delivery address.', 400, 'DELIVERY_ADDRESS_REQUIRED')
    }

    const normalizedItems = items.map((item, index) => {
      assertUuid(item?.menu_item_id, `items[${index}].menu_item_id`)
      const quantity = Number(item.quantity)

      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 50) {
        throw createHttpError('Cart item quantity is invalid.', 400, 'INVALID_CART_QUANTITY', {
          index,
          menu_item_id: item?.menu_item_id,
        })
      }

      return {
        menu_item_id: item.menu_item_id,
        quantity,
        notes: typeof item.notes === 'string' ? item.notes.trim().slice(0, 240) : '',
      }
    })

    await client.query('BEGIN')

    const restaurantResult = await client.query(
      `SELECT id, name, opening_time, closing_time, timezone, is_manually_closed
       FROM restaurants
       WHERE id = $1::uuid`,
      [restaurant_id]
    )

    if (restaurantResult.rows.length === 0) {
      throw createHttpError('Restaurant not found.', 404, 'RESTAURANT_NOT_FOUND')
    }

    const restaurantAvailability = applyRestaurantAvailability(restaurantResult.rows[0])
    if (!restaurantAvailability.isOpenNow) {
      throw createHttpError('This restaurant is currently closed.', 409, 'RESTAURANT_CLOSED')
    }

    const menuItemIds = [...new Set(normalizedItems.map((item) => item.menu_item_id))]
    const menuResult = await client.query(
      `SELECT id, restaurant_id, name, price, COALESCE(in_stock, TRUE) AS in_stock
       FROM menu_items
       WHERE id = ANY($1::uuid[])`,
      [menuItemIds]
    )

    const menuById = new Map(menuResult.rows.map((row) => [row.id, row]))
    const missingItems = menuItemIds.filter((itemId) => !menuById.has(itemId))
    if (missingItems.length > 0) {
      throw createHttpError('Some cart items are no longer available. Please refresh your cart.', 400, 'CART_ITEM_NOT_FOUND')
    }

    const unavailableItem = menuResult.rows.find(
      (item) => item.restaurant_id !== restaurant_id || !item.in_stock
    )
    if (unavailableItem) {
      throw createHttpError(
        `${unavailableItem.name || 'A cart item'} is currently unavailable.`,
        409,
        'CART_ITEM_UNAVAILABLE',
        { menu_item_id: unavailableItem.id }
      )
    }

    if (delivery_address?.contact_name || delivery_address?.phone || delivery_address?.email) {
      const contactName = delivery_address?.contact_name?.trim()
      const contactPhone = delivery_address?.phone?.trim()
      const contactEmail = delivery_address?.email?.trim()

      if (contactName || contactPhone || contactEmail) {
        await client.query(
          'UPDATE users SET name = COALESCE($1::text, name), phone = COALESCE($2::text, phone), email = COALESCE($3::text, email), updated_at = CURRENT_TIMESTAMP WHERE id = $4::uuid',
          [
            contactName ? contactName : null,
            contactPhone ? contactPhone : null,
            contactEmail ? contactEmail : null,
            authenticatedUserId,
          ]
        )
      }
    }

    let resolvedAddressId = address_id

    if (resolvedAddressId) {
      const addressResult = await client.query(
        'SELECT id FROM addresses WHERE id = $1::uuid AND user_id = $2::uuid',
        [resolvedAddressId, authenticatedUserId]
      )
      if (addressResult.rows.length === 0) {
        throw createHttpError('Selected delivery address was not found. Please choose another address.', 400, 'ADDRESS_NOT_FOUND')
      }
    } else {
      const createdAddress = await client.query(
        `INSERT INTO addresses (user_id, label, full_address, landmark, notes, latitude, longitude, is_default)
         VALUES ($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::numeric, $7::numeric, $8::boolean)
         RETURNING id`,
        [
          authenticatedUserId,
          delivery_address?.label ?? 'Delivery Address',
          delivery_address?.full_address,
          delivery_address?.landmark ?? null,
          delivery_address?.notes ?? null,
          delivery_address?.latitude ?? null,
          delivery_address?.longitude ?? null,
          false,
        ]
      )

      resolvedAddressId = createdAddress.rows[0].id
    }

    const normalizedStatus = normalizeOrderStatus(status)
    const subtotal = roundCurrency(
      normalizedItems.reduce((sum, item) => {
        const menuItem = menuById.get(item.menu_item_id)
        return sum + Number(menuItem.price || 0) * item.quantity
      }, 0)
    )
    const deliveryFee = roundCurrency(calculateDeliveryFee(subtotal))
    const tax = roundCurrency(calculateTax(subtotal))
    const tipAmount = normalizeTipAmount(req.body?.tip ?? req.body?.tip_amount)
    const coupon = await getCouponDiscount(client, coupon_code, subtotal, deliveryFee)
    const resolvedTotal = roundCurrency(Math.max(subtotal + deliveryFee + tax + tipAmount - coupon.discountAmount, 0))
    const submittedTotal = roundCurrency(total ?? total_amount ?? resolvedTotal)

    if (Math.abs(submittedTotal - resolvedTotal) > 1) {
      throw createHttpError(
        'Cart total changed while placing the order. Please review checkout and try again.',
        409,
        'ORDER_TOTAL_MISMATCH',
        { expected_total: resolvedTotal, submitted_total: submittedTotal }
      )
    }

    const paymentStatus = paymentMethod === 'cod' ? 'cod_pending' : 'pending'
    console.log('ORDER PARAM TYPES', {
      paymentMethod: typeof paymentMethod,
      subtotal: typeof subtotal,
      totalAmount: typeof resolvedTotal,
      couponDiscount: typeof coupon.discountAmount,
      addressId: typeof resolvedAddressId,
      tipAmount: typeof tipAmount,
    })
    const orderResult = await client.query(
      `INSERT INTO orders (
         user_id, restaurant_id, address_id, subtotal, delivery_fee, tax, total,
         payment_method, payment_type, payment_status, status, estimated_delivery,
         coupon_code, discount_amount, tip_amount
       )
       VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::numeric, $5::numeric, $6::numeric, $7::numeric,
         $8::text, $9::text, $10::text, $11::text, '25-35 mins',
         $12::text, $13::numeric, $14::numeric
       )
       RETURNING *`,
      [
        authenticatedUserId,
        restaurant_id,
        resolvedAddressId,
        subtotal,
        deliveryFee,
        tax,
        resolvedTotal,
        paymentMethod,        // $8 - payment_method
        paymentMethod,        // $9 - payment_type (same as method)
        paymentStatus,        // $10 - payment_status
        normalizedStatus,     // $11 - status
        coupon.code,          // $12 - coupon_code
        coupon.discountAmount, // $13 - discount_amount
        tipAmount,            // $14 - tip_amount
      ]
    )

    const order = orderResult.rows[0]

    for (const item of normalizedItems) {
      const menuItem = menuById.get(item.menu_item_id)
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, price, notes)
         VALUES ($1::uuid, $2::uuid, $3::int, $4::numeric, $5::text)`,
        [order.id, item.menu_item_id, item.quantity, menuItem.price, item.notes]
      )
    }

    if (coupon.code && coupon.source === 'admin') {
      await client.query(
        'UPDATE coupon_codes SET used_count = used_count + 1, updated_at = CURRENT_TIMESTAMP WHERE code = $1::text',
        [coupon.code]
      )
    }

    await client.query('COMMIT')

    logger.info('Order created successfully', {
      tag: 'orders',
      requestId: req.id,
      orderId: order.id,
      customerId: order.user_id,
      restaurantId: order.restaurant_id,
      status: order.status,
      paymentMethod,
      total: Number(order.total || 0),
    })

    emitOrderCreated(order.id).catch((error) => {
      logger.error('Failed to emit order creation event', {
        tag: 'realtime',
        requestId: req.id,
        orderId: order.id,
        error,
      })
    })

    res.status(201).json({ success: true, order })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})

    const mappedError = mapCreateOrderDbError(error)
    logger.error('Order creation failed', {
      tag: 'orders',
      requestId: req.id,
      customerId: req.customer.id,
      restaurantId: req.body?.restaurant_id,
      itemsCount: Array.isArray(req.body?.items) ? req.body.items.length : 0,
      paymentMethod: req.body?.payment_method,
      code: mappedError.code,
      dbCode: error.code,
      error: mappedError,
    })

    throw mappedError
  } finally {
    client.release()
  }
}))

// Create order
router.post('/legacy-create-disabled', authenticateCustomer, asyncHandler(async (req, res) => {
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
       WHERE id = $1::uuid`,
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
          'UPDATE users SET name = COALESCE($1::text, name), phone = COALESCE($2::text, phone), email = COALESCE($3::text, email), updated_at = CURRENT_TIMESTAMP WHERE id = $4::uuid',
          [
            contactName ? contactName : null,
            contactPhone ? contactPhone : null,
            contactEmail ? contactEmail : null,
            authenticatedUserId
          ]
        )
      }
    }

    let resolvedAddressId = address_id

    if (!resolvedAddressId) {
      const createdAddress = await client.query(
        `INSERT INTO addresses (user_id, label, full_address, landmark, notes, latitude, longitude, is_default)
         VALUES ($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::numeric, $7::numeric, $8::boolean)
         RETURNING id`,
        [
          resolvedUserId,
          delivery_address?.label ?? 'Delivery Address',
          delivery_address?.full_address,
          delivery_address?.landmark ?? null,
          delivery_address?.notes ?? null,
          delivery_address?.latitude ?? null,
          delivery_address?.longitude ?? null,
          false,
        ]
      )

      resolvedAddressId = createdAddress.rows[0].id
    }

    const normalizedStatus = normalizeOrderStatus(status)
    const tipAmount = normalizeTipAmount(req.body?.tip ?? req.body?.tip_amount)
    const resolvedTotal = roundCurrency(Number(total ?? total_amount ?? 0) + tipAmount)
    
    console.log('💾 Creating order in database:', {
      userId: resolvedUserId,
      restaurantId: restaurant_id,
      addressId: resolvedAddressId,
      itemsCount: items.length,
      total: resolvedTotal,
      paymentMethod: payment_method
    })
    
    const paymentStatus = String(payment_method || '').toLowerCase() === 'cod' ? 'cod_pending' : 'pending'
    console.log('ORDER PARAM TYPES', {
      paymentMethod: typeof payment_method,
      subtotal: typeof subtotal,
      totalAmount: typeof resolvedTotal,
      couponDiscount: 'number',
      addressId: typeof resolvedAddressId,
      tipAmount: typeof tipAmount,
    })
    const orderResult = await client.query(
      `INSERT INTO orders (
         user_id, restaurant_id, address_id, subtotal, delivery_fee, tax, total,
         payment_method, payment_type, payment_status, status, estimated_delivery, tip_amount
       )
       VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::numeric, $5::numeric, $6::numeric, $7::numeric,
         $8::text, $9::text, $10::text, $11::text, '25-35 mins', $12::numeric
       )
       RETURNING *`,
      [
        resolvedUserId,
        restaurant_id,
        resolvedAddressId,
        subtotal,
        delivery_fee,
        tax,
        resolvedTotal,
        payment_method,       // $8 - payment_method
        payment_method,       // $9 - payment_type (same as method)
        paymentStatus,        // $10 - payment_status
        normalizedStatus,     // $11 - status
        tipAmount,            // $12 - tip_amount
      ]
    )
    
    const order = orderResult.rows[0]
    
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, price)
         VALUES ($1::uuid, $2::uuid, $3::int, $4::numeric)`,
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
    'UPDATE orders SET status = $1::text, updated_at = CURRENT_TIMESTAMP WHERE id = $2::uuid RETURNING *',
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
