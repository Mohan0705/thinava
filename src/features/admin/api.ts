import { ApiError, apiRequest } from '@/lib/api'
import { uploadImageToCloudinary, type CloudinaryUploadResponse } from '@/lib/image-upload'
import type {
  AdminOrder,
  AdminSession,
  AdminUser,
  CouponCode,
  CustomerAdminRecord,
  DeliveryPartnerAdminRecord,
  LiveMapPayload,
  MarketingBanner,
  PlatformSetting,
  PayoutTransaction,
  RestaurantAdminRecord,
  SupportTicket,
} from '@/features/admin/types'

export interface DashboardResponse {
  metrics: {
    orders_today: number
    active_deliveries: number
    online_riders: number
    active_restaurants: number
    revenue_today: number
    failed_orders: number
    average_delivery_time: number
    platform_commission: number
  }
  activity_feed: Array<{
    id: string
    type: string
    description: string
    time: string
    severity: 'info' | 'warning' | 'critical'
  }>
  order_status_breakdown: Array<{ status: string; label: string; value: number }>
  revenue_trend: Array<{ day: string; orders: number; revenue: number }>
  zone_performance: Array<{ zone: string; orders: number; delayed: number; revenue: number }>
  live_map: LiveMapPayload
}

export interface OrdersResponse {
  orders: AdminOrder[]
  summary: {
    active: number
    delayed: number
    cancelled: number
    cod: number
  }
  filters: {
    restaurants: Array<{ id: string; name: string }>
    riders: Array<{ id: string; name: string }>
    areas: string[]
    payment_methods: string[]
    statuses: string[]
  }
}

export interface RestaurantsResponse {
  restaurants: RestaurantAdminRecord[]
  summary: {
    total: number
    active: number
    featured: number
    under_review: number
  }
}

export interface DeliveryPartnersResponse {
  partners: DeliveryPartnerAdminRecord[]
  summary: {
    total: number
    online: number
    suspended: number
    pending_approval: number
  }
}

export interface CustomersResponse {
  customers: CustomerAdminRecord[]
  summary: {
    total: number
    blocked: number
    flagged: number
    active: number
  }
}

export interface AnalyticsResponse {
  order_trends: Array<{ date: string; orders: number; revenue: number; commission: number }>
  busiest_zones: Array<{ zone: string; orders: number; revenue: number; delays: number }>
  top_restaurants: Array<{ name: string; revenue: number; orders: number; rating: number }>
  rider_efficiency: Array<{ name: string; deliveries: number; rating: number; earnings: number }>
  customer_growth: Array<{ month: string; users: number }>
  platform_health: {
    avg_delivery_time: number
    fraud_alerts: number
    cancellation_rate: number
    active_restaurants: number
  }
}

export interface PaymentsResponse {
  overview: {
    platform_revenue: number
    restaurant_payouts: number
    rider_payouts: number
    pending_settlements: number
    cod_reconciliation: number
    commission_breakdown: number
  }
  payouts: PayoutTransaction[]
  settlement_status: Array<{ status: string; count: number; amount: number }>
}

export interface SupportResponse {
  tickets: SupportTicket[]
  summary: {
    open: number
    investigating: number
    resolved: number
    refunds: number
  }
}

export interface PromotionsResponse {
  coupons: CouponCode[]
  featured_restaurants: RestaurantAdminRecord[]
}

export interface BannersResponse {
  banners: MarketingBanner[]
}

export type BannerImageUploadResponse = CloudinaryUploadResponse

export interface SettingsResponse {
  settings: PlatformSetting[]
}

export const adminApi = {
  login(email: string, password: string) {
    return apiRequest<{ success: boolean } & AdminSession>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  getProfile(token: string) {
    return apiRequest<{ success: boolean; admin: AdminUser }>('/admin/auth/profile', { token })
  },

  getDashboard(token: string) {
    return apiRequest<{ success: boolean; dashboard: DashboardResponse }>('/admin/dashboard', { token })
  },

  getOrders(token: string, filters?: Record<string, string>) {
    const params = new URLSearchParams(filters)
    const query = params.toString()
    return apiRequest<{ success: boolean } & OrdersResponse>(
      `/admin/orders${query ? `?${query}` : ''}`,
      { token }
    )
  },

  updateOrderStatus(token: string, orderId: string, status: string) {
    return apiRequest<{ success: boolean; order: { id: string } }>(`/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status }),
    })
  },

  cancelOrder(token: string, orderId: string, reason: string) {
    return apiRequest<{ success: boolean }>(`/admin/orders/${orderId}/cancel`, {
      method: 'POST',
      token,
      body: JSON.stringify({ reason }),
    })
  },

  markDelivered(token: string, orderId: string) {
    return apiRequest<{ success: boolean }>(`/admin/orders/${orderId}/mark-delivered`, {
      method: 'POST',
      token,
    })
  },

  reassignRider(token: string, orderId: string, riderId: string) {
    return apiRequest<{ success: boolean }>(`/admin/orders/${orderId}/reassign-rider`, {
      method: 'POST',
      token,
      body: JSON.stringify({ rider_id: riderId }),
    })
  },

  getRestaurants(token: string) {
    return apiRequest<{ success: boolean; restaurants: any[] }>('/admin-extended/restaurants', { token })
  },

  updateRestaurant(token: string, restaurantId: string, payload: Record<string, unknown>) {
    return apiRequest<{ success: boolean }>(`/admin-extended/restaurants/${restaurantId}/status`, {
      method: 'PUT',
      token,
      body: JSON.stringify(payload),
    })
  },

  deleteRestaurant(token: string, restaurantId: string) {
    return apiRequest<{ success: boolean }>(`/admin-extended/restaurants/${restaurantId}`, {
      method: 'DELETE',
      token,
    })
  },

  getDeliveryPartners(token: string) {
    return apiRequest<{ success: boolean; riders: any[] }>('/admin-extended/riders', { token })
  },

  updateDeliveryPartner(token: string, partnerId: string, payload: Record<string, unknown>) {
    return apiRequest<{ success: boolean }>(`/admin-extended/riders/${partnerId}/status`, {
      method: 'PUT',
      token,
      body: JSON.stringify(payload),
    })
  },

  deleteDeliveryPartner(token: string, partnerId: string) {
    return apiRequest<{ success: boolean }>(`/admin-extended/riders/${partnerId}`, {
      method: 'DELETE',
      token,
    })
  },

  getCustomers(token: string) {
    return apiRequest<{ success: boolean } & CustomersResponse>('/admin/customers', { token })
  },

  updateCustomer(token: string, customerId: string, payload: Record<string, unknown>) {
    return apiRequest<{ success: boolean }>(`/admin/customers/${customerId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload),
    })
  },

  getAnalytics(token: string) {
    return apiRequest<{ success: boolean; analytics: AnalyticsResponse }>('/admin/analytics', { token })
  },

  getPayments(token: string) {
    return apiRequest<{ success: boolean; payments: PaymentsResponse }>('/admin/payments', { token })
  },

  getSupport(token: string) {
    return apiRequest<{ success: boolean; support: SupportResponse }>('/admin/support', { token })
  },

  updateSupportTicket(token: string, ticketId: string, payload: Record<string, unknown>) {
    return apiRequest<{ success: boolean }>(`/admin/support/${ticketId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload),
    })
  },

  getPromotions(token: string) {
    return apiRequest<{ success: boolean; promotions: PromotionsResponse }>('/admin/promotions', { token })
  },

  createCoupon(token: string, payload: Record<string, unknown>) {
    return apiRequest<{ success: boolean }>(`/admin/promotions/coupons`, {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    })
  },

  getBanners(token: string) {
    return apiRequest<{ success: boolean } & BannersResponse>('/admin/banners', { token })
  },

  async uploadBannerImage(token: string, file: File, onProgress?: (progress: number) => void) {
    try {
      return await uploadImageToCloudinary({
        file,
        token,
        folder: 'banners',
        scope: 'admin',
        onProgress,
      })
    } catch (error) {
      throw new ApiError(error instanceof Error ? error.message : 'Banner upload failed', 0)
    }
  },

  getBannerUploadSignature(token: string, payload: {
    fileType: string
    fileSize: number
    width?: number
    height?: number
  }) {
    return apiRequest<{
      success: boolean
      upload: {
        cloudName: string
        apiKey: string
        folder: string
        timestamp: number
        signature: string
      }
    }>('/admin/banners/upload-signature', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    })
  },

  createBanner(token: string, payload: Record<string, unknown>) {
    return apiRequest<{ success: boolean; banner: MarketingBanner }>('/admin/banners', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    })
  },

  updateBanner(token: string, bannerId: string, payload: Record<string, unknown>) {
    return apiRequest<{ success: boolean; banner: MarketingBanner }>(`/admin/banners/${bannerId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload),
    })
  },

  deleteBanner(token: string, bannerId: string) {
    return apiRequest<{ success: boolean; banner: MarketingBanner }>(`/admin/banners/${bannerId}`, {
      method: 'DELETE',
      token,
    })
  },

  getSettings(token: string) {
    return apiRequest<{ success: boolean } & SettingsResponse>('/admin/settings', { token })
  },

  updateSettings(token: string, settings: Array<Record<string, unknown>>) {
    return apiRequest<{ success: boolean } & SettingsResponse>('/admin/settings', {
      method: 'PUT',
      token,
      body: JSON.stringify({ settings }),
    })
  },

  getLiveMap(token: string) {
    return apiRequest<{ success: boolean; liveMap: LiveMapPayload }>('/admin/live-map', { token })
  },

  // Governance & Approvals
  getPendingRestaurants(token: string) {
    return apiRequest<{ success: boolean; pending: any[] }>('/admin-extended/restaurants/pending', { token })
  },
  approveRestaurant(token: string, restaurantId: number | string, payload: any = {}) {
    return apiRequest<{ success: boolean }>(`/admin-extended/restaurants/${restaurantId}/approve`, {
      method: 'POST', token, body: JSON.stringify(payload)
    })
  },
  rejectRestaurant(token: string, restaurantId: number | string, payload: any = {}) {
    return apiRequest<{ success: boolean }>(`/admin-extended/restaurants/${restaurantId}/reject`, {
      method: 'POST', token, body: JSON.stringify(payload)
    })
  },
  getPendingRiders(token: string) {
    return apiRequest<{ success: boolean; pending: any[] }>('/admin-extended/riders/pending', { token })
  },
  approveRider(token: string, riderId: number | string, payload: any = {}) {
    return apiRequest<{ success: boolean }>(`/admin-extended/riders/${riderId}/approve`, {
      method: 'POST', token, body: JSON.stringify(payload)
    })
  },
  rejectRider(token: string, riderId: number | string, payload: any = {}) {
    return apiRequest<{ success: boolean }>(`/admin-extended/riders/${riderId}/reject`, {
      method: 'POST', token, body: JSON.stringify(payload)
    })
  },
  registerManualRestaurant(token: string, payload: any) {
    return apiRequest<{ success: boolean }>(`/admin-extended/restaurants/register-manual`, {
      method: 'POST', token, body: JSON.stringify(payload)
    })
  },
  registerManualRider(token: string, payload: any) {
    return apiRequest<{ success: boolean }>(`/admin-extended/riders/register-manual`, {
      method: 'POST', token, body: JSON.stringify(payload)
    })
  },

  // Restaurant Menu Management (scoped to restaurant)
  getRestaurantMenu(token: string, restaurantId: string) {
    return apiRequest<{ success: boolean; categories: any[]; items: any[] }>(`/admin-extended/restaurants/${restaurantId}/menu`, { token })
  },
  createMenuCategory(token: string, restaurantId: string, payload: any) {
    return apiRequest<{ success: boolean }>(`/admin-extended/restaurants/${restaurantId}/category`, {
      method: 'POST', token, body: JSON.stringify(payload)
    })
  },
  updateMenuCategory(token: string, restaurantId: string, categoryId: string, payload: any) {
    return apiRequest<{ success: boolean }>(`/admin-extended/restaurants/${restaurantId}/category/${categoryId}`, {
      method: 'PUT', token, body: JSON.stringify(payload)
    })
  },
  deleteMenuCategory(token: string, restaurantId: string, categoryId: string) {
    return apiRequest<{ success: boolean }>(`/admin-extended/restaurants/${restaurantId}/category/${categoryId}`, {
      method: 'DELETE', token
    })
  },
  reorderMenuCategories(token: string, restaurantId: string, categoryIds: string[]) {
    return apiRequest<{ success: boolean }>(`/admin-extended/restaurants/${restaurantId}/categories/reorder`, {
      method: 'PUT', token, body: JSON.stringify({ categoryIds })
    })
  },
  createMenuItem(token: string, restaurantId: string, payload: any) {
    return apiRequest<{ success: boolean }>(`/admin-extended/restaurants/${restaurantId}/item`, {
      method: 'POST', token, body: JSON.stringify(payload)
    })
  },
  updateMenuItem(token: string, restaurantId: string, itemId: string, payload: any) {
    return apiRequest<{ success: boolean }>(`/admin-extended/restaurants/${restaurantId}/item/${itemId}`, {
      method: 'PUT', token, body: JSON.stringify(payload)
    })
  },
  toggleItemStock(token: string, restaurantId: string, itemId: string, inStock: boolean) {
    return apiRequest<{ success: boolean }>(`/admin-extended/restaurants/${restaurantId}/item/${itemId}/stock`, {
      method: 'PATCH', token, body: JSON.stringify({ inStock })
    })
  },
  deleteMenuItem(token: string, restaurantId: string, itemId: string) {
    return apiRequest<{ success: boolean }>(`/admin-extended/restaurants/${restaurantId}/item/${itemId}`, {
      method: 'DELETE', token
    })
  },
  createItemVariant(token: string, restaurantId: string, itemId: string, payload: any) {
    return apiRequest<{ success: boolean }>(`/admin-extended/restaurants/${restaurantId}/item/${itemId}/variant`, {
      method: 'POST', token, body: JSON.stringify(payload)
    })
  },
  updateItemVariant(token: string, restaurantId: string, itemId: string, variantId: string, payload: any) {
    return apiRequest<{ success: boolean }>(`/admin-extended/restaurants/${restaurantId}/item/${itemId}/variant/${variantId}`, {
      method: 'PUT', token, body: JSON.stringify(payload)
    })
  },
  deleteItemVariant(token: string, restaurantId: string, itemId: string, variantId: string) {
    return apiRequest<{ success: boolean }>(`/admin-extended/restaurants/${restaurantId}/item/${itemId}/variant/${variantId}`, {
      method: 'DELETE', token
    })
  },
  createItemAddon(token: string, restaurantId: string, itemId: string, payload: any) {
    return apiRequest<{ success: boolean }>(`/admin-extended/restaurants/${restaurantId}/item/${itemId}/addon`, {
      method: 'POST', token, body: JSON.stringify(payload)
    })
  },
  updateItemAddon(token: string, restaurantId: string, itemId: string, addonId: string, payload: any) {
    return apiRequest<{ success: boolean }>(`/admin-extended/restaurants/${restaurantId}/item/${itemId}/addon/${addonId}`, {
      method: 'PUT', token, body: JSON.stringify(payload)
    })
  },
  deleteItemAddon(token: string, restaurantId: string, itemId: string, addonId: string) {
    return apiRequest<{ success: boolean }>(`/admin-extended/restaurants/${restaurantId}/item/${itemId}/addon/${addonId}`, {
      method: 'DELETE', token
    })
  },
}
