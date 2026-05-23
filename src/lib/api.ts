import { apiConfig } from '@/config/api'
import { useAuthStore } from '@/store/authStore'
import { useDeliveryAuthStore } from '@/store/deliveryAuthStore'
import { useRestaurantOwnerAuthStore } from '@/store/restaurantOwnerAuthStore'
import { useAdminAuthStore } from '@/features/admin/auth-store'
import { mapUserResponse } from '@/features/auth/utils'
import {
  emitSessionExpiredEvent,
  getAuthScopeFromPath,
  getStoredTokenForScope,
  getSupabaseSessionToken,
  isSessionErrorMessage,
  syncAuthCookie,
} from '@/lib/auth/session'
import type { AuthScope } from '@/lib/auth/cookies'

export const API_BASE_URL = apiConfig.baseUrl

export class ApiError extends Error {
  status: number
  code?: string
  approvalStatus?: string

  constructor(message: string, status: number, code?: string, approvalStatus?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.approvalStatus = approvalStatus
  }
}

type ApiOptions = RequestInit & {
  token?: string | null
}

type RefreshPayloads = {
  customer: {
    success: boolean
    token: string
    user: Record<string, unknown>
    stats?: Record<string, unknown> | null
  }
  delivery: {
    success: boolean
    token: string
    partner: Record<string, unknown>
  }
  restaurant: {
    success: boolean
    token: string
    owner: Record<string, unknown>
  }
  admin: {
    success: boolean
    token: string
    admin: Record<string, unknown>
  }
}

const REFRESH_PATHS: Record<AuthScope, string> = {
  customer: '/auth/refresh',
  delivery: '/delivery/auth/refresh',
  restaurant: '/restaurant/auth/refresh',
  admin: '/admin/auth/refresh',
}

const isClient = typeof window !== 'undefined'
const refreshRequests = new Map<AuthScope, Promise<string | null>>()
const sessionExpiryNotices = new Set<AuthScope>()

const getStoreToken = (scope: AuthScope) => {
  switch (scope) {
    case 'customer':
      return useAuthStore.getState().token
    case 'delivery':
      return useDeliveryAuthStore.getState().token
    case 'restaurant':
      return useRestaurantOwnerAuthStore.getState().token
    case 'admin':
      return useAdminAuthStore.getState().token
    default:
      return null
  }
}

const getTokenForScope = (scope: AuthScope, explicitToken?: string | null) => {
  if (explicitToken && explicitToken.trim().length > 0) {
    return explicitToken
  }

  const storeToken = getStoreToken(scope)
  if (storeToken && storeToken.trim().length > 0) {
    return storeToken
  }

  const persistedToken = getStoredTokenForScope(scope)
  if (persistedToken && persistedToken.trim().length > 0) {
    return persistedToken
  }

  if (scope === 'customer') {
    const supabaseToken = getSupabaseSessionToken()
    if (supabaseToken && supabaseToken.trim().length > 0) {
      return supabaseToken
    }
  }

  return null
}

const clearSessionForScope = (scope: AuthScope) => {
  syncAuthCookie(scope, null)

  switch (scope) {
    case 'customer':
      useAuthStore.getState().logout()
      break
    case 'delivery':
      useDeliveryAuthStore.getState().logout()
      break
    case 'restaurant':
      useRestaurantOwnerAuthStore.getState().logout()
      break
    case 'admin':
      useAdminAuthStore.getState().logout()
      break
  }
}

const applyRefreshedSession = (scope: AuthScope, payload: RefreshPayloads[AuthScope]) => {
  switch (scope) {
    case 'customer': {
      const customerPayload = payload as RefreshPayloads['customer']
      const currentStats = useAuthStore.getState().stats
      useAuthStore.getState().setAuth(
        mapUserResponse(customerPayload.user),
        customerPayload.token,
        (customerPayload.stats as typeof currentStats) ?? currentStats
      )
      break
    }
    case 'delivery': {
      const deliveryPayload = payload as RefreshPayloads['delivery']
      useDeliveryAuthStore.getState().setSession({
        token: deliveryPayload.token,
        partner: deliveryPayload.partner as never,
      })
      break
    }
    case 'restaurant': {
      const restaurantPayload = payload as RefreshPayloads['restaurant']
      useRestaurantOwnerAuthStore
        .getState()
        .setSession(restaurantPayload.owner as never, restaurantPayload.token)
      break
    }
    case 'admin': {
      const adminPayload = payload as RefreshPayloads['admin']
      useAdminAuthStore.getState().setSession({
        token: adminPayload.token,
        admin: adminPayload.admin as never,
      })
      break
    }
  }
}

const notifySessionExpired = (scope: AuthScope, message: string) => {
  if (!isClient || sessionExpiryNotices.has(scope)) {
    return
  }

  sessionExpiryNotices.add(scope)
  emitSessionExpiredEvent(scope, message)
  window.setTimeout(() => {
    sessionExpiryNotices.delete(scope)
  }, 2500)
}

const tryRefreshToken = async (scope: AuthScope, currentToken: string) => {
  if (!isClient) {
    return null
  }

  if (refreshRequests.has(scope)) {
    return refreshRequests.get(scope) || null
  }

  const refreshRequest = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}${REFRESH_PATHS[scope]}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        return null
      }

      const payload = (await response.json()) as RefreshPayloads[AuthScope]
      if (!payload || typeof payload !== 'object' || typeof payload.token !== 'string') {
        return null
      }

      applyRefreshedSession(scope, payload)
      return payload.token
    } catch {
      return null
    } finally {
      refreshRequests.delete(scope)
    }
  })()

  refreshRequests.set(scope, refreshRequest)
  return refreshRequest
}

const parseResponsePayload = async (response: Response) => {
  const raw = await response.text()
  let data: any = {}

  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch {
      data = { message: raw }
    }
  }

  return {
    raw,
    data,
  }
}

const buildHeaders = (token: string | null, headers?: HeadersInit) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...headers,
})

const shouldAttemptRefresh = (path: string, status: number, token: string | null) =>
  Boolean(token) && status === 401 && path !== REFRESH_PATHS[getAuthScopeFromPath(path)]

const extractErrorMessage = (data: any, raw: string, status: number) => {
  const message = data?.error?.message || data?.error || data?.message || raw || 'Request failed'

  if (status === 401 && /no token provided/i.test(String(message))) {
    return 'Please sign in to continue.'
  }

  return message
}

const MAX_RETRIES = 1
const RETRY_BASE_DELAY_MS = 1000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const jitter = () => Math.random() * 500

const shouldRetry = (error: unknown, attempt: number): boolean => {
  if (attempt >= MAX_RETRIES) return false
  if (error instanceof ApiError) return false
  if (error instanceof TypeError) return true
  return false
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options
  const scope = getAuthScopeFromPath(path)
  const resolvedToken = getTokenForScope(scope, token)

  const makeRequest = (nextToken: string | null, attempt: number) => {
    const signal = typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(15000)
      : undefined
    return fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: buildHeaders(nextToken, headers),
      cache: 'no-store',
      ...(signal ? { signal } : {}),
    })
  }

  let response: Response | undefined
  let raw: string = ''
  let data: any = {}
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      response = await makeRequest(resolvedToken, attempt)
      ;({ raw, data } = await parseResponsePayload(response))
      lastError = null
      break
    } catch (networkError) {
      lastError = networkError instanceof Error ? networkError : new Error('Request failed')

      if (attempt === 0) {
        console.warn(`[FETCH] ${path} - Attempt 1 failed: ${lastError.message}`)
      }

      if (!shouldRetry(networkError, attempt)) {
        const msg = networkError instanceof TypeError
          ? 'Unable to reach the server. Please check your connection and try again.'
          : (networkError instanceof Error ? networkError.message : 'Request failed')
        throw new ApiError(msg, 0)
      }

      await sleep(RETRY_BASE_DELAY_MS + jitter())
    }
  }

  if (response && !response.ok && shouldAttemptRefresh(path, response.status, resolvedToken)) {
    const refreshedToken = await tryRefreshToken(scope, resolvedToken as string)

    if (refreshedToken) {
      try {
        response = await makeRequest(refreshedToken, 0)
        ;({ raw, data } = await parseResponsePayload(response))
        lastError = null
      } catch (networkError) {
        lastError = networkError instanceof Error ? networkError : new Error('Request failed after refresh')

        if (shouldRetry(networkError, 0)) {
          await sleep(RETRY_BASE_DELAY_MS + jitter())
          try {
            response = await makeRequest(refreshedToken, 1)
            ;({ raw, data } = await parseResponsePayload(response))
            lastError = null
          } catch (secondError) {
            lastError = secondError instanceof Error ? secondError : new Error('Request failed after refresh retry')
          }
        }

        if (lastError) {
          const msg = networkError instanceof TypeError
            ? 'Unable to reach the server after token refresh.'
            : (lastError.message || 'Request failed after refresh')
          throw new ApiError(msg, 0)
        }
      }
    }
  }

  if (!response || !response.ok) {
    const message = response
      ? extractErrorMessage(data, raw, response.status)
      : (lastError?.message || 'Request failed')

    if (response?.status === 401 && isSessionErrorMessage(message)) {
      clearSessionForScope(scope)
      notifySessionExpired(scope, message.includes('sign in') ? message : 'Your session expired. Please sign in again.')
    }

    throw new ApiError(
      message, 
      response?.status || 0,
      data?.code,
      data?.approvalStatus
    )
  }

  return data as T
}
