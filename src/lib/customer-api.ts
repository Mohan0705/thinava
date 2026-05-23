import { MenuItem, Restaurant } from '@/types'
import { apiRequest } from '@/lib/api'

const DEFAULT_RESTAURANT_IMAGE =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80'
const DEFAULT_MENU_ITEM_IMAGE =
  'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80'

const sanitizeImage = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : fallback
}

const sanitizeOptionalImage = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : undefined
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

const mapRestaurant = (restaurant: Record<string, any>): Restaurant => ({
  id: restaurant.id,
  name: restaurant.name,
  image: sanitizeImage(restaurant.image, DEFAULT_RESTAURANT_IMAGE),
  logo: sanitizeImage(restaurant.logo, DEFAULT_RESTAURANT_IMAGE),
  rating: Number(restaurant.rating || 0),
  deliveryTime: restaurant.delivery_time || restaurant.deliveryTime || '25-35 mins',
  priceForOne: Number(restaurant.price_for_one || restaurant.priceForOne || 0),
  cuisines: restaurant.cuisines || [],
  offer: restaurant.offer || undefined,
  featured: Boolean(restaurant.featured),
  isOpen: Boolean(restaurant.is_open ?? restaurant.isOpen ?? true),
  bannerImage: sanitizeOptionalImage(restaurant.banner_image || restaurant.bannerImage),
  description: restaurant.description || undefined,
  status: restaurant.status || undefined,
  formattedAddress: restaurant.formatted_address || restaurant.formattedAddress || undefined,
  latitude:
    restaurant.latitude === null || restaurant.latitude === undefined ? null : Number(restaurant.latitude),
  longitude:
    restaurant.longitude === null || restaurant.longitude === undefined ? null : Number(restaurant.longitude),
})

const mapMenuItem = (menuItem: Record<string, any>): MenuItem => ({
  id: menuItem.id,
  restaurantId: menuItem.restaurant_id || menuItem.restaurantId,
  name: menuItem.name,
  description: menuItem.description || '',
  price: Number(menuItem.price || 0),
  image: sanitizeImage(menuItem.image, DEFAULT_MENU_ITEM_IMAGE),
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
