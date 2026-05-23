'use client'

/**
 * User-scoped localStorage utilities
 * 
 * SECURITY: Prevents cross-account data leakage
 * 
 * After authentication, all user-specific state should be persisted
 * using user-scoped keys (e.g., `cart_${userId}` instead of `cart`)
 * 
 * On logout, all user-scoped keys must be cleared
 */

/**
 * Get a user-scoped storage key
 * Returns global key if userId is null (for shared/anonymous data)
 */
export const getUserScopedKey = (baseKey: string, userId: string | null | undefined): string => {
  if (!userId) {
    return baseKey
  }
  return `${baseKey}_${userId}`
}

/**
 * Clear all user-scoped storage keys for a user
 * Use this on logout to prevent data leakage to next user
 */
export const clearUserScopedStorage = (userId: string | null | undefined, baseKeys: string[]) => {
  if (typeof window === 'undefined') {
    return
  }

  if (!userId) {
    return
  }

  for (const baseKey of baseKeys) {
    const scopedKey = getUserScopedKey(baseKey, userId)
    try {
      window.localStorage.removeItem(scopedKey)
    } catch (err) {
      console.error(`Failed to clear user-scoped storage key: ${scopedKey}`, err)
    }
  }
}

/**
 * Migrate old global storage key to user-scoped key
 * Used to transition from old global keys to new user-scoped keys
 */
export const migrateToUserScopedStorage = (
  globalKey: string,
  userId: string | null | undefined
): void => {
  if (typeof window === 'undefined' || !userId) {
    return
  }

  try {
    const globalData = window.localStorage.getItem(globalKey)
    if (globalData) {
      const userScopedKey = getUserScopedKey(globalKey, userId)
      window.localStorage.setItem(userScopedKey, globalData)
      // Don't delete global key yet - keep for fallback
    }
  } catch (err) {
    console.error(`Failed to migrate storage from ${globalKey}`, err)
  }
}

/**
 * Zustand custom middleware for user-scoped persistence
 * Automatically uses user-scoped keys when userId is available
 */
export const createUserScopedPersist = (
  baseKey: string,
  storeHasUserId: (state: any) => string | null | undefined
) => {
  return (config: any) => {
    return (set: any, get: any, api: any) => {
      return config(
        (updates: any) => {
          set(updates)
          // Persist to user-scoped key
          if (typeof window !== 'undefined') {
            const state = get()
            const userId = storeHasUserId(state)
            const key = getUserScopedKey(baseKey, userId)
            try {
              window.localStorage.setItem(key, JSON.stringify({ state }))
            } catch (err) {
              console.error(`Failed to persist to ${key}`, err)
            }
          }
        },
        get,
        api
      )
    }
  }
}
