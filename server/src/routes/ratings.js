/**
 * THINAVA Rating & Review System — Enhanced
 *
 * Rules:
 * - Customers can ONLY rate after order is DELIVERED
 * - One rating per order (enforced by DB UNIQUE + application check)
 * - Separate ratings for restaurant, rider, and overall review
 * - Food item ratings auto-associated from ordered items
 * - Realtime sync on rating submission
 * - Incremental aggregation (no full table scans)
 */

const express = require('express')
const router = express.Router()
const pool = require('../database/connection')
const { authenticateCustomer } = require('../modules/auth/middleware/auth')
const reviewAggregationService = require('../services/reviewAggregationService')

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// Get rating eligibility for customer's delivered orders
router.get('/eligibility', authenticateCustomer, asyncHandler(async (req, res) => {
  const customerId = req.customer.id

  const result = await pool.query(
    `SELECT o.id, o.status, o.review_status, o.restaurant_id, r.name AS restaurant_name,
            dp.full_name AS rider_name
     FROM orders o
     LEFT JOIN restaurants r ON r.id = o.restaurant_id
     LEFT JOIN delivery_partners dp ON dp.id = o.delivery_partner_id
     WHERE o.user_id = $1 AND o.status = 'delivered'
     ORDER BY o.created_at DESC
     LIMIT 20`,
    [customerId]
  )

  const eligibleOrders = result.rows.filter(row => row.review_status !== 'reviewed')

  res.json({
    success: true,
    orders: result.rows.map(row => ({
      id: row.id,
      restaurant_name: row.restaurant_name,
      rider_name: row.rider_name,
      already_rated: row.review_status === 'reviewed',
      can_rate: row.review_status !== 'reviewed',
    })),
    unrated_count: eligibleOrders.length,
  })
}))

// Submit rating for an order — SINGLE ENTRY POINT for all rating types
router.post('/submit', authenticateCustomer, asyncHandler(async (req, res) => {
  const customerId = req.customer.id
  const {
    orderId,
    restaurant_rating,
    rider_rating,
    food_quality,
    delivery_speed,
    overall_rating,
    review_text,
    is_anonymous = false,
  } = req.body

  // Validate
  if (!orderId) {
    return res.status(400).json({ success: false, error: 'Order ID required' })
  }

  if (!restaurant_rating && !rider_rating && !overall_rating) {
    return res.status(400).json({ success: false, error: 'At least one rating is required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Aggregate all ratings through the service
    const { reviewId, order } = await reviewAggregationService.aggregateRating({
      orderId,
      customerId,
      restaurantRating: restaurant_rating || null,
      riderRating: rider_rating || null,
      foodQuality: food_quality || null,
      deliverySpeed: delivery_speed || null,
      overallRating: overall_rating || null,
      reviewText: review_text || null,
      isAnonymous: is_anonymous,
    }, client)

    await client.query('COMMIT')

    // ─── Emit realtime events ─────────────────────────────────
    const io = req.app.get('io')
    if (io) {
      // Notify restaurant room
      io.to(`restaurant:${order.restaurant_id}`).emit('orderRated', {
        orderId,
        restaurant_rating,
        food_quality,
      })

      // Notify delivery partner room
      if (order.delivery_partner_id) {
        io.to(`delivery_partner:${order.delivery_partner_id}`).emit('orderRated', {
          orderId,
          rider_rating,
          delivery_speed,
        })
      }

      // Notify customer room
      io.to(`customer:${customerId}`).emit('orderRated', {
        orderId,
        restaurant_rating,
        rider_rating,
      })

      // Notify admin global room
      io.to('admin:global').emit('orderRated', {
        orderId,
        restaurantId: order.restaurant_id,
        riderId: order.delivery_partner_id,
        restaurant_rating,
        rider_rating,
        timestamp: new Date().toISOString(),
      })
    }

    res.status(201).json({
      success: true,
      message: 'Rating submitted successfully',
      review_id: reviewId,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.message })
    }
    throw error
  } finally {
    client.release()
  }
}))

// Get restaurant ratings (public)
router.get('/restaurant/:restaurantId', asyncHandler(async (req, res) => {
  const { restaurantId } = req.params

  const analytics = await reviewAggregationService.getRestaurantReviewAnalytics(restaurantId)

  res.json({
    success: true,
    rating: {
      average: analytics.average,
      total: analytics.total,
      distribution: analytics.distribution,
    },
    reviews: analytics.recent_reviews,
  })
}))

// Get rider ratings (public)
router.get('/rider/:riderId', asyncHandler(async (req, res) => {
  const { riderId } = req.params

  const analytics = await reviewAggregationService.getRiderReviewAnalytics(riderId)

  res.json({
    success: true,
    rating: {
      average: analytics.average,
      speed: analytics.speed,
      total: analytics.total,
    },
    reviews: analytics.recent_reviews,
  })
}))

// ─── Restaurant Review Analytics (for restaurant dashboard) ──────
router.get('/analytics/restaurant/:restaurantId', asyncHandler(async (req, res) => {
  const { restaurantId } = req.params

  const analytics = await reviewAggregationService.getRestaurantReviewAnalytics(restaurantId)

  res.json({
    success: true,
    analytics,
  })
}))

// ─── Rider Review Analytics (for rider dashboard) ────────────────
router.get('/analytics/rider/:riderId', asyncHandler(async (req, res) => {
  const { riderId } = req.params

  const analytics = await reviewAggregationService.getRiderReviewAnalytics(riderId)

  res.json({
    success: true,
    analytics,
  })
}))

// ─── Admin Review Analytics ──────────────────────────────────────
router.get('/analytics/admin', asyncHandler(async (req, res) => {
  const analytics = await reviewAggregationService.getAdminReviewAnalytics()

  res.json({
    success: true,
    analytics,
  })
}))

// ─── Food Item Ratings for a restaurant ─────────────────────────
router.get('/food-items/:restaurantId', asyncHandler(async (req, res) => {
  const { restaurantId } = req.params

  const items = await reviewAggregationService.getFoodItemRatings(restaurantId)

  res.json({
    success: true,
    items: items.map(item => ({
      id: item.id,
      name: item.name,
      image: item.image,
      category: item.category,
      avg_rating: Number(item.avg_rating),
      total_reviews: Number(item.rating_count),
    })),
  })
}))

module.exports = router
