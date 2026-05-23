'use client'

import { useEffect } from 'react'
import { restaurantPanelApi } from '@/lib/restaurant-panel-api'
import { useRestaurantOwnerAuthStore } from '@/store/restaurantOwnerAuthStore'

export function RestaurantAuthBootstrap() {
  const hydrated = useRestaurantOwnerAuthStore((state) => state.hydrated)
  const token = useRestaurantOwnerAuthStore((state) => state.token)
  const owner = useRestaurantOwnerAuthStore((state) => state.owner)
  const setOwner = useRestaurantOwnerAuthStore((state) => state.setOwner)
  const logout = useRestaurantOwnerAuthStore((state) => state.logout)

  useEffect(() => {
    if (!hydrated || !token || owner) {
      return
    }

    let cancelled = false

    const restoreOwner = async () => {
      try {
        const response = await restaurantPanelApi.getMe(token)
        if (!cancelled) {
          setOwner(response.owner)
        }
      } catch {
        if (!cancelled) {
          logout()
        }
      }
    }

    void restoreOwner()

    return () => {
      cancelled = true
    }
  }, [hydrated, logout, owner, setOwner, token])

  return null
}
