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
import { DeliveryRealtimeEvent } from '@/types/delivery'
import { SUPPORT_TEL, getWhatsAppLink } from '@/lib/support'

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

  useEffect(() => {
    if (!token) {
      router.push('/delivery/login')
      return
    }

    void loadActiveOrder()
    const fallbackInterval = window.setInterval(() => {
      void loadActiveOrder(true)
    }, 60000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadActiveOrder(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(fallbackInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
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
        setCurrentLocation({
          lat: payload.location.latitude,
          lng: payload.location.longitude,
        })
      }
    }

    const handleDeliveryCompleted = (payload: any) => {
      if (payload?.order_id === activeOrderIdRef.current) {
        toast.success(`Delivery completed! Rs. ${Number(payload.payout_amount || 0).toFixed(0)} added to wallet`)
        setActiveOrder(null)
        setTimeout(() => {
          router.push('/delivery/dashboard')
        }, 1200)
      }
    }

    const handleOrderCancelled = (payload: any) => {
      if (payload?.order_id === activeOrderIdRef.current) {
        toast.info(payload.message || 'This delivery has been cancelled')
        setActiveOrder(null)
        setTimeout(() => {
          router.push('/delivery/orders')
        }, 1200)
      }
    }

    socket.on('delivery:active_order_updated', handleActiveOrderUpdate)
    socket.on('delivery:status_updated', handleActiveOrderUpdate)
    socket.on('delivery:location_updated', handleLocationUpdate)
    socket.on('delivery_completed', handleDeliveryCompleted)
    socket.on('order_cancelled', handleOrderCancelled)

    return () => {
      socket.off('delivery:active_order_updated', handleActiveOrderUpdate)
      socket.off('delivery:status_updated', handleActiveOrderUpdate)
      socket.off('delivery:location_updated', handleLocationUpdate)
      socket.off('delivery_completed', handleDeliveryCompleted)
      socket.off('order_cancelled', handleOrderCancelled)
      releaseRealtimeSocket('delivery_partner', token)
    }
  }, [token])

  useEffect(() => {
    if (!token || !activeOrderIdRef.current || !navigator.geolocation) {
      return
    }

    const currentId = activeOrderIdRef.current

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        setCurrentLocation(nextLocation)
        void deliveryApi.updateLocation(
          token,
          currentId,
          nextLocation.lat,
          nextLocation.lng,
          position.coords.accuracy
        )
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 12000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [token])

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
            setCurrentLocation(nextLocation)

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

  const handleStatusUpdate = async (newStatus: string) => {
    if (!activeOrder) {
      return
    }

    if (!activeOrder.action_state?.next_action_enabled) {
      toast.error(activeOrder.action_state?.disabled_reason || 'Reach the location checkpoint first')
      return
    }

    setUpdatingStatus(true)

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
        setCurrentLocation({ lat, lng })
      }

      await deliveryApi.updateDeliveryStatus(token!, activeOrder.id, newStatus, lat, lng)
      setStatus(newStatus)
      updateActiveOrderStatus(newStatus)
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
      toast.error(error instanceof Error ? error.message : 'Failed to update delivery status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const openMaps = (latitude?: number, longitude?: number) => {
    if (!latitude || !longitude) {
      toast.error('Live coordinates are unavailable for this stop')
      return
    }

    const origin = currentLocation ? `&origin=${currentLocation.lat},${currentLocation.lng}` : ''
    window.open(
      `https://www.google.com/maps/dir/?api=1${origin}&destination=${latitude},${longitude}&travelmode=driving`,
      '_blank'
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
      <div className="px-4 pb-36 pt-4 md:px-8">
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
            heightClassName="h-[58vh]"
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
                          Distance: {formatMeters(nextTarget?.distance_meters)} / allowed {activeOrder.gps_validation?.required_radius_meters || 75} m
                        </p>
                      </div>
                      <div className={`rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                        nextTarget?.inside_range
                          ? 'bg-emerald-400/20 text-emerald-200'
                          : 'bg-amber-400/20 text-amber-100'
                      }`}>
                        {nextTarget?.inside_range ? 'Inside range' : 'Move closer'}
                      </div>
                    </div>
                    {!nextActionState?.next_action_enabled && nextActionState?.disabled_reason ? (
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
                      disabled={updatingStatus || !nextActionState?.next_action_enabled}
                      onClick={() => handleStatusUpdate(nextActionState?.next_status || nextAction.status)}
                      className="mt-6 w-full bg-gradient-to-r from-orange-500 to-red-500 py-6 text-base"
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
                        window.open(getWhatsAppLink(`Hi%20Thinava%20Rider%20Support%20I%20need%20help%20with%20order%20${orderId}`), '_blank')
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
