/**
 * THINAVA Admin APIs
 * Restaurant/Rider approvals, manual registration, menu management
 * 
 * Endpoints:
 * - GET /api/admin/restaurants/pending
 * - POST /api/admin/restaurants/:id/approve
 * - POST /api/admin/restaurants/:id/reject
 * - GET /api/admin/riders/pending
 * - POST /api/admin/riders/:id/approve
 * - POST /api/admin/riders/:id/reject
 * - POST /api/admin/restaurants/register-manual
 * - POST /api/admin/riders/register-manual
 * - POST /api/admin/menu/category/create
 * - POST /api/admin/menu/item/create
 */

const express = require('express')
const router = express.Router()
const pool = require('../database/connection')
const { authenticateAdmin } = require('../modules/admin/middleware/auth')

// Error handler
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// All admin-extended routes require admin authentication
router.use(authenticateAdmin)

// ============================================================
// RESTAURANT APPROVALS
// ============================================================

// Get pending restaurant applications
router.get('/restaurants/pending', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT ra.*, r.name as restaurant_name, r.status
     FROM restaurant_approvals ra
     JOIN restaurants r ON r.id = ra.restaurant_id
     WHERE UPPER(ra.status) = 'PENDING'
     ORDER BY ra.created_at DESC`
  )

  return res.json({
    success: true,
    pending: result.rows,
    count: result.rows.length
  })
}))

// Get all restaurant approvals (approved + rejected + pending)
router.get('/restaurants/approvals', asyncHandler(async (req, res) => {
  const { status } = req.query

  let query = `SELECT ra.*, r.name as restaurant_name
               FROM restaurant_approvals ra
               JOIN restaurants r ON r.id = ra.restaurant_id`
  const params = []

  if (status) {
    query += ` WHERE UPPER(ra.status) = $1`
    params.push(status.toUpperCase())
  }

  query += ` ORDER BY ra.created_at DESC LIMIT 100`

  const result = await pool.query(query, params)

  return res.json({
    success: true,
    approvals: result.rows
  })
}))

// Approve restaurant
router.post('/restaurants/:id/approve', asyncHandler(async (req, res) => {
  const { id: restaurantId } = req.params
  const { notes, approvedByAdminId } = req.body

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Update approval
    await client.query(
      `UPDATE restaurant_approvals
       SET status = 'APPROVED', approval_notes = $1, approved_by = $2, approved_at = NOW()
       WHERE restaurant_id = $3`,
      [notes || null, approvedByAdminId || null, restaurantId]
    )

    // Update restaurant status
    await client.query(
      `UPDATE restaurants SET status = 'OPEN' WHERE id = $1`,
      [restaurantId]
    )

    // Log approval
    await client.query(
      `INSERT INTO restaurant_approval_history (restaurant_id, action, action_by, notes)
       VALUES ($1, $2, $3, $4)`,
      [restaurantId, 'APPROVED', approvedByAdminId || null, notes || null]
    )

    await client.query('COMMIT')

    // Emit socket event
    const io = req.app.get('io')
    if (io) {
      io.to('admin:global').emit('restaurantApproved', {
        restaurantId,
        timestamp: new Date()
      })

      io.to(`restaurant:${restaurantId}`).emit('restaurantApproved', {
        message: 'Your restaurant has been approved!',
        timestamp: new Date()
      })
    }

    return res.json({
      success: true,
      message: 'Restaurant approved successfully'
    })

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}))

// Reject restaurant
router.post('/restaurants/:id/reject', asyncHandler(async (req, res) => {
  const { id: restaurantId } = req.params
  const { rejectionReason, rejectedByAdminId } = req.body

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Update approval
    await client.query(
      `UPDATE restaurant_approvals
       SET status = 'REJECTED', rejection_reason = $1, rejected_at = NOW()
       WHERE restaurant_id = $2`,
      [rejectionReason || 'No reason provided', restaurantId]
    )

    // Update restaurant status
    await client.query(
      `UPDATE restaurants SET status = 'REJECTED' WHERE id = $1`,
      [restaurantId]
    )

    // Log rejection
    await client.query(
      `INSERT INTO restaurant_approval_history (restaurant_id, action, action_by, notes)
       VALUES ($1, $2, $3, $4)`,
      [restaurantId, 'REJECTED', rejectedByAdminId || null, rejectionReason || null]
    )

    await client.query('COMMIT')

    // Emit socket event
    const io = req.app.get('io')
    if (io) {
      io.to('admin:global').emit('restaurantRejected', {
        restaurantId,
        timestamp: new Date()
      })

      io.to(`restaurant:${restaurantId}`).emit('restaurantRejected', {
        message: 'Your restaurant application was rejected',
        reason: rejectionReason,
        timestamp: new Date()
      })
    }

    return res.json({
      success: true,
      message: 'Restaurant rejected'
    })

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}))

// ============================================================
// RIDER APPROVALS
// ============================================================

// Get pending rider applications
router.get('/riders/pending', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT dp.*, rd.vehicle_type, rd.vehicle_number, rd.zone
     FROM delivery_partners dp
     LEFT JOIN rider_details rd ON rd.delivery_partner_id = dp.id
     WHERE UPPER(dp.approval_status) = 'PENDING'
     ORDER BY dp.created_at DESC`
  )

  return res.json({
    success: true,
    pending: result.rows,
    count: result.rows.length
  })
}))

// Approve rider
router.post('/riders/:id/approve', asyncHandler(async (req, res) => {
  const { id: riderId } = req.params
  const { notes } = req.body

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Update approval status — this is the critical operation
    await client.query(
      `UPDATE delivery_partners
       SET approval_status = 'APPROVED', status = 'ACTIVE'
       WHERE id = $1`,
      [riderId]
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  // Best-effort: log approval (outside transaction so it cannot rollback the UPDATE)
  try {
    await pool.query(
      `INSERT INTO rider_approval_logs (delivery_partner_id, action, reason)
       VALUES ($1, $2, $3)`,
      [riderId, 'APPROVED', notes || 'Approved via admin panel']
    )
  } catch (logError) {
    console.warn('Non-critical: rider approval log insert failed:', logError.message)
  }

  // Emit socket event
  const io = req.app.get('io')
  if (io) {
    io.to('admin:global').emit('riderApproved', {
      riderId,
      timestamp: new Date()
    })

    io.to(`delivery_partner:${riderId}`).emit('riderApproved', {
      message: 'You have been approved! You can now start accepting deliveries.',
      timestamp: new Date()
    })
  }

  return res.json({
    success: true,
    message: 'Rider approved successfully'
  })
}))

// Reject rider
router.post('/riders/:id/reject', asyncHandler(async (req, res) => {
  const { id: riderId } = req.params
  const { rejectionReason } = req.body

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Update status — this is the critical operation
    await client.query(
      `UPDATE delivery_partners
       SET approval_status = 'REJECTED', status = 'REJECTED'
       WHERE id = $1`,
      [riderId]
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  // Best-effort: log rejection (outside transaction so it cannot rollback the UPDATE)
  try {
    await pool.query(
      `INSERT INTO rider_approval_logs (delivery_partner_id, action, reason)
       VALUES ($1, $2, $3)`,
      [riderId, 'REJECTED', rejectionReason || 'Rejected via admin panel']
    )
  } catch (logError) {
    console.warn('Non-critical: rider rejection log insert failed:', logError.message)
  }

  // Emit socket event
  const io = req.app.get('io')
  if (io) {
    io.to('admin:global').emit('riderRejected', {
      riderId,
      timestamp: new Date()
    })

    io.to(`delivery_partner:${riderId}`).emit('riderRejected', {
      message: 'Your application was not approved at this time',
      reason: rejectionReason,
      timestamp: new Date()
    })
  }

  return res.json({
    success: true,
    message: 'Rider rejected'
  })
}))

// ============================================================
// MANUAL REGISTRATION - RESTAURANTS
// ============================================================

router.post('/restaurants/register-manual', asyncHandler(async (req, res) => {
  const {
    restaurantName,
    ownerName,
    ownerPhone,
    ownerEmail,
    address,
    latitude,
    longitude,
    cuisines,
    password,
    city,
    state,
    pincode,
    category,
    vegNonVeg,
    openingTime,
    closingTime,
    deliveryRadius,
    gstNumber,
    fssaiLicense
  } = req.body

  console.log('📝 Manual restaurant registration:', { restaurantName, ownerName, ownerEmail })

  if (!restaurantName || !ownerName || !ownerEmail) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: restaurantName, ownerName, ownerEmail'
    })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Create restaurant with all fields
    const restResult = await client.query(
      `INSERT INTO restaurants 
       (name, image, logo, delivery_time, price_for_one, cuisines, is_open, status, phone, category, veg_non_veg, opening_time, closing_time, delivery_radius_km, latitude, longitude, address, city, state, pincode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING id`,
      [
        restaurantName,
        '', // image placeholder
        '', // logo placeholder
        35, // delivery time in minutes
        200, // default price
        cuisines || ['Multi-Cuisine'],
        true, // is_open
        'OPEN', // status - APPROVED automatically
        ownerPhone || null,
        category || 'multi-cuisine',
        vegNonVeg || 'both',
        openingTime || '10:00',
        closingTime || '22:00',
        parseFloat(deliveryRadius) || 5,
        parseFloat(latitude) || null,
        parseFloat(longitude) || null,
        address || '',
        city || '',
        state || '',
        pincode || ''
      ]
    )

    const restaurantId = restResult.rows[0].id
    console.log('✅ Restaurant created:', restaurantId)

    // Create restaurant details with all address fields
    await client.query(
      `INSERT INTO restaurant_details 
       (restaurant_id, owner_name, owner_phone, owner_email, gst_number, fssai_license, latitude, longitude, address, city, state, pincode, documents_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        restaurantId,
        ownerName,
        ownerPhone || null,
        ownerEmail,
        gstNumber || null,
        fssaiLicense || null,
        parseFloat(latitude) || null,
        parseFloat(longitude) || null,
        address || '',
        city || '',
        state || '',
        pincode || '',
        true // manually created, auto-approved
      ]
    )
    console.log('✅ Restaurant details created')

    // Create approval (already approved for manual creation)
    await client.query(
      `INSERT INTO restaurant_approvals 
       (restaurant_id, owner_name, owner_phone, owner_email, gst_number, fssai_license, restaurant_image, address_full, latitude, longitude, status, approved_at, category, veg_non_veg, opening_time, closing_time, delivery_radius_km, city, state, pincode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        restaurantId,
        ownerName,
        ownerPhone || null,
        ownerEmail,
        gstNumber || null,
        fssaiLicense || null,
        '', // restaurant_image
        address || '',
        parseFloat(latitude) || null,
        parseFloat(longitude) || null,
        'APPROVED', // Auto-approved for manual creation
        category || 'multi-cuisine',
        vegNonVeg || 'both',
        openingTime || '10:00',
        closingTime || '22:00',
        parseFloat(deliveryRadius) || 5,
        city || '',
        state || '',
        pincode || ''
      ]
    )
    console.log('✅ Approval record created (auto-approved)')

    // Create restaurant user with hashed password - explicitly set is_active = true
    const bcrypt = require('bcryptjs')
    const hashedPassword = await bcrypt.hash(password || 'DefaultTemp123!', 10)

    const userResult = await client.query(
      `INSERT INTO restaurant_users (restaurant_id, email, password_hash, full_name, phone, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [restaurantId, ownerEmail, hashedPassword, ownerName, ownerPhone || null, 'restaurant_owner', true]
    )
    console.log('✅ Restaurant user created')

    // Log approval action
    await client.query(
      `INSERT INTO restaurant_approval_history (restaurant_id, action, notes)
       VALUES ($1, $2, $3)`,
      [restaurantId, 'APPROVED', 'Admin manual registration - auto-approved']
    )
    console.log('✅ Approval history logged')

    await client.query('COMMIT')

    console.log('✅ Manual restaurant registration completed successfully')
    return res.status(201).json({
      success: true,
      message: 'Restaurant registered and approved successfully',
      restaurantId,
      status: 'APPROVED',
      user: {
        email: ownerEmail,
        fullName: ownerName,
        role: 'restaurant_owner'
      }
    })

  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Manual restaurant registration failed:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    })
    
    return res.status(400).json({
      success: false,
      error: error.detail || error.message || 'Failed to register restaurant',
      code: error.code
    })
  } finally {
    client.release()
  }
}))

// ============================================================
// MANUAL REGISTRATION - RIDERS
// ============================================================

router.post('/riders/register-manual', asyncHandler(async (req, res) => {
  const {
    fullName,
    phone,
    email,
    vehicleType,
    vehicleNumber,
    zone,
    password
  } = req.body

  if (!fullName || !phone || !vehicleType || !vehicleNumber) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields'
    })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Create rider
    const bcrypt = require('bcryptjs')
    const hashedPassword = await bcrypt.hash(password || 'temp123456', 10)

    const riderResult = await client.query(
      `INSERT INTO delivery_partners (phone, email, full_name, password_hash, status, approval_status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [phone, email || null, fullName, hashedPassword, 'ACTIVE', 'APPROVED']
    )

    const riderId = riderResult.rows[0].id

    // Create rider details
    await client.query(
      `INSERT INTO rider_details (delivery_partner_id, vehicle_type, vehicle_number, zone, documents_verified)
       VALUES ($1, $2, $3, $4, $5)`,
      [riderId, vehicleType, vehicleNumber, zone || 'General', true]
    )

    // Log approval
    await client.query(
      `INSERT INTO rider_approval_logs (delivery_partner_id, action, reason)
       VALUES ($1, $2, $3)`,
      [riderId, 'APPROVED', 'Manual admin registration']
    )

    await client.query('COMMIT')

    return res.status(201).json({
      success: true,
      message: 'Rider registered manually',
      riderId,
      status: 'ACTIVE'
    })

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}))

// ============================================================
// ADMIN MANAGEMENT - RESTAURANTS
// ============================================================

router.get('/restaurants', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT r.*, 
            rd.owner_name, rd.owner_phone, rd.owner_email, rd.gst_number, rd.fssai_license,
            ra.status as approval_status,
            COALESCE((SELECT COUNT(id) FROM orders WHERE restaurant_id = r.id), 0) as total_orders
     FROM restaurants r
     LEFT JOIN restaurant_details rd ON rd.restaurant_id = r.id
     LEFT JOIN restaurant_approvals ra ON ra.restaurant_id = r.id
     ORDER BY r.created_at DESC`
  )
  return res.json({ success: true, restaurants: result.rows })
}))

router.put('/restaurants/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { status, approval_status } = req.body

  if (status) {
    await pool.query(`UPDATE restaurants SET status = $1, is_open = $2 WHERE id = $3`, [status, status === 'OPEN', id])
    req.app.get('io')?.emit('restaurantStatusChanged', { restaurantId: id, status })
  }
  if (approval_status) {
    await pool.query(`UPDATE restaurant_approvals SET status = $1 WHERE restaurant_id = $2`, [approval_status, id])
  }

  return res.json({ success: true, message: 'Status updated' })
}))

router.delete('/restaurants/:id', asyncHandler(async (req, res) => {
  await pool.query(`DELETE FROM restaurants WHERE id = $1`, [req.params.id])
  return res.json({ success: true, message: 'Restaurant deleted' })
}))

// ============================================================
// ADMIN MANAGEMENT - RIDERS
// ============================================================

router.get('/riders', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT dp.*, 
            rd.vehicle_type, rd.vehicle_number, rd.zone, rd.total_earnings, rd.shift_start, rd.shift_end
     FROM delivery_partners dp
     LEFT JOIN rider_details rd ON rd.delivery_partner_id = dp.id
     ORDER BY dp.created_at DESC`
  )
  return res.json({ success: true, riders: result.rows })
}))

router.put('/riders/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { status, approval_status } = req.body

  if (status) {
    await pool.query(`UPDATE delivery_partners SET status = $1 WHERE id = $2`, [status, id])
    req.app.get('io')?.emit('riderStatusChanged', { riderId: id, status })
  }
  if (approval_status) {
    await pool.query(`UPDATE delivery_partners SET approval_status = $1 WHERE id = $2`, [approval_status, id])
  }

  return res.json({ success: true, message: 'Status updated' })
}))

router.delete('/riders/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Delete all related records first to avoid FK constraint violations
    await client.query(`DELETE FROM delivery_incentives WHERE delivery_partner_id = $1`, [id])
    await client.query(`DELETE FROM delivery_shifts WHERE delivery_partner_id = $1`, [id])
    await client.query(`DELETE FROM delivery_payouts WHERE delivery_partner_id = $1`, [id])
    await client.query(`DELETE FROM delivery_wallets WHERE delivery_partner_id = $1`, [id])
    await client.query(`DELETE FROM delivery_tracking WHERE delivery_partner_id = $1`, [id])
    await client.query(`DELETE FROM active_deliveries WHERE delivery_partner_id = $1`, [id])
    await client.query(`DELETE FROM delivery_assignments WHERE delivery_partner_id = $1`, [id])
    await client.query(`DELETE FROM delivery_locations WHERE delivery_partner_id = $1`, [id])
    await client.query(`DELETE FROM delivery_status_logs WHERE delivery_partner_id = $1`, [id])
    await client.query(`DELETE FROM delivery_earnings WHERE delivery_partner_id = $1`, [id])
    await client.query(`DELETE FROM rider_details WHERE delivery_partner_id = $1`, [id])
    await client.query(`DELETE FROM rider_approval_logs WHERE delivery_partner_id = $1`, [id])

    // Now delete the rider
    const result = await client.query(`DELETE FROM delivery_partners WHERE id = $1 RETURNING id`, [id])

    if (result.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ success: false, error: 'Rider not found' })
    }

    await client.query('COMMIT')

    // Emit socket event
    const io = req.app.get('io')
    if (io) {
      io.to('admin:global').emit('riderDeleted', { riderId: id })
    }

    return res.json({ success: true, message: 'Rider deleted successfully' })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Failed to delete rider:', error.message)
    return res.status(500).json({ success: false, error: 'Failed to delete rider. Please try again.' })
  } finally {
    client.release()
  }
}))

// ============================================================
// ADMIN RESTAURANT MENU MANAGEMENT
// Scoped to specific restaurant - like merchant support
// ============================================================

// Get full menu for a restaurant (categories + items + variants + addons)
router.get('/restaurants/:id/menu', asyncHandler(async (req, res) => {
  const { id: restaurantId } = req.params

  // Get categories with item counts
  const categoriesResult = await pool.query(
    `SELECT rc.*, 
            COALESCE((SELECT COUNT(*) FROM menu_items mi WHERE mi.category_id = rc.id), 0) as item_count
     FROM restaurant_categories rc
     WHERE rc.restaurant_id = $1
     ORDER BY rc.display_order ASC`,
    [restaurantId]
  )

  // Get all menu items for this restaurant
  const itemsResult = await pool.query(
    `SELECT mi.*, rc.name as category_name
     FROM menu_items mi
     LEFT JOIN restaurant_categories rc ON rc.id = mi.category_id
     WHERE mi.restaurant_id = $1
     ORDER BY mi.display_order ASC, mi.name ASC`,
    [restaurantId]
  )

  // Get variants for all items
  const itemIds = itemsResult.rows.map(i => i.id)
  let variants = []
  let addons = []

  if (itemIds.length > 0) {
    const variantsResult = await pool.query(
      `SELECT * FROM restaurant_item_variants WHERE menu_item_id = ANY($1::uuid[]) ORDER BY display_order ASC`,
      [itemIds]
    )
    variants = variantsResult.rows

    const addonsResult = await pool.query(
      `SELECT * FROM restaurant_item_addons WHERE menu_item_id = ANY($1::uuid[]) ORDER BY display_order ASC`,
      [itemIds]
    )
    addons = addonsResult.rows
  }

  // Group variants and addons by item
  const itemsWithExtras = itemsResult.rows.map(item => ({
    ...item,
    variants: variants.filter(v => v.menu_item_id === item.id),
    addons: addons.filter(a => a.menu_item_id === item.id),
  }))

  return res.json({
    success: true,
    categories: categoriesResult.rows,
    items: itemsWithExtras,
  })
}))

// Create category for restaurant
router.post('/restaurants/:id/category', asyncHandler(async (req, res) => {
  const { id: restaurantId } = req.params
  const { name, description, displayOrder } = req.body

  if (!name) {
    return res.status(400).json({ success: false, error: 'Category name required' })
  }

  // Check duplicate
  const existing = await pool.query(
    `SELECT id FROM restaurant_categories WHERE restaurant_id = $1 AND LOWER(name) = LOWER($2)`,
    [restaurantId, name]
  )
  if (existing.rows.length > 0) {
    return res.status(409).json({ success: false, error: 'Category already exists' })
  }

  const result = await pool.query(
    `INSERT INTO restaurant_categories (restaurant_id, name, description, display_order)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [restaurantId, name, description || null, displayOrder || 0]
  )

  // Emit realtime event
  const io = req.app.get('io')
  if (io) {
    io.to(`restaurant:${restaurantId}`).emit('menuUpdated', { type: 'category', action: 'created', data: result.rows[0] })
    io.to('admin:global').emit('menuUpdated', { restaurantId, type: 'category', action: 'created' })
  }

  return res.status(201).json({ success: true, category: result.rows[0] })
}))

// Update category
router.put('/restaurants/:id/category/:categoryId', asyncHandler(async (req, res) => {
  const { id: restaurantId, categoryId } = req.params
  const { name, description, displayOrder } = req.body

  const result = await pool.query(
    `UPDATE restaurant_categories SET name = COALESCE($1, name), description = COALESCE($2, description), display_order = COALESCE($3, display_order), updated_at = NOW()
     WHERE id = $4 AND restaurant_id = $5 RETURNING *`,
    [name, description, displayOrder, categoryId, restaurantId]
  )

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Category not found' })
  }

  const io = req.app.get('io')
  if (io) {
    io.to(`restaurant:${restaurantId}`).emit('menuUpdated', { type: 'category', action: 'updated', data: result.rows[0] })
  }

  return res.json({ success: true, category: result.rows[0] })
}))

// Delete category
router.delete('/restaurants/:id/category/:categoryId', asyncHandler(async (req, res) => {
  const { id: restaurantId, categoryId } = req.params

  // Move items to uncategorized or delete them
  await pool.query(
    `UPDATE menu_items SET category_id = NULL WHERE category_id = $1 AND restaurant_id = $2`,
    [categoryId, restaurantId]
  )

  await pool.query(`DELETE FROM restaurant_categories WHERE id = $1 AND restaurant_id = $2`, [categoryId, restaurantId])

  const io = req.app.get('io')
  if (io) {
    io.to(`restaurant:${restaurantId}`).emit('menuUpdated', { type: 'category', action: 'deleted', categoryId })
  }

  return res.json({ success: true, message: 'Category deleted' })
}))

// Reorder categories
router.put('/restaurants/:id/categories/reorder', asyncHandler(async (req, res) => {
  const { id: restaurantId } = req.params
  const { categoryIds } = req.body

  if (!Array.isArray(categoryIds)) {
    return res.status(400).json({ success: false, error: 'categoryIds array required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (let i = 0; i < categoryIds.length; i++) {
      await client.query(
        `UPDATE restaurant_categories SET display_order = $1 WHERE id = $2 AND restaurant_id = $3`,
        [i, categoryIds[i], restaurantId]
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  const io = req.app.get('io')
  if (io) {
    io.to(`restaurant:${restaurantId}`).emit('menuUpdated', { type: 'categories', action: 'reordered' })
  }

  return res.json({ success: true, message: 'Categories reordered' })
}))

// Create menu item for restaurant
router.post('/restaurants/:id/item', asyncHandler(async (req, res) => {
  const { id: restaurantId } = req.params
  const {
    name, description, price, offerPrice, image, categoryId,
    isVeg, isBestseller, isRecommended, isAvailable, inStock,
    preparationTime, spiceLevel, calories, displayOrder
  } = req.body

  if (!name || !price) {
    return res.status(400).json({ success: false, error: 'Name and price required' })
  }

  const result = await pool.query(
    `INSERT INTO menu_items 
     (restaurant_id, name, description, price, offer_price, image, category_id, is_veg, is_bestseller, is_recommended, is_available, in_stock, preparation_time, spice_level, calories, display_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING *`,
    [
      restaurantId, name, description || null, price, offerPrice || null, image || null,
      categoryId || null, isVeg !== false, isBestseller || false, isRecommended || false,
      isAvailable !== false, inStock !== false, preparationTime || 0, spiceLevel || 'medium',
      calories || 0, displayOrder || 0
    ]
  )

  const io = req.app.get('io')
  if (io) {
    io.to(`restaurant:${restaurantId}`).emit('menuUpdated', { type: 'item', action: 'created', data: result.rows[0] })
    io.to('admin:global').emit('menuUpdated', { restaurantId, type: 'item', action: 'created' })
  }

  return res.status(201).json({ success: true, item: result.rows[0] })
}))

// Update menu item
router.put('/restaurants/:id/item/:itemId', asyncHandler(async (req, res) => {
  const { id: restaurantId, itemId } = req.params
  const {
    name, description, price, offerPrice, image, categoryId,
    isVeg, isBestseller, isRecommended, isAvailable, inStock,
    preparationTime, spiceLevel, calories, displayOrder
  } = req.body

  const result = await pool.query(
    `UPDATE menu_items SET
     name = COALESCE($1, name), description = COALESCE($2, description), price = COALESCE($3, price),
     offer_price = COALESCE($4, offer_price), image = COALESCE($5, image), category_id = COALESCE($6, category_id),
     is_veg = COALESCE($7, is_veg), is_bestseller = COALESCE($8, is_bestseller),
     is_recommended = COALESCE($9, is_recommended), is_available = COALESCE($10, is_available),
     in_stock = COALESCE($11, in_stock), preparation_time = COALESCE($12, preparation_time),
     spice_level = COALESCE($13, spice_level), calories = COALESCE($14, calories),
     display_order = COALESCE($15, display_order), updated_at = NOW()
     WHERE id = $16 AND restaurant_id = $17 RETURNING *`,
    [
      name, description, price, offerPrice, image, categoryId,
      isVeg, isBestseller, isRecommended, isAvailable, inStock,
      preparationTime, spiceLevel, calories, displayOrder, itemId, restaurantId
    ]
  )

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Item not found' })
  }

  const io = req.app.get('io')
  if (io) {
    io.to(`restaurant:${restaurantId}`).emit('menuUpdated', { type: 'item', action: 'updated', data: result.rows[0] })
  }

  return res.json({ success: true, item: result.rows[0] })
}))

// Toggle stock
router.patch('/restaurants/:id/item/:itemId/stock', asyncHandler(async (req, res) => {
  const { id: restaurantId, itemId } = req.params
  const { inStock } = req.body

  const result = await pool.query(
    `UPDATE menu_items SET in_stock = $1, updated_at = NOW() WHERE id = $2 AND restaurant_id = $3 RETURNING *`,
    [inStock, itemId, restaurantId]
  )

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Item not found' })
  }

  const io = req.app.get('io')
  if (io) {
    io.to(`restaurant:${restaurantId}`).emit('menuUpdated', { type: 'item', action: 'stock', data: result.rows[0] })
  }

  return res.json({ success: true, item: result.rows[0] })
}))

// Delete menu item
router.delete('/restaurants/:id/item/:itemId', asyncHandler(async (req, res) => {
  const { id: restaurantId, itemId } = req.params

  // Variants and addons will be cascade deleted
  await pool.query(`DELETE FROM menu_items WHERE id = $1 AND restaurant_id = $2`, [itemId, restaurantId])

  const io = req.app.get('io')
  if (io) {
    io.to(`restaurant:${restaurantId}`).emit('menuUpdated', { type: 'item', action: 'deleted', itemId })
  }

  return res.json({ success: true, message: 'Item deleted' })
}))

// Add variant to item
router.post('/restaurants/:id/item/:itemId/variant', asyncHandler(async (req, res) => {
  const { itemId } = req.params
  const { name, price, offerPrice, isDefault, displayOrder } = req.body

  if (!name || !price) {
    return res.status(400).json({ success: false, error: 'Name and price required' })
  }

  const result = await pool.query(
    `INSERT INTO restaurant_item_variants (menu_item_id, name, price, offer_price, is_default, display_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [itemId, name, price, offerPrice || null, isDefault || false, displayOrder || 0]
  )

  const io = req.app.get('io')
  if (io) {
    io.to(`restaurant:${req.params.id}`).emit('menuUpdated', { type: 'variant', action: 'created', data: result.rows[0] })
  }

  return res.status(201).json({ success: true, variant: result.rows[0] })
}))

// Update variant
router.put('/restaurants/:id/item/:itemId/variant/:variantId', asyncHandler(async (req, res) => {
  const { itemId, variantId } = req.params
  const { name, price, offerPrice, isDefault, displayOrder } = req.body

  const result = await pool.query(
    `UPDATE restaurant_item_variants SET
     name = COALESCE($1, name), price = COALESCE($2, price), offer_price = COALESCE($3, offer_price),
     is_default = COALESCE($4, is_default), display_order = COALESCE($5, display_order), updated_at = NOW()
     WHERE id = $6 AND menu_item_id = $7 RETURNING *`,
    [name, price, offerPrice, isDefault, displayOrder, variantId, itemId]
  )

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Variant not found' })
  }

  return res.json({ success: true, variant: result.rows[0] })
}))

// Delete variant
router.delete('/restaurants/:id/item/:itemId/variant/:variantId', asyncHandler(async (req, res) => {
  const { itemId, variantId } = req.params
  await pool.query(`DELETE FROM restaurant_item_variants WHERE id = $1 AND menu_item_id = $2`, [variantId, itemId])
  return res.json({ success: true, message: 'Variant deleted' })
}))

// Add addon to item
router.post('/restaurants/:id/item/:itemId/addon', asyncHandler(async (req, res) => {
  const { itemId } = req.params
  const { name, price, isRequired, maxQuantity, displayOrder } = req.body

  if (!name) {
    return res.status(400).json({ success: false, error: 'Addon name required' })
  }

  const result = await pool.query(
    `INSERT INTO restaurant_item_addons (menu_item_id, name, price, is_required, max_quantity, display_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [itemId, name, price || 0, isRequired || false, maxQuantity || 1, displayOrder || 0]
  )

  const io = req.app.get('io')
  if (io) {
    io.to(`restaurant:${req.params.id}`).emit('menuUpdated', { type: 'addon', action: 'created', data: result.rows[0] })
  }

  return res.status(201).json({ success: true, addon: result.rows[0] })
}))

// Update addon
router.put('/restaurants/:id/item/:itemId/addon/:addonId', asyncHandler(async (req, res) => {
  const { itemId, addonId } = req.params
  const { name, price, isRequired, maxQuantity, displayOrder } = req.body

  const result = await pool.query(
    `UPDATE restaurant_item_addons SET
     name = COALESCE($1, name), price = COALESCE($2, price), is_required = COALESCE($3, is_required),
     max_quantity = COALESCE($4, max_quantity), display_order = COALESCE($5, display_order), updated_at = NOW()
     WHERE id = $6 AND menu_item_id = $7 RETURNING *`,
    [name, price, isRequired, maxQuantity, displayOrder, addonId, itemId]
  )

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Addon not found' })
  }

  return res.json({ success: true, addon: result.rows[0] })
}))

// Delete addon
router.delete('/restaurants/:id/item/:itemId/addon/:addonId', asyncHandler(async (req, res) => {
  const { itemId, addonId } = req.params
  await pool.query(`DELETE FROM restaurant_item_addons WHERE id = $1 AND menu_item_id = $2`, [addonId, itemId])
  return res.json({ success: true, message: 'Addon deleted' })
}))

module.exports = router
