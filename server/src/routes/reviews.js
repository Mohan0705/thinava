const express = require('express')
const router = express.Router()
const pool = require('../database/connection')
const { authenticateCustomer } = require('../modules/auth/middleware/auth')
const reviewAggregationService = require('../services/reviewAggregationService')
const { asyncHandler } = require('../utils/asyncHandler')

// Submit review — delegates to centralized aggregation service
router.post('/', authenticateCustomer, asyncHandler(async (req, res) => {
  const { order_id, restaurant_id: _restaurantId, rider_id: _riderId, restaurant_rating, restaurant_comment, rider_rating, rider_comment } = req.body
  const customerId = req.customer.id

  if (!order_id) {
    return res.status(400).json({ error: 'order_id is required' })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const { reviewId } = await reviewAggregationService.aggregateRating({
      orderId: order_id,
      customerId,
      restaurantRating: restaurant_rating ? parseInt(restaurant_rating) : null,
      riderRating: rider_rating ? parseInt(rider_rating) : null,
      foodQuality: null,
      deliverySpeed: null,
      overallRating: null,
      reviewText: restaurant_comment || rider_comment || null,
      isAnonymous: false,
    }, client)

    await client.query('COMMIT')

    res.json({
      success: true,
      message: 'Review submitted successfully',
      review_id: reviewId,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    if (error.status) {
      return res.status(error.status).json({ error: error.message })
    }
    throw error
  } finally {
    client.release()
  }
}))

router.get('/restaurant/:restaurantId', asyncHandler(async (req, res) => {
  const analytics = await reviewAggregationService.getRestaurantReviewAnalytics(req.params.restaurantId)
  res.json({
    success: true,
    reviews: analytics.recent_reviews,
    rating: {
      average: analytics.average,
      total: analytics.total,
      distribution: analytics.distribution,
    },
  })
}))

router.get('/rider/:riderId', asyncHandler(async (req, res) => {
  const analytics = await reviewAggregationService.getRiderReviewAnalytics(req.params.riderId)
  res.json({
    success: true,
    reviews: analytics.recent_reviews,
    rating: {
      average: analytics.average,
      total: analytics.total,
    },
  })
}))

module.exports = router
