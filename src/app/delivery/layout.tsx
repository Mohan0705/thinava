'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useDeliveryAuthStore } from '@/store/deliveryAuthStore'
import { getRealtimeSocket, releaseRealtimeSocket } from '@/lib/realtime'
import { resetRiderDeliveryState } from '@/lib/realtimeManager'
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

  useEffect(() => {
    if (!token) {
      return
    }

    const socket = getRealtimeSocket('delivery_partner', token)
    if (!socket) {
      return
    }

    const terminalEvents = [
      'ORDER_COMPLETED',
      'ORDER_CANCELLED',
      'ORDER_MOVED_TO_HISTORY',
      'RIDER_ORDER_CLOSED',
      'RIDER_AVAILABLE',
      'ACTIVE_DELIVERY_CLEARED',
      'DELIVERED',
      'CANCELLED',
      'delivery_completed',
      'order_cancelled',
      'delivery:active_order_updated',
      'delivery:status_updated',
    ]

    const handleTerminalEvent = (payload: any) => {
      const order = payload?.order
      const status = String(
        payload?.status ||
        payload?.delivery_status ||
        order?.delivery_status ||
        order?.status ||
        ''
      ).toUpperCase()
      const isTerminal =
        ['DELIVERED', 'CANCELLED', 'FAILED', 'EXPIRED'].includes(status) ||
        ['ORDER_COMPLETED', 'ORDER_CANCELLED', 'ORDER_MOVED_TO_HISTORY', 'RIDER_ORDER_CLOSED', 'RIDER_AVAILABLE', 'ACTIVE_DELIVERY_CLEARED'].includes(payload?.event || payload?.lifecycle_event)

      if (!isTerminal) {
        return
      }

      resetRiderDeliveryState(payload)
      if (pathname === '/delivery/active-order') {
        router.replace('/delivery/dashboard')
      }
    }

    terminalEvents.forEach((eventName) => socket.on(eventName, handleTerminalEvent))

    return () => {
      terminalEvents.forEach((eventName) => socket.off(eventName, handleTerminalEvent))
      releaseRealtimeSocket('delivery_partner', token)
    }
  }, [pathname, router, token])

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
