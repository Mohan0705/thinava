'use client'

import { useEffect } from 'react'

export function DevCacheReset() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'

    if (!isLocalhost || !('serviceWorker' in navigator)) {
      return
    }

    const resetCaches = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((registration) => registration.unregister()))

        if ('caches' in window) {
          const cacheKeys = await caches.keys()
          await Promise.all(cacheKeys.map((key) => caches.delete(key)))
        }
      } catch (error) {
        // Ignore cache reset failures in local development.
      }
    }

    resetCaches()
  }, [])

  return null
}
