import { MenuItem, Restaurant } from '@/types'
import { apiRequest } from '@/lib/api'
import { getOptimizedCloudinaryImageUrl } from '@/lib/cloudinary-image'

const sanitizeImage = (value: unknown) => {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? getOptimizedCloudinaryImageUrl(trimmedValue, { width: 1200, crop: 'limit' }) : ''
}

const sanitizeOptionalImage = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmedValue = value.trim()
  return trimmedValue.length > 0
    ? getOptimizedCloudinaryImageUrl(trimmedValue, { width: 1600, crop: 'limit' })
    : undefined
}

type RestaurantApiResponse = {
  success: boolean
  restaurants?: Array<Record<string, any>>
  restaurant?: Record<string, any>
}

type MenuApiResponse = {
  success: boolean
  menuItems: Array<Record<string, any>>
}

export const mapRestaurant = (restaurant: Record<string, any>): Restaurant => {
  const isOpenNow = Boolean(restaurant.isOpenNow ?? restaurant.is_open ?? restaurant.isOpen ?? true)

  return {
    id: restaurant.id,
    name: restaurant.name,
    image: sanitizeImage(restaurant.image),
    logo: sanitizeImage(restaurant.logo),
    rating: Number(restaurant.average_rating || restaurant.averageRating || restaurant.rating || 0),
    ratingCount: Number(restaurant.rating_count || restaurant.ratingCount || restaurant.total_reviews || 0),
    deliveryTime: String(restaurant.delivery_time || restaurant.deliveryTime || '25-35 mins'),
    priceForOne: Number(restaurant.price_for_one || restaurant.priceForOne || 0),
    cuisines: restaurant.cuisines || [],
    offer: restaurant.offer || undefined,
    featured: Boolean(restaurant.featured),
    isOpen: isOpenNow,
    isOpenNow,
    displayStatus: restaurant.displayStatus || restaurant.display_status || restaurant.status || (isOpenNow ? 'OPEN' : 'CLOSED'),
    nextOpeningTime: restaurant.nextOpeningTime ?? restaurant.next_opening_time ?? null,
    closesAt: restaurant.closesAt ?? restaurant.closes_at ?? null,
    isOvernightSchedule: Boolean(restaurant.isOvernightSchedule ?? restaurant.is_overnight_schedule ?? false),
    timezone: restaurant.timezone || undefined,
    isManuallyClosed: Boolean(restaurant.isManuallyClosed ?? restaurant.is_manually_closed ?? false),
    bannerImage: sanitizeOptionalImage(restaurant.banner_image || restaurant.bannerImage),
    description: restaurant.description || undefined,
    status: restaurant.status || restaurant.displayStatus || undefined,
    formattedAddress: restaurant.formatted_address || restaurant.formattedAddress || undefined,
    latitude:
      restaurant.latitude === null || restaurant.latitude === undefined ? null : Number(restaurant.latitude),
    longitude:
      restaurant.longitude === null || restaurant.longitude === undefined ? null : Number(restaurant.longitude),
  }
}

const mapMenuItem = (menuItem: Record<string, any>): MenuItem => ({
  id: menuItem.id,
  restaurantId: menuItem.restaurant_id || menuItem.restaurantId,
  name: menuItem.name,
  description: menuItem.description || '',
  price: Number(menuItem.price || 0),
  image: sanitizeImage(menuItem.image),
  category: menuItem.category_name || menuItem.category,
  isVeg: Boolean(menuItem.is_veg ?? menuItem.isVeg),
  isBestseller: Boolean(menuItem.is_bestseller ?? menuItem.isBestseller),
  inStock: Boolean(menuItem.in_stock ?? menuItem.inStock ?? true),
  categoryId: menuItem.category_id || menuItem.categoryId || undefined,
})

export async function fetchRestaurants() {
  try {
    const response = await apiRequest<RestaurantApiResponse>('/restaurants')
    
    // Debug logging
    console.log('[FETCH] Restaurants response:', response)
    
    if (!response || typeof response !== 'object') {
      console.error('[FETCH] Invalid restaurants response type:', typeof response)
      throw new Error('Invalid restaurants response')
    }
    
    const restaurants = response.restaurants || []
    console.log('[FETCH] Got', restaurants.length, 'restaurants')
    
    return restaurants.map(mapRestaurant)
  } catch (error) {
    console.error('[FETCH] Failed to fetch restaurants:', error)
    throw error
  }
}

export async function fetchRestaurant(restaurantId: string) {
  const response = await apiRequest<RestaurantApiResponse>(`/restaurants/${restaurantId}`)
  if (!response.restaurant) {
    throw new Error('Restaurant not found')
  }

  return mapRestaurant(response.restaurant)
}

export async function fetchRestaurantMenu(restaurantId: string) {
  const response = await apiRequest<MenuApiResponse>(`/menu/restaurant/${restaurantId}`)
  return response.menuItems.map(mapMenuItem)
}
