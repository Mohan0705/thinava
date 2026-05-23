const pool = require('../../../database/connection')

const mapCategory = (row) => ({
  id: row.id,
  restaurant_id: row.restaurant_id,
  name: row.name,
  description: row.description,
  display_order: row.display_order,
  item_count: Number(row.item_count || 0),
  created_at: row.created_at,
  updated_at: row.updated_at,
})

const listCategories = async (restaurantId) => {
  const result = await pool.query(
    `SELECT rc.*, COUNT(mi.id) AS item_count
     FROM restaurant_categories rc
     LEFT JOIN menu_items mi ON mi.category_id = rc.id
     WHERE rc.restaurant_id = $1
     GROUP BY rc.id
     ORDER BY rc.display_order ASC, rc.name ASC`,
    [restaurantId]
  )

  return result.rows.map(mapCategory)
}

const createCategory = async (restaurantId, payload) => {
  const orderResult = await pool.query(
    'SELECT COALESCE(MAX(display_order), -1) AS max_order FROM restaurant_categories WHERE restaurant_id = $1',
    [restaurantId]
  )

  const displayOrder = Number(orderResult.rows[0].max_order) + 1

  const result = await pool.query(
    `INSERT INTO restaurant_categories (restaurant_id, name, description, display_order)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [restaurantId, payload.name, payload.description || null, displayOrder]
  )

  return mapCategory({ ...result.rows[0], item_count: 0 })
}

const updateCategory = async (restaurantId, categoryId, payload) => {
  const result = await pool.query(
    `UPDATE restaurant_categories
     SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 AND restaurant_id = $4
     RETURNING *`,
    [payload.name, payload.description || null, categoryId, restaurantId]
  )

  if (result.rows.length === 0) {
    const error = new Error('Category not found')
    error.status = 404
    throw error
  }

  await pool.query(
    `UPDATE menu_items
     SET category = $1, updated_at = CURRENT_TIMESTAMP
     WHERE restaurant_id = $2 AND category_id = $3`,
    [payload.name, restaurantId, categoryId]
  )

  return mapCategory({ ...result.rows[0], item_count: 0 })
}

const reorderCategories = async (restaurantId, categoryIds) => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    for (let index = 0; index < categoryIds.length; index += 1) {
      await client.query(
        `UPDATE restaurant_categories
         SET display_order = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND restaurant_id = $3`,
        [index, categoryIds[index], restaurantId]
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  return listCategories(restaurantId)
}

const deleteCategory = async (restaurantId, categoryId) => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const categoryResult = await client.query(
      'SELECT name FROM restaurant_categories WHERE id = $1 AND restaurant_id = $2',
      [categoryId, restaurantId]
    )

    if (categoryResult.rows.length === 0) {
      const error = new Error('Category not found')
      error.status = 404
      throw error
    }

    await client.query(
      `UPDATE menu_items
       SET category_id = NULL, category = 'Uncategorized', updated_at = CURRENT_TIMESTAMP
       WHERE restaurant_id = $1 AND category_id = $2`,
      [restaurantId, categoryId]
    )

    await client.query(
      'DELETE FROM restaurant_categories WHERE id = $1 AND restaurant_id = $2',
      [categoryId, restaurantId]
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

const getCategoryById = async (restaurantId, categoryId) => {
  const result = await pool.query(
    'SELECT * FROM restaurant_categories WHERE id = $1 AND restaurant_id = $2',
    [categoryId, restaurantId]
  )

  return result.rows[0] || null
}

module.exports = {
  createCategory,
  deleteCategory,
  getCategoryById,
  listCategories,
  reorderCategories,
  updateCategory,
}
