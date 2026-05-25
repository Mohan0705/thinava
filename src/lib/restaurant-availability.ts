import type { Restaurant } from '@/types'

export const RESTAURANT_DISPLAY_STATUS = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  MANUALLY_CLOSED: 'MANUALLY_CLOSED',
} as const

export const isRestaurantAcceptingOrders = (restaurant: Pick<Restaurant, 'isOpen' | 'isOpenNow' | 'displayStatus' | 'status'> | null | undefined) => {
  if (!restaurant) return false
  return Boolean(restaurant.isOpenNow ?? restaurant.isOpen) &&
    (restaurant.displayStatus || restaurant.status || RESTAURANT_DISPLAY_STATUS.OPEN) === RESTAURANT_DISPLAY_STATUS.OPEN
}

export const getRestaurantClosedLabel = (restaurant: Pick<Restaurant, 'displayStatus' | 'status'> | null | undefined) => {
  const status = restaurant?.displayStatus || restaurant?.status
  return status === RESTAURANT_DISPLAY_STATUS.MANUALLY_CLOSED
    ? 'Temporarily Closed'
    : 'Currently Closed'
}

export const getRestaurantReopenText = (restaurant: Pick<Restaurant, 'nextOpeningTime'> | null | undefined) => (
  restaurant?.nextOpeningTime ? `Opens at ${restaurant.nextOpeningTime}` : 'Not accepting orders right now'
)

const parseDeliveryMinutes = (value: string | undefined) => {
  const numbers = String(value || '').match(/\d+/g)?.map(Number) || []
  return numbers.length > 0 ? Math.min(...numbers) : Number.POSITIVE_INFINITY
}

export const sortRestaurantsForDisplay = (restaurants: Restaurant[]) => (
  [...restaurants].sort((left, right) => {
    const leftOpen = isRestaurantAcceptingOrders(left)
    const rightOpen = isRestaurantAcceptingOrders(right)

    if (leftOpen !== rightOpen) return leftOpen ? -1 : 1

    const ratingDiff = Number(right.rating || 0) - Number(left.rating || 0)
    if (ratingDiff !== 0) return ratingDiff

    const deliveryDiff = parseDeliveryMinutes(left.deliveryTime) - parseDeliveryMinutes(right.deliveryTime)
    if (deliveryDiff !== 0) return deliveryDiff

    return left.name.localeCompare(right.name)
  })
)
