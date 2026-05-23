'use client'

import { AUTH_COOKIE_NAMES, type AuthScope } from '@/lib/auth/cookies'

const AUTH_STORAGE_KEYS: Record<AuthScope, string> = {
  customer: 'auth-storage',
  delivery: 'delivery-auth-storage',
  restaurant: 'restaurant-owner-auth',
  admin: 'thinava-admin-auth',
}

const LEGACY_STORAGE_KEYS: Partial<Record<AuthScope, string[]>> = {
  delivery: ['delivery_token'],
}

const getPersistedState = (key: string) => {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(key)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as
      | { state?: Record<string, unknown> }
      | Record<string, unknown>
      | null

    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    return 'state' in parsed && parsed.state && typeof parsed.state === 'object'
      ? parsed.state
      : parsed
  } catch {
    return null
  }
}

export const getAuthScopeFromPath = (path: string): AuthScope => {
  if (path.startsWith('/delivery/')) {
    return 'delivery'
  }

  if (path.startsWith('/restaurant/')) {
    return 'restaurant'
  }

  if (path.startsWith('/admin/')) {
    return 'admin'
  }

  return 'customer'
}

export const getStoredTokenForScope = (scope: AuthScope) => {
  if (typeof window === 'undefined') {
    return null
  }

  const persistedState = getPersistedState(AUTH_STORAGE_KEYS[scope])
  const persistedStateWithToken =
    persistedState && typeof persistedState === 'object'
      ? (persistedState as { token?: string | null })
      : null
  const persistedToken =
    persistedStateWithToken &&
    typeof persistedStateWithToken.token === 'string' &&
    persistedStateWithToken.token.trim().length > 0
      ? persistedStateWithToken.token
      : null

  if (persistedToken) {
    return persistedToken
  }

  const legacyKeys = LEGACY_STORAGE_KEYS[scope] || []
  for (const key of legacyKeys) {
    const legacyToken = window.localStorage.getItem(key)
    if (legacyToken && legacyToken.trim().length > 0) {
      return legacyToken
    }
  }

  return null
}

const extractSupabaseToken = (raw: string) => {
  try {
    const parsed = JSON.parse(raw) as
      | { access_token?: string; currentSession?: { access_token?: string } }
      | Array<{ access_token?: string }>
      | null

    if (!parsed) {
      return null
    }

    if (Array.isArray(parsed)) {
      const candidate = parsed.find((item) => typeof item?.access_token === 'string')
      return candidate?.access_token || null
    }

    if (typeof parsed.access_token === 'string' && parsed.access_token.trim().length > 0) {
      return parsed.access_token
    }

    if (
      parsed.currentSession &&
      typeof parsed.currentSession.access_token === 'string' &&
      parsed.currentSession.access_token.trim().length > 0
    ) {
      return parsed.currentSession.access_token
    }
  } catch {
    return null
  }

  return null
}

export const getSupabaseSessionToken = () => {
  if (typeof window === 'undefined') {
    return null
  }

  const storage = window.localStorage
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key || !/^sb-.*-auth-token$/i.test(key)) {
      continue
    }

    const raw = storage.getItem(key)
    if (!raw) {
      continue
    }

    const token = extractSupabaseToken(raw)
    if (token) {
      return token
    }
  }

  return null
}

export const syncAuthCookie = (scope: AuthScope, token: string | null) => {
  if (typeof document === 'undefined') {
    return
  }

  const name = AUTH_COOKIE_NAMES[scope]
  if (!token) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`
    return
  }

  document.cookie = `${name}=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`
}

export const syncLegacyDeliveryToken = (token: string | null) => {
  if (typeof window === 'undefined') {
    return
  }

  if (!token) {
    window.localStorage.removeItem('delivery_token')
    return
  }

  window.localStorage.setItem('delivery_token', token)
}

export const isSessionErrorMessage = (message: string) =>
  /(token|session|auth|expired|unauth|sign in|login|required)/i.test(message)

export const emitSessionExpiredEvent = (scope: AuthScope, message: string) => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent('thinava:session-expired', {
      detail: {
        scope,
        message,
      },
    })
  )
}
