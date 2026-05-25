/**
 * Safe API response utilities
 * Prevents undefined errors and ensures consistent response handling
 */

export interface SafeApiResponse<T> {
  success: boolean
  data: T
  error?: string
  message?: string
}

/**
 * Parse API response safely with defaults
 * Ensures we never return undefined or null for expected fields
 */
export function parseSafeApiResponse<T>(
  response: any,
  defaults: T
): SafeApiResponse<T> {
  try {
    if (!response || typeof response !== 'object') {
      return {
        success: false,
        data: defaults,
        error: 'Invalid response format'
      }
    }

    return {
      success: response.success !== false,
      data: response.data || response || defaults,
      error: response.error,
      message: response.message
    }
  } catch (error) {
    return {
      success: false,
      data: defaults,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Safely extract array from API response
 */
export function safeArray<T>(value: any): T[] {
  if (!value) return []
  if (!Array.isArray(value)) return []
  return value.filter((item) => item !== null && item !== undefined)
}

/**
 * Safely extract restaurant list from category API response
 */
export function parseCategoryResponse(response: any) {
  return {
    success: response?.success !== false,
    restaurants: safeArray(response?.restaurants),
    total: response?.count ?? 0,
    message: response?.message ?? '',
    error: response?.error
  }
}

/**
 * Safely extract search results
 */
export function parseSearchResponse(response: any) {
  return {
    success: response?.success !== false,
    restaurants: safeArray(response?.restaurants),
    menuItems: safeArray(response?.menuItems),
    total: response?.total ?? 0,
    summary: {
      restaurantCount: response?.summary?.restaurantCount ?? 0,
      menuItemCount: response?.summary?.menuItemCount ?? 0
    },
    error: response?.error
  }
}

/**
 * Validate restaurant object has required fields
 */
export function isValidRestaurant(restaurant: any): boolean {
  return (
    restaurant &&
    typeof restaurant === 'object' &&
    restaurant.id &&
    restaurant.name &&
    restaurant.image
  )
}
