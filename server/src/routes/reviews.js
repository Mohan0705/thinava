const express = require('express')
const router = express.Router()
const pool = require('../database/connection')
const { authenticateCustomer } = require('../modules/auth/middleware/auth')
const { normalize, isDelivered } = require('../utils/orderStatus')
const { asyncHandler } = require('../utils/asyncHandler')
const { logger } = require('../utils/logger')

router.post('/', authenticateCustomer, asyncHandler(async (req, res) => {
  const { order_id, restaurant_id, rider_id, restaurant_rating, restaurant_comment, rider_rating, rider_comment } = req.body
  const user_id = req.customer.id

  if (!order_id) {
    return res.status(400).json({ error: 'order_id is required' })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Verify order exists, belongs to user, and is delivered
    const orderCheck = await client.query(
      'SELECT id, status, delivery_partner_id FROM orders WHERE id = $1 AND user_id = $2',
      [order_id, user_id]
    )
    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found or access denied' })
    }

    const order = orderCheck.rows[0]

    if (!isDelivered(order.status)) {
      return res.status(400).json({
        error: 'Only delivered orders can be reviewed.',
      })
    }

    // Validate rider_id if provided
    if (rider_id) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(rider_id)) {
        return res.status(400).json({ error: 'Invalid rider ID format' })
      }
      if (order.delivery_partner_id !== rider_id) {
        return res.status(400).json({ error: 'Rider ID does not match the order' })
      }
    }

    let restaurantReview = null
    let riderReview = null

    // Insert Restaurant Review if provided
    if (restaurant_id && restaurant_rating) {
      const rating = parseInt(restaurant_rating)
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Restaurant rating must be between 1 and 5' })
      }

      // Check if review already exists
      const existing = await client.query(
        'SELECT id FROM restaurant_reviews WHERE order_id = $1 AND user_id = $2',
        [order_id, user_id]
      )

      if (existing.rows.length > 0) {
        // Update existing
        const updated = await client.query(
          `UPDATE restaurant_reviews 
           SET rating = $1, comment = $2, created_at = CURRENT_TIMESTAMP 
           WHERE order_id = $3 AND user_id = $4
           RETURNING *`,
          [rating, restaurant_comment || '', order_id, user_id]
        )
        restaurantReview = updated.rows[0]
      } else {
        // Insert new
        const inserted = await client.query(
          `INSERT INTO restaurant_reviews (restaurant_id, user_id, order_id, rating, comment)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [restaurant_id, user_id, order_id, rating, restaurant_comment || '']
        )
        restaurantReview = inserted.rows[0]
      }

      // Recalculate average rating for restaurant
      const avgResult = await client.query(
        'SELECT AVG(rating)::decimal(3,1) as avg_rating FROM restaurant_reviews WHERE restaurant_id = $1',
        [restaurant_id]
      )
      const newAvg = avgResult.rows[0].avg_rating || 5.0
      await client.query('UPDATE restaurants SET rating = $1 WHERE id = $2', [newAvg, restaurant_id])
    }

    // Insert Rider Review if provided
    if (rider_id && rider_rating) {
      const rating = parseInt(rider_rating)
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rider rating must be between 1 and 5' })
      }

      // Check if review already exists
      const existing = await client.query(
        'SELECT id FROM rider_reviews WHERE order_id = $1 AND user_id = $2',
        [order_id, user_id]
      )

      if (existing.rows.length > 0) {
        // Update existing
        const updated = await client.query(
          `UPDATE rider_reviews 
           SET rating = $1, comment = $2, created_at = CURRENT_TIMESTAMP 
           WHERE order_id = $3 AND user_id = $4
           RETURNING *`,
          [rating, rider_comment || '', order_id, user_id]
        )
        riderReview = updated.rows[0]
      } else {
        // Insert new
        const inserted = await client.query(
          `INSERT INTO rider_reviews (rider_id, user_id, order_id, rating, comment)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [rider_id, user_id, order_id, rating, rider_comment || '']
        )
        riderReview = inserted.rows[0]
      }

      // Rider rating is denormalized to delivery_partners table via the new aggregation service
    }

    await client.query('COMMIT')
    res.json({
      success: true,
      message: 'Review submitted successfully',
      restaurantReview,
      riderReview
    })
  } finally {
    client.release()
  }
}))

router.get('/restaurant/:restaurantId', asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT rr.*, u.name as reviewer_name, u.profile_image as reviewer_image
       FROM restaurant_reviews rr
       JOIN users u ON rr.user_id = u.id
       WHERE rr.restaurant_id = $1
       ORDER BY rr.created_at DESC`,
      [req.params.restaurantId]
    )
    res.json({ success: true, reviews: result.rows })
}))

router.get('/rider/:riderId', asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT rdr.*, u.name as reviewer_name 
       FROM rider_reviews rdr
       JOIN users u ON rdr.user_id = u.id
       WHERE rdr.rider_id = $1
       ORDER BY rdr.created_at DESC`,
      [req.params.riderId]
    )
    res.json({ success: true, reviews: result.rows })
}))

module.exports = router
