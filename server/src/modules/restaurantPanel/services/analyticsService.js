const pool = require('../../../database/connection')

const getRestaurantAnalytics = async (restaurantId, days = 7) => {
  const interval = `${days} days`

  const [salesResult, topDishesResult, peakHoursResult, summaryResult, ratingResult, recentReviews] = await Promise.all([
    // 1. Sales Trend (Revenue and Order counts per day)
    pool.query(
      `SELECT 
         TO_CHAR(created_at, 'YYYY-MM-DD') as date, 
         SUM(total)::decimal(10,2) as revenue, 
         COUNT(*)::int as orders_count
       FROM orders
       WHERE restaurant_id = $1 
         AND created_at >= NOW() - CAST($2 AS INTERVAL)
         AND UPPER(status) != 'CANCELLED'
       GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
       ORDER BY date ASC`,
      [restaurantId, interval]
    ),

    // 2. Top-selling dishes
    pool.query(
      `SELECT 
         mi.name, 
         SUM(oi.quantity)::int as quantity, 
         SUM(oi.price * oi.quantity)::decimal(10,2) as revenue
       FROM order_items oi
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.restaurant_id = $1 
         AND o.created_at >= NOW() - CAST($2 AS INTERVAL)
         AND UPPER(o.status) != 'CANCELLED'
       GROUP BY mi.id, mi.name
       ORDER BY quantity DESC
       LIMIT 5`,
      [restaurantId, interval]
    ),

    // 3. Peak hour analysis (orders by hour)
    pool.query(
      `SELECT 
         EXTRACT(HOUR FROM created_at)::int as hour, 
         COUNT(*)::int as orders_count
       FROM orders
       WHERE restaurant_id = $1 
         AND created_at >= NOW() - CAST($2 AS INTERVAL)
         AND UPPER(status) != 'CANCELLED'
       GROUP BY EXTRACT(HOUR FROM created_at)
       ORDER BY hour ASC`,
      [restaurantId, interval]
    ),

    // 4. Overall metrics summary
    pool.query(
      `SELECT 
         COUNT(*)::int as total_orders,
         COALESCE(SUM(total), 0)::decimal(10,2) as total_revenue,
         COUNT(*) FILTER (WHERE UPPER(status) = 'DELIVERED')::int as completed_orders,
         COUNT(*) FILTER (WHERE UPPER(status) = 'CANCELLED')::int as cancelled_orders
       FROM orders
        WHERE restaurant_id = $1 
          AND created_at >= NOW() - CAST($2 AS INTERVAL)`,
      [restaurantId, interval]
    ),

    // 5. Rating overview
    pool.query(
      `SELECT r.average_rating, r.rating_count
       FROM restaurants r
       WHERE r.id = $1`,
      [restaurantId]
    ),

    // 6. Recent reviews for this restaurant
    pool.query(
      `SELECT orv.restaurant_rating, orv.food_quality, orv.review_text,
              orv.is_anonymous, orv.created_at,
              u.name AS customer_name
       FROM order_reviews orv
       JOIN users u ON u.id = orv.customer_id
       JOIN orders o ON o.id = orv.order_id
       WHERE o.restaurant_id = $1
         AND orv.restaurant_rating IS NOT NULL
       ORDER BY orv.created_at DESC
       LIMIT 10`,
      [restaurantId]
    ),
  ])

  const summary = summaryResult.rows[0] || { total_orders: 0, total_revenue: 0, completed_orders: 0, cancelled_orders: 0 }
  const totalOrders = Number(summary.total_orders || 0)
  const totalRevenue = Number(summary.total_revenue || 0)
  const completedOrders = Number(summary.completed_orders || 0)
  const cancelledOrders = Number(summary.cancelled_orders || 0)
  const avgOrderValue = totalOrders > 0 ? parseFloat((totalRevenue / totalOrders).toFixed(2)) : 0

  const ratingRow = ratingResult.rows[0] || {}
  const ratingData = {
    average_rating: Number(ratingRow.average_rating || 0),
    total_reviews: Number(ratingRow.rating_count || 0),
  }

  return {
    summary: {
      totalOrders,
      totalRevenue,
      completedOrders,
      cancelledOrders,
      avgOrderValue,
      ...ratingData,
    },
    salesTrend: salesResult.rows.map(row => ({
      date: row.date,
      revenue: parseFloat(row.revenue || 0),
      orders: Number(row.orders_count || 0),
    })),
    topDishes: topDishesResult.rows.map(row => ({
      name: row.name,
      quantity: Number(row.quantity || 0),
      revenue: parseFloat(row.revenue || 0),
    })),
    peakHours: peakHoursResult.rows.map(row => ({
      hour: row.hour,
      orders: Number(row.orders_count || 0),
    })),
    reviews: recentReviews.rows.map(r => ({
      restaurant_rating: r.restaurant_rating,
      food_quality: r.food_quality,
      review_text: r.review_text,
      customer_name: r.is_anonymous ? 'Anonymous' : r.customer_name,
      created_at: r.created_at,
    })),
  }
}

module.exports = {
  getRestaurantAnalytics,
}
