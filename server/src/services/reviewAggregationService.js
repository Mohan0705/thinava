/**
 * THINAVA Review Aggregation Service
 *
 * Incremental rating aggregation engine.
 * Uses weighted average formula to avoid full table scans on every review.
 *
 * Aggregation formula:
 *   new_avg = ((old_avg * old_count) + new_rating) / (old_count + 1)
 *
 * This service is the SINGLE source of truth for all rating updates.
 * Every review submission MUST go through this service.
 */

const pool = require('../database/connection')
const { ORDER_STATUS } = require('../utils/orderStatus')

const normalizeStatus = (value) => {
  if (!value || typeof value !== 'string') return ''
  return value.toLowerCase().trim()
}

class ReviewAggregationService {
  /**
   * Aggregates all rating dimensions for a single order review.
   * Called after review is committed to order_reviews.
   *
   * @param {object} params
   * @param {string} params.orderId
   * @param {string} params.customerId
   * @param {number|null} params.restaurantRating - 1-5 or null
   * @param {number|null} params.riderRating - 1-5 or null
   * @param {number|null} params.foodQuality - 1-5 or null
   * @param {number|null} params.deliverySpeed - 1-5 or null
   * @param {number|null} params.overallRating - 1-5 or null
   * @param {string|null} params.reviewText
   * @param {boolean} params.isAnonymous
   * @param {object} client - pg client (must be in transaction)
   */
  async aggregateRating({ orderId, customerId, restaurantRating, riderRating, foodQuality, deliverySpeed, overallRating, reviewText, isAnonymous }, client) {
    if (!customerId) {
      throw Object.assign(new Error('Customer identity is required to submit a rating'), { status: 401 })
    }

    // Resolve order details (includes status to avoid a second query)
    const orderRes = await client.query(
      `SELECT id, restaurant_id, delivery_partner_id, user_id, status
       FROM orders WHERE id = $1`,
      [orderId]
    )
    if (orderRes.rows.length === 0) {
      throw Object.assign(new Error('Order not found'), { status: 404 })
    }
    const order = orderRes.rows[0]

    // Prevent duplicate — order_reviews UNIQUE on order_id enforced at DB level,
    // but check application-level anyway
    const dupCheck = await client.query(
      `SELECT id FROM order_reviews WHERE order_id = $1`,
      [orderId]
    )
    if (dupCheck.rows.length > 0) {
      throw Object.assign(new Error('Order already rated'), { status: 400 })
    }

    if (normalizeStatus(order.status) !== ORDER_STATUS.DELIVERED) {
      throw Object.assign(
        new Error('Can only rate delivered orders'),
        { status: 400 }
      )
    }

    // ─── Insert order_review ────────────────────────────────────
    const reviewRes = await client.query(
      `INSERT INTO order_reviews (
        order_id, customer_id, restaurant_rating, rider_rating,
        food_quality, delivery_speed, overall_rating, review_text, is_anonymous
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        orderId, customerId,
        restaurantRating || null,
        riderRating || null,
        foodQuality || null,
        deliverySpeed || null,
        overallRating || null,
        reviewText || null,
        isAnonymous,
      ]
    )
    const reviewId = reviewRes.rows[0].id

    // ─── Restaurant Rating Aggregation ──────────────────────────
    if (restaurantRating && order.restaurant_id) {
      // Update denormalized counts and computed average_rating on restaurants table
      await client.query(
        `UPDATE restaurants
         SET rating_count = rating_count + 1,
             rating_sum = rating_sum + $1,
             average_rating = (COALESCE(rating_sum, 0) + $1)::decimal(3,1)
                              / NULLIF(COALESCE(rating_count, 0) + 1, 0)
         WHERE id = $2`,
        [restaurantRating, order.restaurant_id]
      )

      // Insert into restaurant_ratings
      await client.query(
        `INSERT INTO restaurant_ratings (order_id, restaurant_id, customer_id, rating, food_quality, review_text)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, order.restaurant_id, customerId, restaurantRating, foodQuality || null, reviewText || null]
      )

      // ─── Food Item Ratings ──────────────────────────────────
      // Find all menu items in this order and update each one
      const itemsRes = await client.query(
        `SELECT oi.menu_item_id, oi.quantity, mi.name
         FROM order_items oi
         JOIN menu_items mi ON mi.id = oi.menu_item_id
         WHERE oi.order_id = $1`,
        [orderId]
      )

      for (const item of itemsRes.rows) {
        // Upsert food_item_reviews for each ordered item
        await client.query(
          `INSERT INTO food_item_reviews (order_id, menu_item_id, customer_id, rating, review_text)
           VALUES ($1, $2, $3, $4, $5)`,
          [orderId, item.menu_item_id, customerId, restaurantRating, reviewText || null]
        )

        // Incrementally update menu_item rating
        await client.query(
          `UPDATE menu_items
           SET item_rating_sum = COALESCE(item_rating_sum, 0) + $1,
               item_rating_count = COALESCE(item_rating_count, 0) + 1
           WHERE id = $2`,
          [restaurantRating, item.menu_item_id]
        )
      }
    }

    // ─── Rider Rating Aggregation ───────────────────────────────
    if (riderRating && order.delivery_partner_id) {
      await client.query(
        `UPDATE delivery_partners
         SET rating_count = rating_count + 1,
             rating_sum = rating_sum + $1,
             average_rating = (COALESCE(rating_sum, 0) + $1)::decimal(3,1)
                              / NULLIF(COALESCE(rating_count, 0) + 1, 0)
         WHERE id = $2`,
        [riderRating, order.delivery_partner_id]
      )

      await client.query(
        `INSERT INTO rider_ratings (order_id, rider_id, customer_id, rating, delivery_speed, review_text)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, order.delivery_partner_id, customerId, riderRating, deliverySpeed || null, reviewText || null]
      )
    }

    // ─── Legacy Review Tables (backward compat) ─────────────────
    if (restaurantRating && order.restaurant_id) {
      const existingRest = await client.query(
        `SELECT id FROM restaurant_reviews WHERE order_id = $1 AND user_id = $2`,
        [orderId, customerId]
      )
      if (existingRest.rows.length === 0) {
        await client.query(
          `INSERT INTO restaurant_reviews (restaurant_id, user_id, order_id, rating, comment)
           VALUES ($1, $2, $3, $4, $5)`,
          [order.restaurant_id, customerId, orderId, restaurantRating, reviewText || '']
        )
      }
    }

    if (riderRating && order.delivery_partner_id) {
      const existingRider = await client.query(
        `SELECT id FROM rider_reviews WHERE order_id = $1 AND user_id = $2`,
        [orderId, customerId]
      )
      if (existingRider.rows.length === 0) {
        await client.query(
          `INSERT INTO rider_reviews (rider_id, user_id, order_id, rating, comment)
           VALUES ($1, $2, $3, $4, $5)`,
          [order.delivery_partner_id, customerId, orderId, riderRating, reviewText || '']
        )
      }
    }

    // ─── Legacy restaurant.rating field ─────────────────────────
    if (restaurantRating && order.restaurant_id) {
      const avgRes = await client.query(
        `SELECT AVG(rating)::decimal(3,1) as avg_rating
         FROM restaurant_reviews WHERE restaurant_id = $1`,
        [order.restaurant_id]
      )
      const newAvg = avgRes.rows[0]?.avg_rating || 5.0
      await client.query(
        `UPDATE restaurants SET rating = $1 WHERE id = $2`,
        [newAvg, order.restaurant_id]
      )
    }

    return { reviewId, order }
  }

  /**
   * Returns computed average from denormalized columns.
   */
  static computeAverage(sum, count) {
    if (!count || count === 0) return 0
    return (sum / count)
  }

  /**
   * Returns star distribution for a restaurant from restaurant_ratings.
   */
  async getRestaurantRatingDistribution(restaurantId) {
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE rating = 5) AS five_star,
         COUNT(*) FILTER (WHERE rating = 4) AS four_star,
         COUNT(*) FILTER (WHERE rating = 3) AS three_star,
         COUNT(*) FILTER (WHERE rating = 2) AS two_star,
         COUNT(*) FILTER (WHERE rating = 1) AS one_star,
         COUNT(*) AS total,
         COALESCE(AVG(rating), 0) AS avg_rating
       FROM restaurant_ratings
       WHERE restaurant_id = $1`,
      [restaurantId]
    )
    return result.rows[0]
  }

  /**
   * Returns rider rating stats from rider_ratings.
   */
  async getRiderRatingStats(riderId) {
    const result = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COALESCE(AVG(rating), 0) AS avg_rating,
         COALESCE(AVG(delivery_speed), 0) AS avg_speed
       FROM rider_ratings
       WHERE rider_id = $1`,
      [riderId]
    )
    return result.rows[0]
  }

  /**
   * Returns food item ratings for a restaurant.
   */
  async getFoodItemRatings(restaurantId) {
    const result = await pool.query(
      `SELECT
         mi.id, mi.name, mi.image, mi.category,
         COALESCE(mi.item_rating_sum, 0) AS rating_sum,
         COALESCE(mi.item_rating_count, 0) AS rating_count,
         CASE
           WHEN mi.item_rating_count > 0
           THEN (mi.item_rating_sum / mi.item_rating_count)::decimal(3,1)
           ELSE 0
         END AS avg_rating
       FROM menu_items mi
       WHERE mi.restaurant_id = $1
       ORDER BY avg_rating DESC`,
      [restaurantId]
    )
    return result.rows
  }

  /**
   * Returns best and worst rated food items for a restaurant.
   */
  async getFoodItemRatingSummary(restaurantId) {
    const items = await this.getFoodItemRatings(restaurantId)
    const rated = items.filter(i => i.rating_count > 0)

    return {
      all: items,
      best_rated: rated.slice(0, 5),
      low_rated: rated.slice(-5).reverse(),
      total_items: items.length,
      rated_items: rated.length,
    }
  }

  /**
   * Returns comprehensive restaurant review analytics.
   */
  async getRestaurantReviewAnalytics(restaurantId) {
    const [distribution, recentReviews, foodSummary] = await Promise.all([
      this.getRestaurantRatingDistribution(restaurantId),
      pool.query(
        `SELECT orv.restaurant_rating, orv.rider_rating, orv.food_quality,
                orv.delivery_speed, orv.overall_rating, orv.review_text,
                orv.is_anonymous, orv.created_at,
                u.name AS customer_name
         FROM order_reviews orv
         JOIN users u ON u.id = orv.customer_id
         JOIN orders o ON o.id = orv.order_id
         WHERE o.restaurant_id = $1
           AND orv.restaurant_rating IS NOT NULL
         ORDER BY orv.created_at DESC
         LIMIT 20`,
        [restaurantId]
      ),
      this.getFoodItemRatingSummary(restaurantId),
    ])

    return {
      average: Number(distribution.avg_rating).toFixed(1),
      total: Number(distribution.total),
      distribution: {
        5: Number(distribution.five_star),
        4: Number(distribution.four_star),
        3: Number(distribution.three_star),
        2: Number(distribution.two_star),
        1: Number(distribution.one_star),
      },
      recent_reviews: recentReviews.rows.map(r => ({
        restaurant_rating: r.restaurant_rating,
        rider_rating: r.rider_rating,
        food_quality: r.food_quality,
        delivery_speed: r.delivery_speed,
        overall_rating: r.overall_rating,
        review_text: r.review_text,
        customer_name: r.is_anonymous ? 'Anonymous' : r.customer_name,
        created_at: r.created_at,
      })),
      food_items: foodSummary,
    }
  }

  /**
   * Returns comprehensive rider review analytics.
   */
  async getRiderReviewAnalytics(riderId) {
    const [stats, recentReviews] = await Promise.all([
      this.getRiderRatingStats(riderId),
      pool.query(
        `SELECT orv.rider_rating, orv.delivery_speed, orv.review_text,
                orv.is_anonymous, orv.created_at,
                u.name AS customer_name
         FROM order_reviews orv
         JOIN users u ON u.id = orv.customer_id
         JOIN orders o ON o.id = orv.order_id
         WHERE o.delivery_partner_id = $1
           AND orv.rider_rating IS NOT NULL
         ORDER BY orv.created_at DESC
         LIMIT 20`,
        [riderId]
      ),
    ])

    return {
      average: Number(stats.avg_rating).toFixed(1),
      speed: Number(stats.avg_speed).toFixed(1),
      total: Number(stats.total),
      recent_reviews: recentReviews.rows.map(r => ({
        rider_rating: r.rider_rating,
        delivery_speed: r.delivery_speed,
        review_text: r.review_text,
        customer_name: r.is_anonymous ? 'Anonymous' : r.customer_name,
        created_at: r.created_at,
      })),
    }
  }

  /**
   * Returns admin-level review analytics across all restaurants and riders.
   */
  async getAdminReviewAnalytics() {
    const [topRestaurants, worstRestaurants, topRiders, worstRiders, trend] = await Promise.all([
      pool.query(
        `SELECT id, name,
                COALESCE(rating_sum, 0) AS rating_sum,
                COALESCE(rating_count, 0) AS rating_count,
                CASE WHEN rating_count > 0
                  THEN (rating_sum / rating_count)::decimal(3,1)
                  ELSE 0
                END AS avg_rating
         FROM restaurants
         WHERE rating_count > 0
         ORDER BY avg_rating DESC, rating_count DESC
         LIMIT 10`
      ),
      pool.query(
        `SELECT id, name,
                COALESCE(rating_sum, 0) AS rating_sum,
                COALESCE(rating_count, 0) AS rating_count,
                CASE WHEN rating_count > 0
                  THEN (rating_sum / rating_count)::decimal(3,1)
                  ELSE 0
                END AS avg_rating
         FROM restaurants
         WHERE rating_count > 0
         ORDER BY avg_rating ASC, rating_count DESC
         LIMIT 10`
      ),
      pool.query(
        `SELECT id, full_name,
                COALESCE(rating_sum, 0) AS rating_sum,
                COALESCE(rating_count, 0) AS rating_count,
                CASE WHEN rating_count > 0
                  THEN (rating_sum / rating_count)::decimal(3,1)
                  ELSE 0
                END AS avg_rating
         FROM delivery_partners
         WHERE rating_count > 0
         ORDER BY avg_rating DESC, rating_count DESC
         LIMIT 10`
      ),
      pool.query(
        `SELECT id, full_name,
                COALESCE(rating_sum, 0) AS rating_sum,
                COALESCE(rating_count, 0) AS rating_count,
                CASE WHEN rating_count > 0
                  THEN (rating_sum / rating_count)::decimal(3,1)
                  ELSE 0
                END AS avg_rating
         FROM delivery_partners
         WHERE rating_count > 0
         ORDER BY avg_rating ASC, rating_count DESC
         LIMIT 10`
      ),
      pool.query(
        `SELECT
           DATE_TRUNC('day', created_at) AS day,
           COUNT(*) AS reviews,
           AVG(restaurant_rating) AS avg_restaurant_rating,
           AVG(rider_rating) AS avg_rider_rating
         FROM order_reviews
         WHERE created_at > NOW() - INTERVAL '30 days'
         GROUP BY DATE_TRUNC('day', created_at)
         ORDER BY day ASC`
      ),
    ])

    return {
      best_restaurants: topRestaurants.rows.map(r => ({
        id: r.id, name: r.name, avg_rating: Number(r.avg_rating), total_reviews: Number(r.rating_count)
      })),
      worst_restaurants: worstRestaurants.rows.map(r => ({
        id: r.id, name: r.name, avg_rating: Number(r.avg_rating), total_reviews: Number(r.rating_count)
      })),
      best_riders: topRiders.rows.map(r => ({
        id: r.id, name: r.full_name, avg_rating: Number(r.avg_rating), total_reviews: Number(r.rating_count)
      })),
      worst_riders: worstRiders.rows.map(r => ({
        id: r.id, name: r.full_name, avg_rating: Number(r.avg_rating), total_reviews: Number(r.rating_count)
      })),
      review_trend: trend.rows.map(r => ({
        date: r.day,
        reviews: Number(r.reviews),
        avg_restaurant_rating: Number(r.avg_restaurant_rating || 0).toFixed(1),
        avg_rider_rating: Number(r.avg_rider_rating || 0).toFixed(1),
      })),
    }
  }
}

module.exports = new ReviewAggregationService()
