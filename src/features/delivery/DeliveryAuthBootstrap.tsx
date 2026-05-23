'use client'

import { useEffect } from 'react'
import { deliveryApi } from '@/lib/delivery-api'
import { useDeliveryAuthStore } from '@/store/deliveryAuthStore'

export function DeliveryAuthBootstrap() {
  const hydrated = useDeliveryAuthStore((state) => state.hydrated)
  const token = useDeliveryAuthStore((state) => state.token)
  const partner = useDeliveryAuthStore((state) => state.partner)
  const setPartner = useDeliveryAuthStore((state) => state.setPartner)
  const logout = useDeliveryAuthStore((state) => state.logout)

  useEffect(() => {
    if (!hydrated || !token || partner) {
      return
    }

    let cancelled = false

    const restoreProfile = async () => {
      try {
        const response = await deliveryApi.getProfile(token)
        if (!cancelled) {
          setPartner(response.profile)
        }
      } catch {
        if (!cancelled) {
          logout()
        }
      }
    }

    void restoreProfile()

    return () => {
      cancelled = true
    }
  }, [hydrated, logout, partner, setPartner, token])

  return null
}
