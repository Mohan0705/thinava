const express = require('express')
const router = express.Router()
const pool = require('../database/connection')
const { asyncHandler } = require('../utils/asyncHandler')
const { authenticateAdmin } = require('../modules/admin/middleware/auth')
const { assertCloudinaryImageUrl, deleteReplacedImages } = require('../lib/cloudinaryService')
const {
  applyAvailabilityToRestaurants,
  applyRestaurantAvailability,
  toBoolean,
} = require('../utils/restaurantAvailability')

// Get all restaurants
router.get('/', asyncHandler(async (req, res) => {
  const { featured, cuisine } = req.query
  
  let query = `
    SELECT r.*,
           CASE
             WHEN COALESCE(r.rating_count, 0) > 0
             THEN ROUND((COALESCE(r.rating_sum, 0) / NULLIF(r.rating_count, 0))::numeric, 1)
             ELSE COALESCE(r.rating, 0)
           END AS average_rating,
           COALESCE(r.rating_count, 0) AS rating_count
    FROM restaurants r
    WHERE UPPER(COALESCE(r.status, 'OPEN')) NOT IN ('REJECTED', 'PENDING', 'PENDING_APPROVAL')`
  const params = []
  
  if (featured === 'true') {
    query += ' AND r.featured = true'
  }
  
  if (cuisine) {
    query += ' AND $1 = ANY(r.cuisines)'
    params.push(cuisine)
  }
  
  query += ' ORDER BY r.name ASC'
  
  const result = await pool.query(query, params)
  res.json({ success: true, restaurants: applyAvailabilityToRestaurants(result.rows) })
}))

// Get restaurant by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT r.*,
            CASE
              WHEN COALESCE(r.rating_count, 0) > 0
              THEN ROUND((COALESCE(r.rating_sum, 0) / NULLIF(r.rating_count, 0))::numeric, 1)
              ELSE COALESCE(r.rating, 0)
            END AS average_rating,
            COALESCE(r.rating_count, 0) AS rating_count
     FROM restaurants r
     WHERE r.id = $1`,
    [req.params.id]
  )
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Restaurant not found' })
  }
  
  res.json({ success: true, restaurant: applyRestaurantAvailability(result.rows[0]) })
}))

// Create restaurant (admin only)
router.post('/', authenticateAdmin, asyncHandler(async (req, res) => {
  const {
    name, image, logo, rating, delivery_time, price_for_one,
    cuisines, offer, featured, formatted_address, latitude, longitude,
    opening_time, closing_time, timezone, is_manually_closed
  } = req.body

  assertCloudinaryImageUrl(image, 'Restaurant image')
  assertCloudinaryImageUrl(logo, 'Restaurant logo')
  
  const manuallyClosed = toBoolean(is_manually_closed)
  const result = await pool.query(
    `INSERT INTO restaurants (
       name, image, logo, rating, delivery_time, price_for_one, cuisines, offer, featured,
       formatted_address, latitude, longitude, opening_time, closing_time, timezone,
       is_manually_closed, status, is_open
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, COALESCE($15, 'Asia/Kolkata'), $16, $17, $18)
     RETURNING *`,
    [
      name,
      image,
      logo,
      rating,
      delivery_time,
      price_for_one,
      cuisines,
      offer,
      featured,
      formatted_address || null,
      latitude ?? null,
      longitude ?? null,
      opening_time || null,
      closing_time || null,
      timezone || null,
      manuallyClosed,
      manuallyClosed ? 'CLOSED' : 'OPEN',
      !manuallyClosed,
    ]
  )
  
  res.status(201).json({ success: true, restaurant: applyRestaurantAvailability(result.rows[0]) })
}))

// Update restaurant (admin only)
router.put('/:id', authenticateAdmin, asyncHandler(async (req, res) => {
  const {
    name, image, logo, rating, delivery_time, price_for_one,
    cuisines, offer, featured, is_open, formatted_address, latitude, longitude,
    opening_time, closing_time, timezone, is_manually_closed, status
  } = req.body

  assertCloudinaryImageUrl(image, 'Restaurant image')
  assertCloudinaryImageUrl(logo, 'Restaurant logo')
  const oldResult = await pool.query(
    'SELECT image, logo, banner_image, opening_time, closing_time, timezone, is_manually_closed FROM restaurants WHERE id = $1',
    [req.params.id]
  )
  const oldRow = oldResult.rows[0] || {}
  const nextManuallyClosed = is_manually_closed !== undefined
    ? toBoolean(is_manually_closed)
    : status
      ? ['CLOSED', 'TEMPORARILY_UNAVAILABLE', 'MANUALLY_CLOSED'].includes(String(status).toUpperCase())
      : is_open !== undefined
        ? !toBoolean(is_open)
        : toBoolean(oldRow.is_manually_closed)
  
  const result = await pool.query(
    `UPDATE restaurants 
     SET name = $1, image = $2, logo = $3, rating = $4, delivery_time = $5, 
         price_for_one = $6, cuisines = $7, offer = $8, featured = $9, is_open = $10,
         formatted_address = $11, latitude = $12, longitude = $13,
         opening_time = $14, closing_time = $15, timezone = $16, is_manually_closed = $17,
         status = $18, updated_at = CURRENT_TIMESTAMP
     WHERE id = $19 RETURNING *`,
    [
      name,
      image,
      logo,
      rating,
      delivery_time,
      price_for_one,
      cuisines,
      offer,
      featured,
      !nextManuallyClosed,
      formatted_address || null,
      latitude ?? null,
      longitude ?? null,
      opening_time !== undefined ? opening_time || null : oldRow.opening_time || null,
      closing_time !== undefined ? closing_time || null : oldRow.closing_time || null,
      timezone !== undefined ? timezone || 'Asia/Kolkata' : oldRow.timezone || 'Asia/Kolkata',
      nextManuallyClosed,
      nextManuallyClosed ? 'CLOSED' : 'OPEN',
      req.params.id,
    ]
  )
  
  if (result.rows.length === 0) {
    const error = new Error('Restaurant not found')
    error.status = 404
    throw error
  }
  
  await deleteReplacedImages([
    { previousUrl: oldRow.image, nextUrl: result.rows[0].image },
    { previousUrl: oldRow.logo, nextUrl: result.rows[0].logo },
    { previousUrl: oldRow.banner_image, nextUrl: result.rows[0].banner_image },
  ])

  res.json({ success: true, restaurant: applyRestaurantAvailability(result.rows[0]) })
}))

// Delete restaurant (admin only)
router.delete('/:id', authenticateAdmin, asyncHandler(async (req, res) => {
  const result = await pool.query(
    'DELETE FROM restaurants WHERE id = $1 RETURNING image, logo, banner_image',
    [req.params.id]
  )
  await deleteReplacedImages([
    { previousUrl: result.rows[0]?.image, nextUrl: null },
    { previousUrl: result.rows[0]?.logo, nextUrl: null },
    { previousUrl: result.rows[0]?.banner_image, nextUrl: null },
  ])
  res.json({ success: true, message: 'Restaurant deleted successfully' })
}))

module.exports = router
