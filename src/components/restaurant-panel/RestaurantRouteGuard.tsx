'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { restaurantPanelApi } from '@/lib/restaurant-panel-api'
import { useRestaurantOwnerAuthStore } from '@/store/restaurantOwnerAuthStore'
import { PanelSkeleton } from '@/components/restaurant-panel/PanelSkeleton'
import { RestaurantAuthBootstrap } from '@/features/restaurant/RestaurantAuthBootstrap'

export function RestaurantRouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const token = useRestaurantOwnerAuthStore((state) => state.token)
  const owner = useRestaurantOwnerAuthStore((state) => state.owner)
  const hydrated = useRestaurantOwnerAuthStore((state) => state.hydrated)
  const setOwner = useRestaurantOwnerAuthStore((state) => state.setOwner)
  const logout = useRestaurantOwnerAuthStore((state) => state.logout)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let isMounted = true

    const validateSession = async () => {
      if (!hydrated) {
        return
      }

      if (!token) {
        router.replace('/restaurant-auth')
        return
      }

      if (owner) {
        if (isMounted) {
          setReady(true)
        }
        return
      }

      try {
        const response = await restaurantPanelApi.getMe(token)
        if (isMounted) {
          setOwner(response.owner)
          setReady(true)
        }
      } catch (error) {
        if (isMounted) {
          logout()
          toast.error('Your restaurant session expired. Please log in again.')
          router.replace('/restaurant-auth')
        }
      }
    }

    validateSession()

    return () => {
      isMounted = false
    }
  }, [hydrated, logout, owner, router, setOwner, token])

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#f3f6fb] p-6">
        <RestaurantAuthBootstrap />
        <PanelSkeleton />
      </div>
    )
  }

  return (
    <>
      <RestaurantAuthBootstrap />
      {children}
    </>
  )
}
