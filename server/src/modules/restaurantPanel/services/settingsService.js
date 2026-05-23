const pool = require('../../../database/connection')
const { RESTAURANT_STATUSES } = require('../constants')

const mapRestaurantSettings = (row) => ({
  id: row.id,
  name: row.name,
  image: row.image || '',
  logo: row.logo || '',
  banner_image: row.banner_image || '',
  description: row.description || '',
  cuisines: row.cuisines || [],
  offer: row.offer || '',
  delivery_time: row.delivery_time != null ? String(row.delivery_time) : '',
  price_for_one: Number(row.price_for_one || 0),
  minimum_order: Number(row.minimum_order || 0),
  delivery_radius_km: Number(row.delivery_radius_km || 0),
  formatted_address: row.formatted_address || '',
  place_id: row.place_id || '',
  latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : null,
  longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : null,
  opening_time: row.opening_time || '',
  closing_time: row.closing_time || '',
  status: row.status,
  is_open: row.is_open,
  rating: Number(row.rating || 0),
})

const getRestaurantSettings = async (restaurantId) => {
  const result = await pool.query('SELECT * FROM restaurants WHERE id = $1', [restaurantId])

  if (result.rows.length === 0) {
    const error = new Error('Restaurant not found')
    error.status = 404
    throw error
  }

  return mapRestaurantSettings(result.rows[0])
}

const updateRestaurantSettings = async (restaurantId, payload, ownerUserId = null) => {
  const status = payload.status || RESTAURANT_STATUSES.OPEN
  const isOpen = status === RESTAURANT_STATUSES.OPEN

  // Fetch old status
  const oldResult = await pool.query('SELECT status FROM restaurants WHERE id = $1', [restaurantId])
  const oldStatus = oldResult.rows[0]?.status

  const result = await pool.query(
    `UPDATE restaurants
     SET name = $1,
         image = $2,
         logo = $3,
         banner_image = $4,
         description = $5,
         opening_time = $6,
         closing_time = $7,
         minimum_order = $8,
         delivery_radius_km = $9,
         formatted_address = $10,
         place_id = $11,
         latitude = $12,
         longitude = $13,
         offer = $14,
         cuisines = $15,
         delivery_time = $16,
         price_for_one = $17,
         status = $18,
         is_open = $19,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $20
     RETURNING *`,
    [
      payload.name,
      payload.image,
      payload.logo,
      payload.banner_image || null,
      payload.description || null,
      payload.opening_time || null,
      payload.closing_time || null,
      payload.minimum_order ?? 0,
      payload.delivery_radius_km ?? 5,
      payload.formatted_address || null,
      payload.place_id || null,
      payload.latitude ?? null,
      payload.longitude ?? null,
      payload.offer || null,
      payload.cuisines || [],
      payload.delivery_time || '25-35 mins',
      payload.price_for_one ?? 0,
      status,
      isOpen,
      restaurantId,
    ]
  )

  // Log status change if it has changed
  if (oldStatus !== status && ownerUserId) {
    await pool.query(
      `INSERT INTO restaurant_status_logs (restaurant_id, status, changed_by, reason)
       VALUES ($1, $2, $3, $4)`,
      [restaurantId, status, ownerUserId, payload.status_change_reason || 'Dashboard settings update']
    )
  }

  return mapRestaurantSettings(result.rows[0])
}

module.exports = {
  getRestaurantSettings,
  updateRestaurantSettings,
}
