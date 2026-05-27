'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Coins,
  IndianRupee,
  Loader,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  Phone,
  ShieldAlert,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { DeliveryLiveMap } from '@/components/delivery/DeliveryLiveMap'
import { useDeliveryAuthStore } from '@/store/deliveryAuthStore'
import { useDeliveryOrderStore } from '@/store/deliveryOrderStore'
import { deliveryApi } from '@/lib/delivery-api'
import { getRealtimeSocket, releaseRealtimeSocket } from '@/lib/realtime'
import { resetRiderDeliveryState } from '@/lib/realtimeManager'
import { reconcileRiderDeliveryState, resetReconciliationTimer } from '@/lib/deliveryStateReconciliation'
import { DeliveryRealtimeEvent } from '@/types/delivery'
import { SUPPORT_TEL, getWhatsAppLink } from '@/lib/support'
import { calculateDistanceKm, openOsmDirections } from '@/lib/maps/geo'
import { mapDebug } from '@/lib/maps/performance'

const statusTimeline = [
  {
    status: 'ASSIGNED',
    label: 'Accepted',
    helper: 'Offer locked and route prepared.',
    actionLabel: 'Head to restaurant',
  },
  {
    status: 'ARRIVED_AT_RESTAURANT',
    label: 'At restaurant',
    helper: 'Confirm pickup arrival.',
    actionLabel: 'Mark arrived',
  },
  {
    status: 'PICKED_UP',
    label: 'Picked up',
    helper: 'Food is in hand and customer is next.',
    actionLabel: 'Confirm pickup',
  },
  {
    status: 'REACHED_CUSTOMER',
    label: 'At customer',
    helper: 'You reached dropoff point.',
    actionLabel: 'Mark at customer',
  },
  {
    status: 'CASH_COLLECTED',
    label: 'Cash collected',
    helper: 'COD payment confirmed.',
    actionLabel: 'Collect cash',
  },
  {
    status: 'DELIVERED',
    label: 'Delivered',
    helper: 'Task complete and payout ready.',
    actionLabel: 'Complete delivery',
  },
] as const

const formatCurrency = (value: number | undefined) => `Rs. ${Number(value || 0).toFixed(0)}`
const formatMeters = (value?: number | null) =>
  value === null || value === undefined ? '--' : value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`

export default function DeliveryActiveOrderPage() {
  const router = useRouter()
  const token = useDeliveryAuthStore((state) => state.token)
  const activeOrder = useDeliveryOrderStore((state) => state.activeOrder)
  const setActiveOrder = useDeliveryOrderStore((state) => state.setActiveOrder)
  const updateActiveOrderStatus = useDeliveryOrderStore((state) => state.updateActiveOrderStatus)

  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [status, setStatus] = useState<string>('ASSIGNED')
  const lastLocationSyncRef = useRef<{ lat: number; lng: number; syncedAt: number } | null>(null)
  const lastLocationRenderRef = useRef<{ lat: number; lng: number; renderedAt: number } | null>(null)
  const pendingSocketAcksRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const applyCurrentLocation = (nextLocation: { lat: number; lng: number }) => {
    const previous = lastLocationRenderRef.current
    const movedMeters = previous
      ? calculateDistanceKm(
          { lat: previous.lat, lng: previous.lng },
          { lat: nextLocation.lat, lng: nextLocation.lng }
        ) * 1000
      : Number.POSITIVE_INFINITY

    if (!previous || movedMeters >= 8 || Date.now() - previous.renderedAt >= 3000) {
      lastLocationRenderRef.current = { ...nextLocation, renderedAt: Date.now() }
      setCurrentLocation(nextLocation)
    }
  }

  useEffect(() => {
    if (!token) {
      router.push('/delivery/login')
      return
    }

    // [STATE_RECONCILIATION] Reconcile on mount
    void reconcileRiderDeliveryState(token, 'page_mount')

    void loadActiveOrder()
    const fallbackInterval = window.setInterval(() => {
      void loadActiveOrder(true)
    }, 60000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void reconcileRiderDeliveryState(token, 'visibility_change')
        void loadActiveOrder(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const handleFocus = () => {
      void reconcileRiderDeliveryState(token, 'focus')
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      window.clearInterval(fallbackInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      // Clear any pending ACK timeouts
      pendingSocketAcksRef.current.forEach((timeout) => clearTimeout(timeout))
      pendingSocketAcksRef.current.clear()
    }
  }, [router, token])

  const activeOrderIdRef = useRef(activeOrder?.id)
  activeOrderIdRef.current = activeOrder?.id

  useEffect(() => {
    if (!token) {
      return
    }

    const socket = getRealtimeSocket('delivery_partner', token)
    if (!socket) {
      return
    }

    const handleActiveOrderUpdate = () => {
      void loadActiveOrder(true)
    }

    const handleLocationUpdate = (payload?: DeliveryRealtimeEvent) => {
      if (payload?.location?.latitude && payload.location.longitude) {
        applyCurrentLocation({
          lat: payload.location.latitude,
          lng: payload.location.longitude,
        })
      }
    }

    const handleTerminalClose = (payload: any) => {
      if (payload?.order_id === activeOrderIdRef.current) {
        resetRiderDeliveryState(payload)
        setActiveOrder(null)
        setTimeout(() => {
          router.push('/delivery/dashboard')
        }, 150)
      }
    }

    const handleDeliveryCompleted = (payload: any, ack?: () => void) => {
      if (payload?.order_id === activeOrderIdRef.current) {
        // [SOCKET_ACK] Acknowledge receipt to backend
        if (typeof ack === 'function') {
          console.log('[SOCKET_ACK]', {
            orderId: payload.order_id,
            event: 'delivery_completed',
            timestamp: new Date().toISOString(),
          })
          ack()
          resetReconciliationTimer()
        }

        toast.success(`Delivery completed! Rs. ${Number(payload.payout_amount || 0).toFixed(0)} added to wallet`)
        handleTerminalClose(payload)
      }
    }

    const handleOrderCancelled = (payload: any, ack?: () => void) => {
      if (payload?.order_id === activeOrderIdRef.current) {
        // [SOCKET_ACK] Acknowledge receipt to backend
        if (typeof ack === 'function') {
          console.log('[SOCKET_ACK]', {
            orderId: payload.order_id,
            event: 'order_cancelled',
            timestamp: new Date().toISOString(),
          })
          ack()
          resetReconciliationTimer()
        }

        toast.info(payload.message || 'This delivery has been cancelled')
        handleTerminalClose(payload)
      }
    }

    socket.on('delivery:active_order_updated', handleActiveOrderUpdate)
    socket.on('delivery:status_updated', handleActiveOrderUpdate)
    socket.on('RIDER_ARRIVED', handleActiveOrderUpdate)
    socket.on('PICKED_UP', handleActiveOrderUpdate)
    socket.on('ARRIVING', handleActiveOrderUpdate)
    socket.on('DELIVERED', handleActiveOrderUpdate)
    socket.on('CANCELLED', handleActiveOrderUpdate)
    socket.on('delivery:location_updated', handleLocationUpdate)
    socket.on('delivery_completed', handleDeliveryCompleted)
    socket.on('order_cancelled', handleOrderCancelled)
    socket.on('ORDER_COMPLETED', (payload: any, ack?: () => void) => handleDeliveryCompleted(payload, ack))
    socket.on('ORDER_CANCELLED', (payload: any, ack?: () => void) => handleOrderCancelled(payload, ack))
    socket.on('ORDER_MOVED_TO_HISTORY', (payload: any, ack?: () => void) => {
      if (typeof ack === 'function') ack()
      handleTerminalClose(payload)
    })
    socket.on('RIDER_ORDER_CLOSED', (payload: any, ack?: () => void) => {
      if (typeof ack === 'function') ack()
      handleTerminalClose(payload)
    })
    socket.on('RIDER_AVAILABLE', (payload: any, ack?: () => void) => {
      if (typeof ack === 'function') ack()
      handleTerminalClose(payload)
    })
    socket.on('ACTIVE_DELIVERY_CLEARED', (payload: any, ack?: () => void) => {
      if (typeof ack === 'function') ack()
      handleTerminalClose(payload)
    })

    // [SOCKET_RECONNECT] Trigger reconciliation on socket reconnect
    socket.on('connect', () => {
      console.log('[SOCKET_RECONNECT]', {
        timestamp: new Date().toISOString(),
      })
      void reconcileRiderDeliveryState(token, 'socket_reconnect')
    })

    return () => {
      socket.off('delivery:active_order_updated', handleActiveOrderUpdate)
      socket.off('delivery:status_updated', handleActiveOrderUpdate)
      socket.off('RIDER_ARRIVED', handleActiveOrderUpdate)
      socket.off('PICKED_UP', handleActiveOrderUpdate)
      socket.off('ARRIVING', handleActiveOrderUpdate)
      socket.off('DELIVERED', handleActiveOrderUpdate)
      socket.off('CANCELLED', handleActiveOrderUpdate)
      socket.off('delivery:location_updated', handleLocationUpdate)
      socket.off('delivery_completed', handleDeliveryCompleted)
      socket.off('order_cancelled', handleOrderCancelled)
      socket.off('ORDER_COMPLETED')
      socket.off('ORDER_CANCELLED')
      socket.off('ORDER_MOVED_TO_HISTORY')
      socket.off('RIDER_ORDER_CLOSED')
      socket.off('RIDER_AVAILABLE')
      socket.off('ACTIVE_DELIVERY_CLEARED')
      socket.off('connect')
      releaseRealtimeSocket('delivery_partner', token)
    }
  }, [token])

  const shouldSyncLocation = (nextLocation: { lat: number; lng: number }) => {
    const previous = lastLocationSyncRef.current
    if (!previous) return true

    const distanceMeters =
      calculateDistanceKm(
        { lat: previous.lat, lng: previous.lng },
        { lat: nextLocation.lat, lng: nextLocation.lng }
      ) * 1000

    return distanceMeters >= 12 || Date.now() - previous.syncedAt >= 5000
  }

  useEffect(() => {
    if (!token || !activeOrder?.id || !navigator.geolocation) {
      return
    }

    const currentId = activeOrder.id

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        applyCurrentLocation(nextLocation)

        if (shouldSyncLocation(nextLocation)) {
          lastLocationSyncRef.current = { ...nextLocation, syncedAt: Date.now() }
          void deliveryApi.updateLocation(
            token,
            currentId,
            nextLocation.lat,
            nextLocation.lng,
            position.coords.accuracy
          ).then(() => {
            void loadActiveOrder(true)
          })
        }
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 12000 }
    )

    mapDebug('delivery active-order watcher started', { orderId: currentId, watchId })

    return () => {
      navigator.geolocation.clearWatch(watchId)
      mapDebug('delivery active-order watcher cleared', { orderId: currentId, watchId })
    }
  }, [activeOrder?.id, token])

  const loadActiveOrder = async (background = false) => {
    try {
      const result = await deliveryApi.getActiveOrder(token!)

      if (!result.order) {
        if (!background) {
          toast.info('No active delivery task')
          router.push('/delivery/orders')
        }
        return
      }

      setActiveOrder(result.order)
      setStatus(result.order.delivery_status)

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const nextLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            }
            applyCurrentLocation(nextLocation)

            void deliveryApi.updateLocation(
              token!,
              result.order!.id,
              nextLocation.lat,
              nextLocation.lng,
              position.coords.accuracy
            )
          },
          () => undefined,
          { enableHighAccuracy: true, maximumAge: 15000, timeout: 12000 }
        )
      }
    } catch (error) {
      if (!background) {
        toast.error(error instanceof Error ? error.message : 'Failed to load active order')
        router.push('/delivery/orders')
      }
    } finally {
      if (!background) {
        setLoading(false)
      }
    }
  }

  const currentIndex = Math.max(
    statusTimeline.findIndex((step) => step.status === status),
    0
  )

  const nextAction = useMemo(() => statusTimeline[currentIndex + 1] || null, [currentIndex])
  const nextActionState = activeOrder?.action_state
  const nextTarget = activeOrder?.gps_validation?.next_target || null
  const localNextTarget = useMemo(() => {
    if (!activeOrder || !nextActionState?.target_scope || !currentLocation) return null

    const target =
      nextActionState.target_scope === 'customer'
        ? activeOrder.customer_latitude && activeOrder.customer_longitude
          ? { lat: activeOrder.customer_latitude, lng: activeOrder.customer_longitude }
          : null
        : activeOrder.restaurant_latitude && activeOrder.restaurant_longitude
          ? { lat: activeOrder.restaurant_latitude, lng: activeOrder.restaurant_longitude }
          : null

    if (!target) return null

    const distanceMeters =
      calculateDistanceKm({ lat: currentLocation.lat, lng: currentLocation.lng }, target) * 1000
    const requiredRadius = activeOrder.gps_validation?.required_radius_meters || 75

    return {
      distance_meters: distanceMeters,
      inside_range: distanceMeters <= requiredRadius,
      required_radius_meters: requiredRadius,
    }
  }, [activeOrder, currentLocation, nextActionState?.target_scope])
  const canRunNextAction = Boolean(nextActionState?.next_action_enabled || localNextTarget?.inside_range)
  const visibleDistanceMeters = localNextTarget?.distance_meters ?? nextTarget?.distance_meters
  const visibleInsideRange = Boolean(localNextTarget?.inside_range || nextTarget?.inside_range)
  const visibleRequiredRadius =
    localNextTarget?.required_radius_meters || activeOrder?.gps_validation?.required_radius_meters || 75

  const handleStatusUpdate = async (newStatus: string) => {
    if (!activeOrder) {
      return
    }

    if (!canRunNextAction) {
      toast.error(activeOrder.action_state?.disabled_reason || 'Reach the location checkpoint first')
      return
    }

    setUpdatingStatus(true)
    const previousStatus = status
    const previousOrder = activeOrder
    setStatus(newStatus)
    updateActiveOrderStatus(newStatus)

    try {
      let lat: number | undefined
      let lng: number | undefined

      if (navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 12000,
          })
        })
        lat = position.coords.latitude
        lng = position.coords.longitude
        applyCurrentLocation({ lat, lng })
      }

      await deliveryApi.updateDeliveryStatus(token!, activeOrder.id, newStatus, lat, lng, {
        cash_collected: newStatus === 'CASH_COLLECTED',
        notes:
          newStatus === 'CASH_COLLECTED'
            ? 'COD cash collected by rider'
            : undefined,
      })
      void loadActiveOrder(true)

      if (newStatus === 'DELIVERED') {
        toast.success('Delivery completed successfully')
        setTimeout(() => {
          router.push('/delivery/dashboard')
        }, 1600)
      } else {
        toast.success(`Updated to ${newStatus.replace(/_/g, ' ').toLowerCase()}`)
      }
    } catch (error) {
      setStatus(previousStatus)
      setActiveOrder(previousOrder)
      toast.error(error instanceof Error ? error.message : 'Failed to update delivery status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleFoodNotReady = async () => {
    if (!activeOrder || !token) return

    const confirmed = window.confirm('Report food not ready and move the restaurant order back to preparing?')
    if (!confirmed) return

    const reason = window.prompt('Optional reason for the restaurant/admin', 'Food not ready at pickup counter') || ''

    setUpdatingStatus(true)
    try {
      await deliveryApi.reportFoodNotReady(token, activeOrder.id, reason)
      toast.success('Food not ready reported. Restaurant and admin have been notified.')
      void loadActiveOrder(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to report food not ready')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const openMaps = (latitude?: number, longitude?: number) => {
    if (!latitude || !longitude) {
      toast.error('Live coordinates are unavailable for this stop')
      return
    }

    openOsmDirections(
      { lat: latitude, lng: longitude },
      currentLocation ? { lat: currentLocation.lat, lng: currentLocation.lng } : null
    )
  }

  if (loading || !activeOrder) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <Loader className="h-12 w-12 animate-spin text-orange-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-4 md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push('/delivery/dashboard')}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 backdrop-blur"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-orange-200">Active delivery</p>
              <h1 className="text-2xl font-bold">{activeOrder.restaurant_name}</h1>
            </div>

            <div className="rounded-full border border-emerald-400/30 bg-emerald-400/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
              Live
            </div>
          </div>

          <DeliveryLiveMap
            rider={
              currentLocation
                ? { latitude: currentLocation.lat, longitude: currentLocation.lng }
                : null
            }
            restaurant={
              activeOrder.restaurant_latitude && activeOrder.restaurant_longitude
                ? {
                    latitude: activeOrder.restaurant_latitude,
                    longitude: activeOrder.restaurant_longitude,
                  }
                : null
            }
            customer={
              activeOrder.customer_latitude && activeOrder.customer_longitude
                ? {
                    latitude: activeOrder.customer_latitude,
                    longitude: activeOrder.customer_longitude,
                  }
                : null
            }
            heightClassName="h-[42vh] min-h-[280px] md:h-[58vh]"
          />

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-5">
              <Card className="border border-white/10 bg-white/5 text-white shadow-[0_35px_100px_-70px_rgba(15,23,42,0.9)]">
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    {statusTimeline.map((step, index) => (
                      <div
                        key={step.status}
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
                          index <= currentIndex
                            ? 'bg-white text-slate-950'
                            : 'bg-white/8 text-white/55'
                        }`}
                      >
                        {step.label}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                        <Coins className="h-4 w-4 text-orange-300" />
                        Earnings
                      </div>
                      <p className="mt-3 text-3xl font-bold">{formatCurrency(activeOrder.estimated_earnings)}</p>
                      <p className="mt-1 text-sm text-white/55">
                        {activeOrder.night_badge ? `Night surge at Rs. ${Number(activeOrder.per_km_rate || 0).toFixed(0)}/km` : `Surge ${formatCurrency(activeOrder.payout_breakdown?.surge_bonus)}`}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                        <Navigation className="h-4 w-4 text-sky-300" />
                        Distance
                      </div>
                      <p className="mt-3 text-3xl font-bold">{Number(activeOrder.route_distance_km || 0).toFixed(1)} km</p>
                      <p className="mt-1 text-sm text-white/55">
                        Pickup {Number(activeOrder.pickup_distance_km || 0).toFixed(1)} km
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                        <Clock3 className="h-4 w-4 text-emerald-300" />
                        ETA
                      </div>
                      <p className="mt-3 text-3xl font-bold">{activeOrder.estimated_total_eta_minutes || '--'} min</p>
                      <p className="mt-1 text-sm text-white/55">
                        Drop {activeOrder.estimated_dropoff_eta_minutes || '--'} min
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-[28px] border border-orange-400/20 bg-orange-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <Sparkles className="mt-0.5 h-5 w-5 text-orange-300" />
                      <div>
                        <p className="font-semibold text-orange-100">{statusTimeline[currentIndex]?.label || 'Active task'}</p>
                        <p className="mt-1 text-sm text-orange-100/75">
                          {nextActionState?.helper_text || statusTimeline[currentIndex]?.helper}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[28px] border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">GPS checkpoint</p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {nextTarget?.label || 'Waiting for next step'}
                        </p>
                        <p className="mt-1 text-sm text-white/60">
                          Distance: {formatMeters(visibleDistanceMeters)} / allowed {visibleRequiredRadius} m
                        </p>
                      </div>
                      <div className={`rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                        visibleInsideRange
                          ? 'bg-emerald-400/20 text-emerald-200'
                          : 'bg-amber-400/20 text-amber-100'
                      }`}>
                        {visibleInsideRange ? 'Inside range' : 'Move closer'}
                      </div>
                    </div>
                    {!canRunNextAction && nextActionState?.disabled_reason ? (
                      <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                        {nextActionState.disabled_reason}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-white/10 bg-white/5 text-white">
                <CardContent className="space-y-4 p-6">
                  <div className="rounded-[28px] border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-orange-500/15 p-3 text-orange-200">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Pickup</p>
                        <p className="mt-1 text-lg font-semibold">{activeOrder.restaurant_name}</p>
                        <p className="mt-1 text-sm text-white/60">{activeOrder.restaurant_address}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-3">
                      <Button type="button" className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={() => openMaps(activeOrder.restaurant_latitude, activeOrder.restaurant_longitude)}>
                        <Navigation className="mr-2 h-4 w-4" />
                        Navigate to restaurant
                      </Button>
                      <Button type="button" variant="outline" className="flex-1 border-white/15 bg-white/5 text-white hover:bg-white/10">
                        <Phone className="mr-2 h-4 w-4" />
                        Call store
                      </Button>
                    </div>
                    {['ASSIGNED', 'ARRIVED_AT_RESTAURANT'].includes(status) ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={updatingStatus}
                        className="mt-3 w-full border-amber-400/25 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                        onClick={handleFoodNotReady}
                      >
                        <ShieldAlert className="mr-2 h-4 w-4" />
                        Food Not Ready
                      </Button>
                    ) : null}
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-sky-500/15 p-3 text-sky-200">
                        <UserRound className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Customer</p>
                        <p className="mt-1 text-lg font-semibold">{activeOrder.customer_name}</p>
                        <p className="mt-1 text-sm text-white/60">{activeOrder.customer_address}</p>
                        {activeOrder.customer_landmark ? (
                          <p className="mt-1 text-xs text-white/45">Landmark: {activeOrder.customer_landmark}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 flex gap-3">
                      <Button type="button" className="flex-1 bg-sky-500 hover:bg-sky-600" onClick={() => openMaps(activeOrder.customer_latitude, activeOrder.customer_longitude)}>
                        <Navigation className="mr-2 h-4 w-4" />
                        Navigate to customer
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 border-white/15 bg-white/5 text-white hover:bg-white/10"
                        onClick={() => {
                          window.location.href = `tel:${activeOrder.customer_phone}`
                        }}
                      >
                        <Phone className="mr-2 h-4 w-4" />
                        Call customer
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-5">
              <Card className="border border-white/10 bg-white text-slate-950 shadow-[0_35px_100px_-65px_rgba(15,23,42,0.75)]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Task actions</p>
                      <h2 className="mt-2 text-2xl font-bold">
                        {nextActionState?.next_action_label || nextAction?.label || 'Delivery complete'}
                      </h2>
                    </div>
                    <div className="rounded-full bg-emerald-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      {activeOrder.payment_type || 'PREPAID'}
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    {activeOrder.payment_type === 'COD' ? (
                      <div className={`rounded-2xl border px-4 py-3 ${
                        activeOrder.cash_collected
                          ? 'border-emerald-100 bg-emerald-50'
                          : status === 'REACHED_CUSTOMER'
                            ? 'border-amber-200 bg-amber-50'
                            : 'border-slate-100 bg-slate-50'
                      }`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="rounded-full bg-white p-2 text-amber-700">
                              <IndianRupee className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-950">
                                {activeOrder.cash_collected ? 'Cash collected' : 'Collect cash'}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                Amount to collect: {formatCurrency(activeOrder.amount_to_collect || activeOrder.total)}
                              </p>
                            </div>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            activeOrder.cash_collected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {activeOrder.cash_collected ? 'Done' : 'Required'}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {statusTimeline.map((step, index) => (
                      <div
                        key={step.status}
                        className={`rounded-2xl border px-4 py-3 ${
                          index === currentIndex
                            ? 'border-orange-200 bg-orange-50'
                            : index < currentIndex
                            ? 'border-emerald-100 bg-emerald-50/80'
                            : 'border-slate-100 bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-950">{step.label}</p>
                            <p className="mt-1 text-sm text-slate-500">{step.helper}</p>
                          </div>
                          {index < currentIndex ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  {nextAction ? (
                    <Button
                      type="button"
                      disabled={updatingStatus || !canRunNextAction}
                      onClick={() => handleStatusUpdate(nextActionState?.next_status || nextAction.status)}
                      className="sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 mt-6 min-h-[56px] w-full rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 py-6 text-base shadow-[0_18px_45px_-20px_rgba(249,115,22,0.8)]"
                    >
                      {updatingStatus ? (
                        <>
                          <Loader className="mr-2 h-4 w-4 animate-spin" />
                          Updating task...
                        </>
                      ) : (
                        nextActionState?.next_action_label || nextAction.actionLabel
                      )}
                    </Button>
                  ) : (
                    <div className="mt-6 rounded-3xl bg-emerald-50 p-4 text-center text-emerald-800">
                      <p className="font-semibold">Delivery complete</p>
                      <p className="mt-1 text-sm">Thinava is syncing your payout and clearing you for the next task.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-white/10 bg-white/5 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="h-5 w-5 text-red-300" />
                    <div>
                      <p className="font-semibold">Support and safety</p>
                      <p className="text-sm text-white/60">Escalate incidents or reach operations quickly while on task.</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                      onClick={() => {
                        window.location.href = SUPPORT_TEL
                      }}
                    >
                      <Phone className="mr-2 h-4 w-4" />
                      Call Support
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-green-500/20 bg-green-500/10 text-green-200 hover:bg-green-500/20"
                      onClick={() => {
                        const orderId = activeOrder?.id ? activeOrder.id.slice(0, 8).toUpperCase() : ''
                        window.open(getWhatsAppLink(`Hi Thinava Rider Support, I need help with order ${orderId}`), '_blank')
                      }}
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      WhatsApp Support
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-white/10 bg-white/5 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-orange-200" />
                    <div>
                      <p className="font-semibold">Order manifest</p>
                      <p className="text-sm text-white/60">Double-check every packed item before leaving pickup.</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {activeOrder.items?.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-white/50">Qty {item.quantity}</p>
                        </div>
                        <p className="font-semibold">{formatCurrency(item.price)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
