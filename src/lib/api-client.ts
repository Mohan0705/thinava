import axios from 'axios'
import { API_BASE_URL, ApiError } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useDeliveryAuthStore } from '@/store/deliveryAuthStore'
import { useRestaurantOwnerAuthStore } from '@/store/restaurantOwnerAuthStore'
import { useAdminAuthStore } from '@/features/admin/auth-store'
import { getStoredTokenForScope, getSupabaseSessionToken, syncAuthCookie } from '@/lib/auth/session'
import type { AuthScope } from '@/lib/auth/cookies'

const SCOPE_STORE_MAP: Record<AuthScope, () => string | null> = {
  customer: () => useAuthStore.getState().token,
  delivery: () => useDeliveryAuthStore.getState().token,
  restaurant: () => useRestaurantOwnerAuthStore.getState().token,
  admin: () => useAdminAuthStore.getState().token,
}

const SCOPE_PERSIST_MAP: Record<AuthScope, () => string | null> = {
  customer: () => getStoredTokenForScope('customer'),
  delivery: () => getStoredTokenForScope('delivery'),
  restaurant: () => getStoredTokenForScope('restaurant'),
  admin: () => getStoredTokenForScope('admin'),
}

const getScopeFromPath = (path: string): AuthScope => {
  if (path.includes('/admin')) return 'admin'
  if (path.includes('/delivery') || path.includes('/rider')) return 'delivery'
  if (path.includes('/restaurant')) return 'restaurant'
  return 'customer'
}

const httpClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
})

httpClient.interceptors.request.use((config) => {
  const scope = getScopeFromPath(config.url || '')
  const token = SCOPE_STORE_MAP[scope]() || SCOPE_PERSIST_MAP[scope]() || (scope === 'customer' ? getSupabaseSessionToken() : null)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const message = error.response.data?.error || error.response.data?.message || `Request failed (${error.response.status})`
      return Promise.reject(new ApiError(message, error.response.status))
    }
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new ApiError('Request timed out. Please try again.', 0))
    }
    return Promise.reject(new ApiError('Unable to reach the server. Please check your connection.', 0))
  }
)

export { httpClient, getScopeFromPath }
export default httpClient
