const pool = require('../../../database/connection')
const { getCategoryById } = require('./categoryService')

const mapMenuItem = async (row) => {
  const variantsResult = await pool.query(
    `SELECT * FROM restaurant_item_variants WHERE menu_item_id = $1 ORDER BY display_order ASC`,
    [row.id]
  )
  const addonsResult = await pool.query(
    `SELECT * FROM restaurant_item_addons WHERE menu_item_id = $1 ORDER BY display_order ASC`,
    [row.id]
  )

  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    offer_price: row.offer_price ? Number(row.offer_price) : null,
    image: row.image,
    category: row.category,
    category_id: row.category_id,
    category_name: row.category_name || row.category,
    is_veg: row.is_veg,
    is_bestseller: row.is_bestseller,
    is_recommended: row.is_recommended,
    is_available: row.is_available,
    in_stock: row.in_stock,
    preparation_time: row.preparation_time || 0,
    spice_level: row.spice_level || 'medium',
    calories: row.calories || 0,
    display_order: row.display_order || 0,
    variants: variantsResult.rows,
    addons: addonsResult.rows,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

const resolveCategory = async (restaurantId, categoryId) => {
  if (!categoryId) return null
  const category = await getCategoryById(restaurantId, categoryId)
  if (!category) {
    const error = new Error('Category not found')
    error.status = 404
    throw error
  }
  return category
}

const listMenuItems = async (restaurantId) => {
  const result = await pool.query(
    `SELECT mi.*, rc.name AS category_name
     FROM menu_items mi
     LEFT JOIN restaurant_categories rc ON rc.id = mi.category_id
     WHERE mi.restaurant_id = $1
     ORDER BY COALESCE(rc.display_order, 9999) ASC, mi.display_order ASC, mi.name ASC`,
    [restaurantId]
  )

  const items = []
  for (const row of result.rows) {
    items.push(await mapMenuItem(row))
  }
  return items
}

const createMenuItem = async (restaurantId, payload) => {
  const category = payload.category_id ? await resolveCategory(restaurantId, payload.category_id) : null

  const result = await pool.query(
    `INSERT INTO menu_items (
      restaurant_id, name, description, price, offer_price, image, category,
      is_veg, is_bestseller, is_recommended, is_available, in_stock,
      preparation_time, spice_level, calories, category_id, display_order
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *`,
    [
      restaurantId,
      payload.name,
      payload.description || null,
      payload.price,
      payload.offer_price || null,
      payload.image || null,
      category ? category.name : null,
      payload.is_veg ?? true,
      payload.is_bestseller ?? false,
      payload.is_recommended ?? false,
      payload.is_available ?? true,
      payload.in_stock ?? true,
      payload.preparation_time || 0,
      payload.spice_level || 'medium',
      payload.calories || 0,
      category ? category.id : null,
      payload.display_order || 0,
    ]
  )

  return mapMenuItem({ ...result.rows[0], category_name: category?.name })
}

const updateMenuItem = async (restaurantId, menuItemId, payload) => {
  const category = payload.category_id ? await resolveCategory(restaurantId, payload.category_id) : undefined

  const result = await pool.query(
    `UPDATE menu_items SET
      name = COALESCE($1, name),
      description = COALESCE($2, description),
      price = COALESCE($3, price),
      offer_price = COALESCE($4, offer_price),
      image = COALESCE($5, image),
      category = COALESCE($6, category),
      category_id = COALESCE($7, category_id),
      is_veg = COALESCE($8, is_veg),
      is_bestseller = COALESCE($9, is_bestseller),
      is_recommended = COALESCE($10, is_recommended),
      is_available = COALESCE($11, is_available),
      in_stock = COALESCE($12, in_stock),
      preparation_time = COALESCE($13, preparation_time),
      spice_level = COALESCE($14, spice_level),
      calories = COALESCE($15, calories),
      display_order = COALESCE($16, display_order),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $17 AND restaurant_id = $18
    RETURNING *`,
    [
      payload.name,
      payload.description,
      payload.price,
      payload.offer_price,
      payload.image,
      category?.name,
      category?.id,
      payload.is_veg,
      payload.is_bestseller,
      payload.is_recommended,
      payload.is_available,
      payload.in_stock,
      payload.preparation_time,
      payload.spice_level,
      payload.calories,
      payload.display_order,
      menuItemId,
      restaurantId,
    ]
  )

  if (result.rows.length === 0) {
    const error = new Error('Menu item not found')
    error.status = 404
    throw error
  }

  const categoryName = category ? category.name : result.rows[0].category_name
  return mapMenuItem({ ...result.rows[0], category_name: categoryName })
}

const updateMenuItemStock = async (restaurantId, menuItemId, inStock) => {
  const result = await pool.query(
    `UPDATE menu_items SET in_stock = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND restaurant_id = $3 RETURNING *`,
    [inStock, menuItemId, restaurantId]
  )

  if (result.rows.length === 0) {
    const error = new Error('Menu item not found')
    error.status = 404
    throw error
  }

  return mapMenuItem(result.rows[0])
}

const deleteMenuItem = async (restaurantId, menuItemId) => {
  const result = await pool.query(
    'DELETE FROM menu_items WHERE id = $1 AND restaurant_id = $2 RETURNING id',
    [menuItemId, restaurantId]
  )

  if (result.rows.length === 0) {
    const error = new Error('Menu item not found')
    error.status = 404
    throw error
  }
}

// Variant management
const createVariant = async (restaurantId, menuItemId, payload) => {
  // Verify item belongs to restaurant
  const itemCheck = await pool.query(
    'SELECT id FROM menu_items WHERE id = $1 AND restaurant_id = $2',
    [menuItemId, restaurantId]
  )
  if (itemCheck.rows.length === 0) {
    const error = new Error('Menu item not found')
    error.status = 404
    throw error
  }

  const result = await pool.query(
    `INSERT INTO restaurant_item_variants (menu_item_id, name, price, offer_price, is_default, display_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [menuItemId, payload.name, payload.price, payload.offer_price || null, payload.is_default || false, payload.display_order || 0]
  )
  return result.rows[0]
}

const updateVariant = async (restaurantId, menuItemId, variantId, payload) => {
  const result = await pool.query(
    `UPDATE restaurant_item_variants SET
      name = COALESCE($1, name), price = COALESCE($2, price), offer_price = COALESCE($3, offer_price),
      is_default = COALESCE($4, is_default), display_order = COALESCE($5, display_order), updated_at = NOW()
     WHERE id = $6 AND menu_item_id = $7 RETURNING *`,
    [payload.name, payload.price, payload.offer_price, payload.is_default, payload.display_order, variantId, menuItemId]
  )
  if (result.rows.length === 0) {
    const error = new Error('Variant not found')
    error.status = 404
    throw error
  }
  return result.rows[0]
}

const deleteVariant = async (restaurantId, menuItemId, variantId) => {
  const result = await pool.query(
    'DELETE FROM restaurant_item_variants WHERE id = $1 AND menu_item_id = $2 RETURNING id',
    [variantId, menuItemId]
  )
  if (result.rows.length === 0) {
    const error = new Error('Variant not found')
    error.status = 404
    throw error
  }
}

// Addon management
const createAddon = async (restaurantId, menuItemId, payload) => {
  const itemCheck = await pool.query(
    'SELECT id FROM menu_items WHERE id = $1 AND restaurant_id = $2',
    [menuItemId, restaurantId]
  )
  if (itemCheck.rows.length === 0) {
    const error = new Error('Menu item not found')
    error.status = 404
    throw error
  }

  const result = await pool.query(
    `INSERT INTO restaurant_item_addons (menu_item_id, name, price, is_required, max_quantity, display_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [menuItemId, payload.name, payload.price || 0, payload.is_required || false, payload.max_quantity || 1, payload.display_order || 0]
  )
  return result.rows[0]
}

const updateAddon = async (restaurantId, menuItemId, addonId, payload) => {
  const result = await pool.query(
    `UPDATE restaurant_item_addons SET
      name = COALESCE($1, name), price = COALESCE($2, price), is_required = COALESCE($3, is_required),
      max_quantity = COALESCE($4, max_quantity), display_order = COALESCE($5, display_order), updated_at = NOW()
     WHERE id = $6 AND menu_item_id = $7 RETURNING *`,
    [payload.name, payload.price, payload.is_required, payload.max_quantity, payload.display_order, addonId, menuItemId]
  )
  if (result.rows.length === 0) {
    const error = new Error('Addon not found')
    error.status = 404
    throw error
  }
  return result.rows[0]
}

const deleteAddon = async (restaurantId, menuItemId, addonId) => {
  const result = await pool.query(
    'DELETE FROM restaurant_item_addons WHERE id = $1 AND menu_item_id = $2 RETURNING id',
    [addonId, menuItemId]
  )
  if (result.rows.length === 0) {
    const error = new Error('Addon not found')
    error.status = 404
    throw error
  }
}

module.exports = {
  createMenuItem,
  deleteMenuItem,
  listMenuItems,
  updateMenuItem,
  updateMenuItemStock,
  createVariant,
  updateVariant,
  deleteVariant,
  createAddon,
  updateAddon,
  deleteAddon,
}
