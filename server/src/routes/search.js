const express = require('express')
const router = express.Router()
const pool = require('../database/connection')
const { asyncHandler } = require('../utils/asyncHandler')
const { logger } = require('../lib/logger')

// Helper function for case-insensitive matching with partial word support
const normalizeForMatching = (str) => {
  if (!str) return ''
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
}

// Safe response wrapper - ensures consistent response format
const safeResponse = (data) => {
  return {
    success: data.success !== false,
    restaurants: data.restaurants || [],
    menuItems: data.menuItems || [],
    categories: data.categories || [],
    total: data.total || 0,
    message: data.message || '',
    ...data
  }
}

// ============================================================
// GET /search/categories
// Get all available menu item categories across all restaurants
// ============================================================
router.get('/categories', asyncHandler(async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT LOWER(TRIM(category)) as category
      FROM menu_items
      WHERE category IS NOT NULL 
        AND TRIM(category) != ''
        AND in_stock = TRUE
      ORDER BY category ASC
    `)

    const categories = ((result.rows || [])
      .map(row => {
        const cat = String(row.category || '').trim()
        return {
          id: cat.replace(/\s+/g, '-').toLowerCase(),
          name: cat,
          displayName: cat.charAt(0).toUpperCase() + cat.slice(1)
        }
      })
      .filter(c => c.name && c.name.length > 0))

    res.json(safeResponse({
      success: true,
      categories: categories
    }))
  } catch (error) {
    logger.error('Error fetching categories:', error)
    
    // Even on error, return safe empty response
    res.json(safeResponse({
      success: true,
      categories: []
    }))
  }
}))

// ============================================================
// GET /search/by-category/:category
// Get restaurants that serve items in a specific category
// Uses JOIN with menu_items table AND checks restaurant cuisines
// ============================================================
router.get('/by-category/:category', asyncHandler(async (req, res) => {
  const { category } = req.params
  if (!category || category.trim() === '') {
    return res.status(400).json(safeResponse({
      success: false,
      error: 'Category is required',
      restaurants: [],
      message: 'Please provide a valid category'
    }))
  }

  const normalizedCategory = normalizeForMatching(category)
  const searchPattern = `%${normalizedCategory}%`

  try {
    // Find restaurants by menu item category OR restaurant cuisine
    // IMPROVED: Better normalization and more robust matching
    const query = `
      SELECT DISTINCT r.*,
             CASE
               WHEN COALESCE(r.rating_count, 0) > 0
               THEN ROUND((COALESCE(r.rating_sum, 0) / NULLIF(r.rating_count, 0))::numeric, 1)
               ELSE COALESCE(r.rating, 0)
             END AS average_rating,
             COALESCE(r.rating_count, 0) AS rating_count
      FROM restaurants r
      WHERE (
        -- Match by menu item category (normalized for word boundaries)
        EXISTS (
          SELECT 1 FROM menu_items mi 
          WHERE mi.restaurant_id = r.id 
            AND LOWER(TRIM(REGEXP_REPLACE(mi.category, '[^a-z0-9\s]', '', 'g'))) ILIKE $1
            AND mi.in_stock = TRUE
        )
        -- OR match by restaurant cuisine (normalized)
        OR EXISTS (
          SELECT 1 FROM unnest(r.cuisines) c 
          WHERE LOWER(TRIM(REGEXP_REPLACE(c, '[^a-z0-9\s]', '', 'g'))) ILIKE $1
        )
      )
      AND r.is_open = TRUE
      ORDER BY
        CASE WHEN COALESCE(r.status, CASE WHEN r.is_open THEN 'OPEN' ELSE 'CLOSED' END) = 'OPEN' THEN 0 ELSE 1 END,
        CASE
          WHEN COALESCE(r.rating_count, 0) > 0
          THEN ROUND((COALESCE(r.rating_sum, 0) / NULLIF(r.rating_count, 0))::numeric, 1)
          ELSE COALESCE(r.rating, 0)
        END DESC,
        r.name ASC
      LIMIT 100
    `

    const result = await pool.query(query, [searchPattern])
    const restaurants = (result.rows || []).filter(r => r && typeof r === 'object')

    // Safe response - never return undefined
    res.json(safeResponse({
      success: true,
      category: String(category || ''),
      count: restaurants.length,
      restaurants: restaurants,
      total: restaurants.length,
      message: restaurants.length === 0 
        ? `No restaurants serving ${String(category)} nearby`
        : `Found ${restaurants.length} restaurants serving ${String(category)}`
    }))
  } catch (error) {
    logger.error(`Error fetching restaurants for category ${category}:`, error)
    
    // Even on error, return safe response
    res.json(safeResponse({
      success: false,
      category: String(category || ''),
      count: 0,
      restaurants: [],
      total: 0,
      message: `No restaurants serving ${String(category)} nearby`,
      error: error.message ? String(error.message) : 'Database error'
    }))
  }
}))


// ============================================================
// GET /search (Main search endpoint)
// Improved search that handles both restaurants and menu items
// ============================================================
router.get('/', asyncHandler(async (req, res) => {
  const { q, veg, rating, maxPrice } = req.query
  const queryStr = q ? `%${q}%` : '%'
  const ratingNum = rating ? Math.max(0, parseFloat(rating)) : 0.0
  const maxPriceNum = maxPrice ? Math.max(0, parseFloat(maxPrice)) : null

  try {
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
      AND COALESCE(r.rating, 0) >= $2
      AND r.is_open = TRUE
      ORDER BY
        CASE
          WHEN COALESCE(r.rating_count, 0) > 0
          THEN ROUND((COALESCE(r.rating_sum, 0) / NULLIF(r.rating_count, 0))::numeric, 1)
          ELSE COALESCE(r.rating, 0)
        END DESC,
        r.name ASC
      LIMIT 20
    `
    const restaurantsResult = await pool.query(restaurantQuery, [queryStr, ratingNum])
    const restaurants = (restaurantsResult.rows || []).filter(r => r && typeof r === 'object')

    // Search menu items and get their restaurants
    // IMPROVED: Better handling of filters and defaults
    let menuItemsQuery = `
      SELECT DISTINCT mi.*, 
             r.name as restaurant_name, 
             r.delivery_time as restaurant_delivery_time, 
             r.id as restaurant_id,
             CASE
               WHEN COALESCE(r.rating_count, 0) > 0
               THEN ROUND((COALESCE(r.rating_sum, 0) / NULLIF(r.rating_count, 0))::numeric, 1)
               ELSE COALESCE(r.rating, 0)
             END AS restaurant_rating,
             COALESCE(r.rating_count, 0) AS restaurant_rating_count
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

    if (maxPriceNum !== null) {
      menuItemsQuery += ` AND mi.price <= $${paramIdx}`
      params.push(maxPriceNum)
      paramIdx++
    }

    menuItemsQuery += ` ORDER BY mi.is_bestseller DESC, mi.name ASC LIMIT 50`
    const menuItemsResult = await pool.query(menuItemsQuery, params)
    const menuItems = (menuItemsResult.rows || []).filter(mi => mi && typeof mi === 'object')

    // Get unique restaurants from menu items search
    const menuItemRestaurantIds = menuItems.map(row => row.restaurant_id).filter(Boolean)
    let restaurantsFromMenuItems = []
    
    if (menuItemRestaurantIds.length > 0) {
      const uniqueIds = [...new Set(menuItemRestaurantIds)]
      const menuRestQuery = `
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
      `
      const menuRestResult = await pool.query(menuRestQuery, [uniqueIds])
      restaurantsFromMenuItems = (menuRestResult.rows || []).filter(r => r && typeof r === 'object')
    }

    // Combine restaurant results, removing duplicates
    const restaurantMap = new Map()
    restaurants.forEach(r => restaurantMap.set(r.id, r))
    restaurantsFromMenuItems.forEach(r => {
      if (!restaurantMap.has(r.id)) {
        restaurantMap.set(r.id, r)
      }
    })
    const combinedRestaurants = Array.from(restaurantMap.values())

    // Safe response - never return undefined
    res.json(safeResponse({
      success: true,
      query: String(q || ''),
      restaurants: combinedRestaurants,
      menuItems: menuItems,
      total: combinedRestaurants.length,
      summary: {
        restaurantCount: combinedRestaurants.length,
        menuItemCount: menuItems.length
      }
    }))
  } catch (error) {
    logger.error('Error during search:', error)
    
    // Even on error, return safe response
    res.json(safeResponse({
      success: false,
      query: String(q || ''),
      restaurants: [],
      menuItems: [],
      total: 0,
      summary: {
        restaurantCount: 0,
        menuItemCount: 0
      },
      error: error.message ? String(error.message) : 'Search error'
    }))
  }
}))


module.exports = router
