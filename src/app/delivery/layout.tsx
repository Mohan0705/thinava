'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useDeliveryAuthStore } from '@/store/deliveryAuthStore'
import { DeliveryAssignedOrderPopup } from '@/components/delivery/DeliveryAssignedOrderPopup'
import { DeliveryAuthBootstrap } from '@/features/delivery/DeliveryAuthBootstrap'
import { DeliverySessionLockBanner } from '@/components/delivery/DeliverySessionLockBanner'

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const token = useDeliveryAuthStore((state) => state.token)
  const hydrated = useDeliveryAuthStore((state) => state.hydrated)

  const publicRoutes = ['/delivery/login', '/delivery/register']
  const isPublicRoute = pathname ? publicRoutes.includes(pathname) : false

  useEffect(() => {
    if (!hydrated) {
      return
    }

    if (!token && !isPublicRoute) {
      router.replace('/delivery/login')
    }
  }, [hydrated, token, isPublicRoute, router])

  if (!hydrated && !isPublicRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#000A22] text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-orange-400/25 border-t-orange-400" />
          <p className="mt-4 text-sm text-white/65">Restoring your Thinava rider session...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <DeliveryAuthBootstrap />
      <DeliverySessionLockBanner />
      {children}
      <DeliveryAssignedOrderPopup />
    </>
  )
}
