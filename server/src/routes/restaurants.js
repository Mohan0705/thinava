const express = require('express')
const router = express.Router()
const pool = require('../database/connection')
const { asyncHandler } = require('../utils/asyncHandler')
const { authenticateAdmin } = require('../modules/admin/middleware/auth')

// Get all restaurants
router.get('/', asyncHandler(async (req, res) => {
  const { featured, cuisine } = req.query
  
  let query = 'SELECT * FROM restaurants WHERE is_open = true'
  const params = []
  
  if (featured === 'true') {
    query += ' AND featured = true'
  }
  
  if (cuisine) {
    query += ' AND $1 = ANY(cuisines)'
    params.push(cuisine)
  }
  
  query += ' ORDER BY rating DESC'
  
  const result = await pool.query(query, params)
  res.json({ success: true, restaurants: result.rows })
}))

// Get restaurant by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM restaurants WHERE id = $1',
    [req.params.id]
  )
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Restaurant not found' })
  }
  
  res.json({ success: true, restaurant: result.rows[0] })
}))

// Create restaurant (admin only)
router.post('/', authenticateAdmin, asyncHandler(async (req, res) => {
  const {
    name, image, logo, rating, delivery_time, price_for_one,
    cuisines, offer, featured, formatted_address, latitude, longitude
  } = req.body
  
  const result = await pool.query(
    `INSERT INTO restaurants (name, image, logo, rating, delivery_time, price_for_one, cuisines, offer, featured, formatted_address, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
    [name, image, logo, rating, delivery_time, price_for_one, cuisines, offer, featured, formatted_address || null, latitude ?? null, longitude ?? null]
  )
  
  res.status(201).json({ success: true, restaurant: result.rows[0] })
}))

// Update restaurant (admin only)
router.put('/:id', authenticateAdmin, asyncHandler(async (req, res) => {
  const {
    name, image, logo, rating, delivery_time, price_for_one,
    cuisines, offer, featured, is_open, formatted_address, latitude, longitude
  } = req.body
  
  const result = await pool.query(
    `UPDATE restaurants 
     SET name = $1, image = $2, logo = $3, rating = $4, delivery_time = $5, 
         price_for_one = $6, cuisines = $7, offer = $8, featured = $9, is_open = $10, formatted_address = $11, latitude = $12, longitude = $13, updated_at = CURRENT_TIMESTAMP
     WHERE id = $14 RETURNING *`,
    [name, image, logo, rating, delivery_time, price_for_one, cuisines, offer, featured, is_open, formatted_address || null, latitude ?? null, longitude ?? null, req.params.id]
  )
  
  if (result.rows.length === 0) {
    const error = new Error('Restaurant not found')
    error.status = 404
    throw error
  }
  
  res.json({ success: true, restaurant: result.rows[0] })
}))

// Delete restaurant (admin only)
router.delete('/:id', authenticateAdmin, asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM restaurants WHERE id = $1', [req.params.id])
  res.json({ success: true, message: 'Restaurant deleted successfully' })
}))

module.exports = router
