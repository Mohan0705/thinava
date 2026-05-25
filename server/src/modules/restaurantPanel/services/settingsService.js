const pool = require('../../../database/connection')
const { RESTAURANT_STATUSES } = require('../constants')
const { assertCloudinaryImageUrl, deleteReplacedImages } = require('../../../lib/cloudinaryService')
const { computeRestaurantAvailability, resolveTimeZone, toBoolean } = require('../../../utils/restaurantAvailability')

const mapRestaurantSettings = (row) => {
  const availability = computeRestaurantAvailability(row)

  return {
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
    timezone: resolveTimeZone(row.timezone),
    is_manually_closed: toBoolean(row.is_manually_closed),
    stored_status: row.status,
    status: availability.displayStatus,
    is_open: availability.isOpenNow,
    isOpenNow: availability.isOpenNow,
    displayStatus: availability.displayStatus,
    nextOpeningTime: availability.nextOpeningTime,
    closesAt: availability.closesAt,
    isOvernightSchedule: availability.isOvernightSchedule,
    rating: Number(row.rating || 0),
  }
}

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
  const isManuallyClosed = payload.is_manually_closed !== undefined
    ? toBoolean(payload.is_manually_closed)
    : [RESTAURANT_STATUSES.CLOSED, RESTAURANT_STATUSES.TEMPORARILY_UNAVAILABLE, RESTAURANT_STATUSES.MANUALLY_CLOSED]
      .includes(String(status).toUpperCase())
  const storedStatus = isManuallyClosed ? RESTAURANT_STATUSES.CLOSED : RESTAURANT_STATUSES.OPEN
  const isOpen = !isManuallyClosed

  assertCloudinaryImageUrl(payload.image, 'Restaurant card image')
  assertCloudinaryImageUrl(payload.logo, 'Restaurant logo')
  assertCloudinaryImageUrl(payload.banner_image, 'Restaurant banner image')

  const oldResult = await pool.query(
    'SELECT status, is_manually_closed, image, logo, banner_image FROM restaurants WHERE id = $1',
    [restaurantId]
  )
  const oldRow = oldResult.rows[0] || {}
  const oldManualState = toBoolean(oldRow.is_manually_closed)

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
         timezone = $20,
         is_manually_closed = $21,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $22
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
      storedStatus,
      isOpen,
      resolveTimeZone(payload.timezone),
      isManuallyClosed,
      restaurantId,
    ]
  )

  // Log manual availability changes. Scheduled open/close is computed, not stored.
  if (oldManualState !== isManuallyClosed && ownerUserId) {
    await pool.query(
      `INSERT INTO restaurant_status_logs (restaurant_id, status, changed_by, reason)
       VALUES ($1, $2, $3, $4)`,
      [
        restaurantId,
        isManuallyClosed ? RESTAURANT_STATUSES.MANUALLY_CLOSED : RESTAURANT_STATUSES.OPEN,
        ownerUserId,
        payload.status_change_reason || 'Dashboard manual availability update',
      ]
    )
  }

  await deleteReplacedImages([
    { previousUrl: oldRow.image, nextUrl: result.rows[0].image },
    { previousUrl: oldRow.logo, nextUrl: result.rows[0].logo },
    { previousUrl: oldRow.banner_image, nextUrl: result.rows[0].banner_image },
  ])

  return mapRestaurantSettings(result.rows[0])
}

module.exports = {
  getRestaurantSettings,
  updateRestaurantSettings,
}
