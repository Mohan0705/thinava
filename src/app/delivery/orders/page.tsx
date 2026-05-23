'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, BellRing, Clock3, Loader, MapPinned, Navigation, RadioTower, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { DeliveryBottomNav } from '@/components/delivery/DeliveryBottomNav'
import { DeliveryLiveMap } from '@/components/delivery/DeliveryLiveMap'
import { deliveryApi } from '@/lib/delivery-api'
import { getRealtimeSocket } from '@/lib/realtime'
import { useDeliveryAuthStore } from '@/store/deliveryAuthStore'
import { useDeliveryOrderStore } from '@/store/deliveryOrderStore'

const formatCurrency = (value: number | undefined) => `Rs. ${Number(value || 0).toFixed(0)}`

export default function DeliveryOrdersPage() {
  const router = useRouter()
  const token = useDeliveryAuthStore((state) => state.token)
  const activeOrder = useDeliveryOrderStore((state) => state.activeOrder)
  const setActiveOrder = useDeliveryOrderStore((state) => state.setActiveOrder)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null)

  const loadAssignedOrder = async (background = false) => {
    if (!token) {
      return
    }

    try {
      const result = await deliveryApi.getActiveOrder(token)
      setActiveOrder(result.order)
    } catch (error) {
      if (!background) {
        toast.error(error instanceof Error ? error.message : 'Failed to load assigned order')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!token) {
      router.push('/delivery/login')
      return
    }

    void loadAssignedOrder()
  }, [router, token])

  useEffect(() => {
    if (!token) {
      return
    }

    const socket = getRealtimeSocket('delivery_partner', token)
    const handleAssignedOrder = () => {
      void loadAssignedOrder(true)
    }

    socket.on('delivery:active_order_updated', handleAssignedOrder)
    socket.on('delivery:offer_removed', handleAssignedOrder)

    return () => {
      socket.off('delivery:active_order_updated', handleAssignedOrder)
      socket.off('delivery:offer_removed', handleAssignedOrder)
    }
  }, [token])

  useEffect(() => {
    if (!navigator.geolocation) {
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }
        setCurrentLocation(nextLocation)

        if (token) {
          void deliveryApi.updateLocation(
            token,
            activeOrder?.id || null,
            nextLocation.latitude,
            nextLocation.longitude,
            position.coords.accuracy
          )
        }
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 12000 }
    )
  }, [activeOrder?.id, token])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadAssignedOrder()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#000A22] text-white">
        <Loader className="h-12 w-12 animate-spin text-orange-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#000A22_0%,#081b39_30%,#f8fafc_30%,#f8fafc_100%)] pb-28">
      <div className="px-4 pb-6 pt-4 md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-center justify-between text-white">
            <button
              type="button"
              onClick={() => router.push('/delivery/dashboard')}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 backdrop-blur"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-orange-200">Smart dispatch</p>
              <h1 className="text-2xl font-bold">Live offers</h1>
            </div>

            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
              className="border-white/15 bg-white/10 text-white hover:bg-white/15"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          </div>

          {activeOrder ? (
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="overflow-hidden border-0 bg-slate-950 text-white shadow-[0_35px_100px_-55px_rgba(0,10,34,0.95)]">
                <CardContent className="p-4 md:p-5">
                  <DeliveryLiveMap
                    rider={currentLocation}
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

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Earning</p>
                      <p className="mt-2 text-3xl font-bold">{formatCurrency(activeOrder.estimated_earnings)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Distance</p>
                      <p className="mt-2 text-3xl font-bold">{Number(activeOrder.dropoff_distance_km || activeOrder.route_distance_km || 0).toFixed(1)} km</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">ETA</p>
                      <p className="mt-2 text-3xl font-bold">{activeOrder.estimated_total_eta_minutes || '--'} min</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 bg-white shadow-[0_30px_90px_-65px_rgba(0,10,34,0.55)]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-600">Auto-assigned live</p>
                      <h2 className="mt-2 text-2xl font-bold text-slate-950">{activeOrder.restaurant_name}</h2>
                    </div>
                    <span className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                      {activeOrder.assignment_status || 'ASSIGNED'}
                    </span>
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-start gap-3">
                        <MapPinned className="mt-1 h-5 w-5 text-orange-600" />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Pickup</p>
                          <p className="mt-1 font-semibold text-slate-950">{activeOrder.restaurant_name}</p>
                          <p className="mt-1 text-sm text-slate-500">{activeOrder.restaurant_address}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-start gap-3">
                        <Navigation className="mt-1 h-5 w-5 text-sky-600" />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Drop</p>
                          <p className="mt-1 font-semibold text-slate-950">{activeOrder.customer_name}</p>
                          <p className="mt-1 text-sm text-slate-500">{activeOrder.customer_address}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    className="mt-6 w-full bg-gradient-to-r from-orange-500 to-orange-600 py-6 text-base"
                    onClick={() => router.push('/delivery/active-order')}
                  >
                    Continue delivery task
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="overflow-hidden border-0 bg-slate-950 text-white shadow-[0_35px_100px_-55px_rgba(0,10,34,0.95)]">
                <CardContent className="p-6 md:p-8">
                  <div className="flex min-h-[58vh] flex-col items-center justify-center text-center">
                    <div className="relative">
                      <div className="absolute inset-0 animate-ping rounded-full bg-orange-500/20" />
                      <div className="relative rounded-full border border-orange-300/20 bg-orange-500/10 p-5 text-orange-200">
                        <RadioTower className="h-12 w-12" />
                      </div>
                    </div>
                    <h2 className="mt-7 text-3xl font-bold">Waiting for smart dispatch</h2>
                    <p className="mt-3 max-w-md text-sm text-white/60">
                      Stay online with GPS enabled. Thinava will auto-assign the best nearby order and trigger a full-screen popup instantly.
                    </p>
                    <div className="mt-7 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <BellRing className="mx-auto h-5 w-5 text-orange-200" />
                        <p className="mt-2 text-sm font-semibold">Popup alert</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <MapPinned className="mx-auto h-5 w-5 text-sky-200" />
                        <p className="mt-2 text-sm font-semibold">GPS route</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <Clock3 className="mx-auto h-5 w-5 text-emerald-200" />
                        <p className="mt-2 text-sm font-semibold">Live ETA</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      <DeliveryBottomNav />
    </div>
  )
}
