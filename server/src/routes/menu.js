const express = require('express')
const router = express.Router()
const pool = require('../database/connection')
const { asyncHandler } = require('../utils/asyncHandler')
const { logger } = require('../lib/logger')
const { applyRestaurantAvailability } = require('../utils/restaurantAvailability')

// Get full menu for a restaurant (customer-facing)
router.get('/restaurant/:restaurantId', asyncHandler(async (req, res) => {
  const { restaurantId } = req.params

  const categoriesResult = await pool.query(
    `SELECT * FROM restaurant_categories WHERE restaurant_id = $1 ORDER BY display_order ASC`,
    [restaurantId]
  )

  const restaurantResult = await pool.query(
    `SELECT id, opening_time, closing_time, timezone, is_manually_closed
     FROM restaurants
     WHERE id = $1`,
    [restaurantId]
  )

  const itemsResult = await pool.query(
    `SELECT mi.*, rc.name AS category_name
     FROM menu_items mi
     LEFT JOIN restaurant_categories rc ON rc.id = mi.category_id
     WHERE mi.restaurant_id = $1 AND mi.is_available = TRUE
     ORDER BY COALESCE(rc.display_order, 9999) ASC, mi.display_order ASC, mi.name ASC`,
    [restaurantId]
  )

  const itemIds = itemsResult.rows.map(i => i.id)
  let variants = []
  let addons = []

  if (itemIds.length > 0) {
    const variantsResult = await pool.query(
      `SELECT * FROM restaurant_item_variants WHERE menu_item_id = ANY($1::uuid[]) ORDER BY display_order ASC`,
      [itemIds]
    )
    variants = variantsResult.rows

    const addonsResult = await pool.query(
      `SELECT * FROM restaurant_item_addons WHERE menu_item_id = ANY($1::uuid[]) ORDER BY display_order ASC`,
      [itemIds]
    )
    addons = addonsResult.rows
  }

  const items = itemsResult.rows.map(item => ({
    ...item,
    price: Number(item.price),
    offer_price: item.offer_price ? Number(item.offer_price) : null,
    variants: variants.filter(v => v.menu_item_id === item.id).map(v => ({
      ...v,
      price: Number(v.price),
      offer_price: v.offer_price ? Number(v.offer_price) : null,
    })),
    addons: addons.filter(a => a.menu_item_id === item.id).map(a => ({
      ...a,
      price: Number(a.price),
    })),
  }))

  res.json({
    success: true,
    restaurant: restaurantResult.rows[0] ? applyRestaurantAvailability(restaurantResult.rows[0]) : null,
    categories: categoriesResult.rows,
    menuItems: items,
  })
}))

// Get single menu item by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM menu_items WHERE id = $1', [req.params.id])

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Menu item not found' })
  }

  const item = result.rows[0]
  const variantsResult = await pool.query(
    `SELECT * FROM restaurant_item_variants WHERE menu_item_id = $1 ORDER BY display_order ASC`,
    [item.id]
  )
  const addonsResult = await pool.query(
    `SELECT * FROM restaurant_item_addons WHERE menu_item_id = $1 ORDER BY display_order ASC`,
    [item.id]
  )

  res.json({
    success: true,
    menuItem: {
      ...item,
      price: Number(item.price),
      offer_price: item.offer_price ? Number(item.offer_price) : null,
      variants: variantsResult.rows,
      addons: addonsResult.rows,
    },
  })
}))

module.exports = router
