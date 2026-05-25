const pool = require('../database/connection')
const { applyRestaurantAvailability } = require('../utils/restaurantAvailability')
const SocketEventsHandler = require('./socketEventsHandler')

const CHECK_INTERVAL_MS = 60 * 1000

let interval = null
let lastAvailabilityByRestaurant = new Map()

const availabilityKey = (restaurant) => [
  restaurant.displayStatus,
  restaurant.isOpenNow ? '1' : '0',
  restaurant.nextOpeningTime || '',
  restaurant.closesAt || '',
].join('|')

const checkAndBroadcastRestaurantAvailability = async () => {
  const result = await pool.query(
    `SELECT id, opening_time, closing_time, timezone, is_manually_closed
     FROM restaurants`
  )

  const handler = new SocketEventsHandler()
  const nextSnapshot = new Map()

  for (const row of result.rows) {
    const restaurant = applyRestaurantAvailability(row)
    const nextKey = availabilityKey(restaurant)
    const previousKey = lastAvailabilityByRestaurant.get(row.id)
    nextSnapshot.set(row.id, nextKey)

    if (previousKey && previousKey !== nextKey) {
      await handler.emitRestaurantStatusUpdated(row.id, {
        status: restaurant.displayStatus,
        isOpenNow: restaurant.isOpenNow,
        displayStatus: restaurant.displayStatus,
        nextOpeningTime: restaurant.nextOpeningTime,
        closesAt: restaurant.closesAt,
        isOvernightSchedule: restaurant.isOvernightSchedule,
        isManuallyClosed: Boolean(row.is_manually_closed),
      })
    }
  }

  lastAvailabilityByRestaurant = nextSnapshot
}

const startRestaurantAvailabilityBroadcaster = () => {
  if (interval) return

  checkAndBroadcastRestaurantAvailability().catch((error) => {
    console.error('[RESTAURANT_AVAILABILITY] Initial check failed:', error.message)
  })

  interval = setInterval(() => {
    checkAndBroadcastRestaurantAvailability().catch((error) => {
      console.error('[RESTAURANT_AVAILABILITY] Scheduled check failed:', error.message)
    })
  }, CHECK_INTERVAL_MS)

  interval.unref()
}

const stopRestaurantAvailabilityBroadcaster = () => {
  if (interval) {
    clearInterval(interval)
    interval = null
  }

  lastAvailabilityByRestaurant.clear()
}

module.exports = {
  checkAndBroadcastRestaurantAvailability,
  startRestaurantAvailabilityBroadcaster,
  stopRestaurantAvailabilityBroadcaster,
}
