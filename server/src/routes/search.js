const express = require('express')
const router = express.Router()
const pool = require('../database/connection')
const { asyncHandler } = require('../utils/asyncHandler')
const { logger } = require('../utils/logger')

router.get('/', asyncHandler(async (req, res) => {
  const { q, veg, rating, maxPrice } = req.query
  const queryStr = `%${q || ''}%`
  const ratingNum = rating ? parseFloat(rating) : 0.0

  const restaurantQuery = `
    SELECT DISTINCT r.* 
    FROM restaurants r
    LEFT JOIN menu_items mi ON r.id = mi.restaurant_id
    WHERE (
      r.name ILIKE $1 
      OR r.description ILIKE $1 
      OR EXISTS (SELECT 1 FROM unnest(r.cuisines) c WHERE c ILIKE $1)
      OR mi.name ILIKE $1
    )
    AND r.rating >= $2
    AND r.is_open = TRUE
    LIMIT 15
  `
  const restaurantsResult = await pool.query(restaurantQuery, [queryStr, ratingNum])

  let menuItemsQuery = `
    SELECT mi.*, r.name as restaurant_name, r.delivery_time as restaurant_delivery_time
    FROM menu_items mi
    JOIN restaurants r ON mi.restaurant_id = r.id
    WHERE (mi.name ILIKE $1 OR mi.description ILIKE $1)
      AND mi.in_stock = TRUE
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

  menuItemsQuery += ` LIMIT 30`
  const menuItemsResult = await pool.query(menuItemsQuery, params)

  res.json({
    success: true,
    restaurants: restaurantsResult.rows,
    menuItems: menuItemsResult.rows
  })
}))

module.exports = router
