const express = require('express')
const router = express.Router()
const pool = require('../database/connection')
const { asyncHandler } = require('../utils/asyncHandler')
const { logger } = require('../lib/logger')

// Helper function for case-insensitive matching with partial word support
const normalizeForMatching = (str) => {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
}

// ============================================================
// GET /search/categories
// Get all available menu item categories across all restaurants
// ============================================================
router.get('/categories', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT DISTINCT LOWER(TRIM(category)) as category
    FROM menu_items
    WHERE category IS NOT NULL 
      AND TRIM(category) != ''
      AND in_stock = TRUE
    ORDER BY category ASC
  `)

  const categories = result.rows.map(row => ({
    id: row.category.replace(/\s+/g, '-').toLowerCase(),
    name: row.category,
    displayName: row.category.charAt(0).toUpperCase() + row.category.slice(1)
  }))

  res.json({
    success: true,
    categories: categories
  })
}))

// ============================================================
// GET /search/by-category/:category
// Get restaurants that serve items in a specific category
// Uses JOIN with menu_items table for accurate filtering
// ============================================================
router.get('/by-category/:category', asyncHandler(async (req, res) => {
  const { category } = req.params
  if (!category || category.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      error: 'Category is required' 
    })
  }

  const normalizedCategory = normalizeForMatching(category)

  const query = `
    SELECT DISTINCT r.*,
           CASE
             WHEN COALESCE(r.rating_count, 0) > 0
             THEN ROUND((COALESCE(r.rating_sum, 0) / NULLIF(r.rating_count, 0))::numeric, 1)
             ELSE COALESCE(r.rating, 0)
           END AS average_rating,
           COALESCE(r.rating_count, 0) AS rating_count
    FROM restaurants r
    INNER JOIN menu_items mi ON r.id = mi.restaurant_id
    WHERE LOWER(TRIM(REGEXP_REPLACE(mi.category, '[^a-z0-9\s]', '', 'g'))) ILIKE $1
      AND mi.in_stock = TRUE
      AND r.is_open = TRUE
    ORDER BY
      CASE WHEN COALESCE(r.status, CASE WHEN r.is_open THEN 'OPEN' ELSE 'CLOSED' END) = 'OPEN' THEN 0 ELSE 1 END,
      CASE
        WHEN COALESCE(r.rating_count, 0) > 0
        THEN ROUND((COALESCE(r.rating_sum, 0) / NULLIF(r.rating_count, 0))::numeric, 1)
        ELSE COALESCE(r.rating, 0)
      END DESC,
      r.name ASC
  `

  const searchPattern = `%${normalizedCategory}%`
  const result = await pool.query(query, [searchPattern])

  res.json({
    success: true,
    category: category,
    count: result.rows.length,
    restaurants: result.rows,
    message: result.rows.length === 0 
      ? `No restaurants serving ${category} nearby`
      : `Found ${result.rows.length} restaurants serving ${category}`
  })
}))

// ============================================================
// GET /search (Main search endpoint)
// Improved search that handles both restaurants and menu items
// ============================================================
router.get('/', asyncHandler(async (req, res) => {
  const { q, veg, rating, maxPrice } = req.query
  const queryStr = `%${q || ''}%`
  const ratingNum = rating ? parseFloat(rating) : 0.0

  // Search restaurants by name, description, or cuisines
  const restaurantQuery = `
    SELECT DISTINCT r.*,
           CASE
             WHEN COALESCE(r.rating_count, 0) > 0
             THEN ROUND((COALESCE(r.rating_sum, 0) / NULLIF(r.rating_count, 0))::numeric, 1)
             ELSE COALESCE(r.rating, 0)
           END AS average_rating,
           COALESCE(r.rating_count, 0) AS rating_count
    FROM restaurants r
    WHERE (
      r.name ILIKE $1 
      OR r.description ILIKE $1 
      OR EXISTS (SELECT 1 FROM unnest(r.cuisines) c WHERE c ILIKE $1)
    )
    AND r.rating >= $2
    AND r.is_open = TRUE
    ORDER BY
      CASE
        WHEN COALESCE(r.rating_count, 0) > 0
        THEN ROUND((COALESCE(r.rating_sum, 0) / NULLIF(r.rating_count, 0))::numeric, 1)
        ELSE COALESCE(r.rating, 0)
      END DESC,
      r.name ASC
    LIMIT 15
  `
  const restaurantsResult = await pool.query(restaurantQuery, [queryStr, ratingNum])

  // Search menu items and get their restaurants
  let menuItemsQuery = `
    SELECT DISTINCT mi.*, r.name as restaurant_name, r.delivery_time as restaurant_delivery_time, r.id as restaurant_id
    FROM menu_items mi
    JOIN restaurants r ON mi.restaurant_id = r.id
    WHERE (mi.name ILIKE $1 OR mi.description ILIKE $1 OR mi.category ILIKE $1)
      AND mi.in_stock = TRUE
      AND r.is_open = TRUE
  `
  const params = [queryStr]

  let paramIdx = 2
  if (veg === 'true') {
    menuItemsQuery += ` AND mi.is_veg = TRUE`
  } else if (veg === 'false') {
    menuItemsQuery += ` AND mi.is_veg = FALSE`
  }

  if (maxPrice) {
    menuItemsQuery += ` AND mi.price <= $${paramIdx}`
    params.push(parseFloat(maxPrice))
    paramIdx++
  }

  menuItemsQuery += ` ORDER BY mi.is_bestseller DESC, mi.name ASC LIMIT 30`
  const menuItemsResult = await pool.query(menuItemsQuery, params)

  // Get unique restaurants from menu items search
  const restaurantsFromMenuItems = await pool.query(`
    SELECT DISTINCT r.*,
           CASE
             WHEN COALESCE(r.rating_count, 0) > 0
             THEN ROUND((COALESCE(r.rating_sum, 0) / NULLIF(r.rating_count, 0))::numeric, 1)
             ELSE COALESCE(r.rating, 0)
           END AS average_rating,
           COALESCE(r.rating_count, 0) AS rating_count
    FROM restaurants r
    WHERE r.id = ANY($1::uuid[])
    ORDER BY
      CASE
        WHEN COALESCE(r.rating_count, 0) > 0
        THEN ROUND((COALESCE(r.rating_sum, 0) / NULLIF(r.rating_count, 0))::numeric, 1)
        ELSE COALESCE(r.rating, 0)
      END DESC,
      r.name ASC
  `, [menuItemsResult.rows.map(row => row.restaurant_id)])

  // Combine restaurant results, removing duplicates
  const restaurantMap = new Map()
  restaurantsResult.rows.forEach(r => restaurantMap.set(r.id, r))
  restaurantsFromMenuItems.rows.forEach(r => {
    if (!restaurantMap.has(r.id)) {
      restaurantMap.set(r.id, r)
    }
  })
  const combinedRestaurants = Array.from(restaurantMap.values())

  res.json({
    success: true,
    query: q,
    restaurants: combinedRestaurants,
    menuItems: menuItemsResult.rows,
    summary: {
      restaurantCount: combinedRestaurants.length,
      menuItemCount: menuItemsResult.rows.length
    }
  })
}))

module.exports = router
