import { apiRequest } from '@/lib/api'
import {
  RestaurantCategory,
  RestaurantDashboardSummary,
  RestaurantOwner,
  RestaurantPanelMenuItem,
  RestaurantPanelOrder,
  RestaurantPanelSettings,
  RestaurantOrderStatus,
  RestaurantAnalytics,
} from '@/types/restaurant-panel'

export interface RestaurantLoginPayload {
  email: string
  password: string
}

export interface RestaurantSessionResponse {
  success: boolean
  token: string
  owner: RestaurantOwner
}

export interface MenuItemPayload {
  name: string
  description?: string
  price: number
  image: string
  category_id: string
  is_veg: boolean
  is_bestseller: boolean
  in_stock: boolean
}

export interface CategoryPayload {
  name: string
  description?: string
}

export interface SettingsPayload {
  name: string
  image: string
  logo: string
  banner_image?: string
  description?: string
  opening_time?: string
  closing_time?: string
  minimum_order: number
  delivery_radius_km: number
  formatted_address?: string
  place_id?: string
  latitude?: number | null
  longitude?: number | null
  offer?: string
  cuisines: string[]
  delivery_time: string
  price_for_one: number
  status: RestaurantPanelSettings['status']
}

export const restaurantPanelApi = {
  login(payload: RestaurantLoginPayload) {
    return apiRequest<RestaurantSessionResponse>('/restaurant/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  getMe(token: string) {
    return apiRequest<{ success: boolean; owner: RestaurantOwner }>('/restaurant/auth/me', {
      token,
    })
  },

  // Password Reset Endpoints
  requestPasswordReset(email: string) {
    return apiRequest<{ success: boolean; message: string }>(
      '/restaurant/auth/password-reset/request',
      {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      }
    )
  },

  verifyResetToken(token: string) {
    return apiRequest<{ success: boolean; message: string; email: string; fullName: string }>(
      `/restaurant/auth/password-reset/verify?token=${encodeURIComponent(token)}`,
      { method: 'GET' }
    )
  },

  confirmPasswordReset(token: string, newPassword: string, confirmPassword: string) {
    return apiRequest<{ success: boolean; message: string; email: string }>(
      '/restaurant/auth/password-reset/confirm',
      {
        method: 'POST',
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      }
    )
  },

  getSummary(token: string) {
    return apiRequest<{ success: boolean; summary: RestaurantDashboardSummary }>(
      '/restaurant/orders/summary',
      { token }
    )
  },

  getOrders(token: string) {
    return apiRequest<{ success: boolean; orders: RestaurantPanelOrder[] }>('/restaurant/orders', {
      token,
    })
  },

  updateOrderStatus(token: string, orderId: string, status: RestaurantOrderStatus) {
    return apiRequest<{ success: boolean; order: RestaurantPanelOrder }>(
      `/restaurant/orders/${orderId}/status`,
      {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status }),
      }
    )
  },

  getMenu(token: string) {
    return apiRequest<{ success: boolean; menuItems: RestaurantPanelMenuItem[] }>(
      '/restaurant/menu',
      { token }
    )
  },

  createMenuItem(token: string, payload: MenuItemPayload) {
    return apiRequest<{ success: boolean; menuItem: RestaurantPanelMenuItem }>('/restaurant/menu', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    })
  },

  updateMenuItem(token: string, menuItemId: string, payload: MenuItemPayload) {
    return apiRequest<{ success: boolean; menuItem: RestaurantPanelMenuItem }>(
      `/restaurant/menu/${menuItemId}`,
      {
        method: 'PUT',
        token,
        body: JSON.stringify(payload),
      }
    )
  },

  toggleStock(token: string, menuItemId: string, inStock: boolean) {
    return apiRequest<{ success: boolean; menuItem: RestaurantPanelMenuItem }>(
      `/restaurant/menu/${menuItemId}/stock`,
      {
        method: 'PATCH',
        token,
        body: JSON.stringify({ in_stock: inStock }),
      }
    )
  },

  deleteMenuItem(token: string, menuItemId: string) {
    return apiRequest<{ success: boolean; message: string }>(`/restaurant/menu/${menuItemId}`, {
      method: 'DELETE',
      token,
    })
  },

  getCategories(token: string) {
    return apiRequest<{ success: boolean; categories: RestaurantCategory[] }>(
      '/restaurant/categories',
      { token }
    )
  },

  createCategory(token: string, payload: CategoryPayload) {
    return apiRequest<{ success: boolean; category: RestaurantCategory }>(
      '/restaurant/categories',
      {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      }
    )
  },

  updateCategory(token: string, categoryId: string, payload: CategoryPayload) {
    return apiRequest<{ success: boolean; category: RestaurantCategory }>(
      `/restaurant/categories/${categoryId}`,
      {
        method: 'PUT',
        token,
        body: JSON.stringify(payload),
      }
    )
  },

  reorderCategories(token: string, categoryIds: string[]) {
    return apiRequest<{ success: boolean; categories: RestaurantCategory[] }>(
      '/restaurant/categories/reorder',
      {
        method: 'PUT',
        token,
        body: JSON.stringify({ category_ids: categoryIds }),
      }
    )
  },

  deleteCategory(token: string, categoryId: string) {
    return apiRequest<{ success: boolean; message: string }>(`/restaurant/categories/${categoryId}`, {
      method: 'DELETE',
      token,
    })
  },

  getSettings(token: string) {
    return apiRequest<{ success: boolean; settings: RestaurantPanelSettings }>(
      '/restaurant/settings',
      { token }
    )
  },

  updateSettings(token: string, payload: SettingsPayload) {
    return apiRequest<{ success: boolean; settings: RestaurantPanelSettings }>(
      '/restaurant/settings',
      {
        method: 'PUT',
        token,
        body: JSON.stringify(payload),
      }
    )
  },

  getAnalytics(token: string, days = 7) {
    return apiRequest<{ success: boolean; analytics: RestaurantAnalytics }>(
      `/restaurant/analytics?days=${days}`,
      { token }
    )
  },

  // Variants
  createVariant(token: string, itemId: string, payload: { name: string; price: number; offerPrice?: number; isDefault?: boolean; displayOrder?: number }) {
    return apiRequest<{ success: boolean; variant: any }>(`/restaurant/menu/${itemId}/variant`, {
      method: 'POST', token, body: JSON.stringify(payload),
    })
  },
  updateVariant(token: string, itemId: string, variantId: string, payload: any) {
    return apiRequest<{ success: boolean; variant: any }>(`/restaurant/menu/${itemId}/variant/${variantId}`, {
      method: 'PUT', token, body: JSON.stringify(payload),
    })
  },
  deleteVariant(token: string, itemId: string, variantId: string) {
    return apiRequest<{ success: boolean }>(`/restaurant/menu/${itemId}/variant/${variantId}`, {
      method: 'DELETE', token,
    })
  },

  // Addons
  createAddon(token: string, itemId: string, payload: { name: string; price?: number; isRequired?: boolean; maxQuantity?: number; displayOrder?: number }) {
    return apiRequest<{ success: boolean; addon: any }>(`/restaurant/menu/${itemId}/addon`, {
      method: 'POST', token, body: JSON.stringify(payload),
    })
  },
  updateAddon(token: string, itemId: string, addonId: string, payload: any) {
    return apiRequest<{ success: boolean; addon: any }>(`/restaurant/menu/${itemId}/addon/${addonId}`, {
      method: 'PUT', token, body: JSON.stringify(payload),
    })
  },
  deleteAddon(token: string, itemId: string, addonId: string) {
    return apiRequest<{ success: boolean }>(`/restaurant/menu/${itemId}/addon/${addonId}`, {
      method: 'DELETE', token,
    })
  },
}
