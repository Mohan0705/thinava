'use client'

import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AlertCircle, CheckCircle, Clock, Home, MessageCircle, Package, Truck, Star, FileText, X, Phone, MapPin, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { CustomerRouteGuard } from '@/components/auth/CustomerRouteGuard'
import { useAuthStore } from '@/store/authStore'
import { API_BASE_URL } from '@/lib/api'
import { fetchRestaurant } from '@/lib/customer-api'
import { formatPrice } from '@/lib/utils'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import MobileNav from '@/components/layout/MobileNav'
import { Restaurant } from '@/types'
import { SUPPORT_PHONE_DISPLAY, SUPPORT_TEL, getWhatsAppLink } from '@/lib/support'
import { DeliveryLiveMap } from '@/components/delivery/DeliveryLiveMap'
import ReviewModal from '@/components/customer/ReviewModal'
import InvoicePDF from '@/components/customer/InvoicePDF'
import { getRealtimeSocket, releaseRealtimeSocket } from '@/lib/realtime'
import { getOptimizedCloudinaryImageUrl } from '@/lib/cloudinary-image'

type ApiOrderItem = {
  id: string
  menu_item_id: string
  quantity: number
  price: number | string
  name?: string
  image?: string
}

type ApiOrder = {
  id: string
  restaurant_id: string
  restaurant_name?: string
  restaurant_image?: string
  delivery_partner_id?: string | null
  payment_status?: string
  rider_name?: string | null
  rider_phone?: string | null
  rider_profile_image?: string | null
  rider_vehicle_type?: string | null
  rider_vehicle_number?: string | null
  total: number | string
  status: string
  delivery_status?: string
  estimated_total_eta_minutes?: number | null
  route_distance_km?: number | null
  restaurant_latitude?: number | null
  restaurant_longitude?: number | null
  customer_latitude?: number | null
  customer_longitude?: number | null
  rider_latitude?: number | null
  rider_longitude?: number | null
  payment_method: string
  estimated_delivery?: string
  created_at: string
  items?: ApiOrderItem[]
}

type OrderPayload = {
  orders?: ApiOrder[]
  order?: ApiOrder
}

const orderStatuses = [
  { key: 'placed', label: 'Placed', icon: CheckCircle },
  { key: 'accepted', label: 'Confirmed', icon: CheckCircle },
  { key: 'preparing', label: 'Preparing', icon: Package },
  { key: 'ready_for_pickup', label: 'Ready for Pickup', icon: Package },
  { key: 'picked_up', label: 'Picked Up', icon: Truck },
  { key: 'out_for_delivery', label: 'On the Way', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: Home },
]

const terminalStatuses = new Set(['delivered', 'cancelled'])

const normalizeStatus = (status: string) => {
  const normalized = status.toLowerCase()
  if (normalized === 'arriving' || normalized === 'on_the_way') return 'out_for_delivery'
  if (normalized === 'confirmed') return 'accepted'
  return normalized
}

const humanizeStatus = (status: string) => {
  const normalized = normalizeStatus(status)
  if (normalized === 'out_for_delivery') return 'On the Way'
  return normalized
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'success' => {
  const normalized = normalizeStatus(status)
  if (normalized === 'delivered') {
    return 'success'
  }
  if (normalized === 'cancelled') {
    return 'destructive'
  }
  if (
    normalized === 'placed' ||
    normalized === 'accepted' ||
    normalized === 'preparing' ||
    normalized === 'ready_for_pickup' ||
    normalized === 'picked_up' ||
    normalized === 'out_for_delivery'
  ) {
    return 'default'
  }
  return 'secondary'
}

const fetchOrderPayload = async (path: string): Promise<OrderPayload | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { cache: 'no-store' })
    const raw = await response.text()

    if (!raw) {
      return response.ok ? {} : null
    }

    const parsed = JSON.parse(raw) as OrderPayload | { error?: string }

    if (!response.ok) {
      return null
    }

    return parsed as OrderPayload
  } catch {
    return null
  }
}

export default function OrdersPage() {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const [orders, setOrders] = useState<ApiOrder[]>([])
  const [currentOrder, setCurrentOrder] = useState<ApiOrder | null>(null)
  const [restaurantMap, setRestaurantMap] = useState<Record<string, Restaurant>>({})
  const [loading, setLoading] = useState(true)

  // Real-time order rejection modal states
  const [showRejectionPopup, setShowRejectionPopup] = useState(false)
  const [rejectionDetails, setRejectionDetails] = useState({
    title: '',
    message: '',
    reason: '',
    refundMessage: '',
  })

  // Review & Invoice modal states
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<ApiOrder | null>(null)
  const [selectedReviewOrder, setSelectedReviewOrder] = useState<ApiOrder | null>(null)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewedOrders, setReviewedOrders] = useState<Record<string, boolean>>({})

  const currentOrderIdRef = useRef(currentOrder?.id)
  currentOrderIdRef.current = currentOrder?.id

  // Socket.IO realtime order sync
  useEffect(() => {
    if (!token) return

    const socketToken = token || 'guest-token'
    const socket = getRealtimeSocket('customer', socketToken)
    const activeOrderId = currentOrderIdRef.current

    if (activeOrderId) {
      socket.emit('order:join', { orderId: activeOrderId })
    }

    const handleOrderUpdated = (payload: any) => {
      if (payload.order && (!currentOrderIdRef.current || payload.order.id === currentOrderIdRef.current)) {
        const order = payload.order
        setCurrentOrder((prev) => {
          if (!prev) return order
          return {
            ...prev,
            status: order.status || prev.status,
            delivery_status: order.delivery_status || prev.delivery_status,
            rider_name: order.rider_name || prev.rider_name,
            rider_phone: order.rider_phone || prev.rider_phone,
            rider_profile_image: order.rider_profile_image || prev.rider_profile_image,
            rider_vehicle_type: order.rider_vehicle_type || prev.rider_vehicle_type,
            rider_vehicle_number: order.rider_vehicle_number || prev.rider_vehicle_number,
            rider_latitude: order.rider_latitude !== null ? Number(order.rider_latitude) : prev.rider_latitude,
            rider_longitude: order.rider_longitude !== null ? Number(order.rider_longitude) : prev.rider_longitude,
            estimated_total_eta_minutes: order.estimated_total_eta_minutes ?? prev.estimated_total_eta_minutes,
            route_distance_km: order.route_distance_km ?? prev.route_distance_km,
          }
        })
      }
    }

    const handleOrderAssigned = (data: any) => {
      if (data.orderId === currentOrderIdRef.current) {
        setCurrentOrder((prev) => {
          if (!prev) return null
          return {
            ...prev,
            rider_name: data.riderName || prev.rider_name,
            rider_phone: data.riderPhone || prev.rider_phone,
            rider_profile_image: data.riderImage || prev.rider_profile_image,
            rider_vehicle_type: data.riderVehicleType || prev.rider_vehicle_type,
            rider_vehicle_number: data.riderVehicleNumber || prev.rider_vehicle_number,
            status: 'accepted',
          }
        })
      }
    }

    const handleOrderAccepted = (data: any) => {
      if (data.orderId === currentOrderIdRef.current) {
        setCurrentOrder((prev) => (prev ? { ...prev, status: 'accepted' } : null))
      }
    }

    const handleOrderPickedUp = (data: any) => {
      if (data.orderId === currentOrderIdRef.current) {
        setCurrentOrder((prev) => (prev ? { ...prev, status: 'out_for_delivery' } : null))
      }
    }

    const handleOrderDelivered = (data: any) => {
      if (data.orderId === currentOrderIdRef.current) {
        setCurrentOrder((prev) => (prev ? { ...prev, status: 'delivered' } : null))
      }
    }

    const handleOrderRejected = (data: any) => {
      if (data.orderId === currentOrderIdRef.current) {
        setCurrentOrder((prev) => (prev ? { ...prev, status: 'cancelled' } : null))
        setRejectionDetails({
          title: data.title || 'Order Cancelled',
          message: data.message || 'Sorry! Your order was cancelled by the restaurant.',
          reason: data.reason || 'No reason provided',
          refundMessage: data.refundMessage || 'Your payment will be refunded within 2-3 business days.',
        })
        setShowRejectionPopup(true)
      }
    }

    const handleRiderLocationUpdated = (data: any) => {
      if (data.orderId === currentOrderIdRef.current) {
        setCurrentOrder((prev) => {
          if (!prev) return null
          return {
            ...prev,
            rider_latitude: data.latitude !== null && data.latitude !== undefined ? Number(data.latitude) : prev.rider_latitude,
            rider_longitude: data.longitude !== null && data.longitude !== undefined ? Number(data.longitude) : prev.rider_longitude,
            estimated_total_eta_minutes: data.etaMinutes !== undefined ? Number(data.etaMinutes) : prev.estimated_total_eta_minutes,
            route_distance_km: data.distanceKm !== undefined ? Number(data.distanceKm) : prev.route_distance_km,
          }
        })
      }
    }

    const handleDeliveryCompleted = (payload: any) => {
      if (payload.order_id === currentOrderIdRef.current) {
        setCurrentOrder((prev) => (prev ? { ...prev, status: 'delivered' } : null))
      }
    }

    const handleOrderCancelled = (payload: any) => {
      if (payload.order_id === currentOrderIdRef.current) {
        setCurrentOrder((prev) => (prev ? { ...prev, status: 'cancelled' } : null))
        setRejectionDetails({
          title: 'Order Cancelled',
          message: payload.reason || 'Your order was cancelled',
          reason: payload.reason || 'Cancelled by admin',
          refundMessage: payload.payment_status === 'refunded'
            ? 'Your payment has been refunded'
            : 'Your payment will be refunded within 2-3 business days',
        })
        setShowRejectionPopup(true)
      }
    }

    const handleOrderRated = (payload: any) => {
      if (payload.orderId) {
        setReviewedOrders((prev) => ({ ...prev, [payload.orderId]: true }))
      }
    }

    socket.on('customer:order_updated', handleOrderUpdated)
    socket.on('orderAssigned', handleOrderAssigned)
    socket.on('orderAccepted', handleOrderAccepted)
    socket.on('orderPickedUp', handleOrderPickedUp)
    socket.on('orderDelivered', handleOrderDelivered)
    socket.on('orderRejected', handleOrderRejected)
    socket.on('riderLocationUpdated', handleRiderLocationUpdated)
    socket.on('delivery_completed', handleDeliveryCompleted)
    socket.on('order_cancelled', handleOrderCancelled)
    socket.on('orderRated', handleOrderRated)

      return () => {
        if (currentOrderIdRef.current) {
          socket.emit('order:leave', { orderId: currentOrderIdRef.current })
        }
        socket.off('customer:order_updated', handleOrderUpdated)
        socket.off('orderAssigned', handleOrderAssigned)
        socket.off('orderAccepted', handleOrderAccepted)
        socket.off('orderPickedUp', handleOrderPickedUp)
        socket.off('orderDelivered', handleOrderDelivered)
        socket.off('orderRejected', handleOrderRejected)
        socket.off('riderLocationUpdated', handleRiderLocationUpdated)
        socket.off('delivery_completed', handleDeliveryCompleted)
        socket.off('order_cancelled', handleOrderCancelled)
        socket.off('orderRated', handleOrderRated)
        releaseRealtimeSocket('customer', token)
      }
  }, [token])

  useEffect(() => {
    let isMounted = true

    const loadOrders = async (background = false) => {
      const requests: Promise<OrderPayload | null>[] = []

      if (user?.id && token) {
        requests.push(
          fetch(`${API_BASE_URL}/orders/user/${user.id}`, {
            cache: 'no-store',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
            .then(async (response) => {
              const raw = await response.text()
              if (!response.ok || !raw) {
                return null
              }
              return JSON.parse(raw) as OrderPayload
            })
            .catch(() => null)
        )
      }

      if (requests.length === 0) {
        if (isMounted) {
          setOrders([])
          setCurrentOrder(null)
          setRestaurantMap({})
          setLoading(false)
        }
        return
      }

      try {
        const responses = await Promise.all(requests)
        const collectedOrders: ApiOrder[] = []

        for (const response of responses) {
          if (!response) {
            continue
          }

          if (response.orders) {
            collectedOrders.push(...response.orders)
          }
          if (response.order) {
            collectedOrders.push(response.order)
          }
        }

        if (collectedOrders.length === 0) {
          if (isMounted && !background) {
            setLoading(false)
          }
          return
        }

        const uniqueOrders = Array.from(
          new Map(
            collectedOrders
              .filter((order): order is ApiOrder => Boolean(order?.id))
              .map((order) => [order.id, order])
          ).values()
        ).sort(
          (left, right) =>
            new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
        )

        const activeOrder =
          uniqueOrders.find((order) => !terminalStatuses.has(normalizeStatus(order.status))) ||
          null

        const restaurantIds = Array.from(
          new Set(uniqueOrders.map((order) => order.restaurant_id).filter(Boolean))
        )

        const restaurants = await Promise.all(
          restaurantIds.map(async (restaurantId) => {
            try {
              return await fetchRestaurant(restaurantId)
            } catch (error) {
              return null
            }
          })
        )

        const nextRestaurantMap = restaurants.reduce<Record<string, Restaurant>>((accumulator, restaurant) => {
          if (restaurant) {
            accumulator[restaurant.id] = restaurant
          }
          return accumulator
        }, {})

        // Load review eligibility to initialize reviewedOrders
        try {
          const ratingRes = await fetch(`${API_BASE_URL}/ratings/eligibility`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (ratingRes.ok) {
            const ratingData = await ratingRes.json()
            if (ratingData.orders) {
              const reviewed: Record<string, boolean> = {}
              ratingData.orders.forEach((o: any) => {
                if (o.already_rated) {
                  reviewed[o.id] = true
                }
              })
              setReviewedOrders(reviewed)
            }
          }
        } catch { /* silently fail — fall back to local state */ }

        if (isMounted) {
          setOrders(uniqueOrders)
          setCurrentOrder(activeOrder)
          setRestaurantMap(nextRestaurantMap)
        }
      } catch (error) {
        // Keep the last successful state visible if a background refresh fails.
      } finally {
        if (isMounted && !background) {
          setLoading(false)
        }
      }
    }

    loadOrders()

    const intervalId = window.setInterval(() => {
      loadOrders(true)
    }, 10000)

    const handleWindowFocus = () => {
      loadOrders(true)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadOrders(true)
      }
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [token, user?.id])

  const pastOrders = useMemo(() => {
    if (!currentOrder) {
      return orders
    }

    return orders.filter((order) => order.id !== currentOrder.id)
  }, [currentOrder, orders])

  const getRestaurantDetails = (order: ApiOrder) => {
    const restaurant = restaurantMap[order.restaurant_id]

    return {
      name: restaurant?.name || order.restaurant_name || 'Restaurant',
      image: getOptimizedCloudinaryImageUrl(restaurant?.image || order.restaurant_image || '', {
        width: 180,
        height: 180,
        crop: 'fill',
      }),
      cuisines: restaurant?.cuisines || [],
    }
  }

  const currentStatusIndex = currentOrder
    ? Math.max(
        orderStatuses.findIndex((status) => status.key === normalizeStatus(currentOrder.status)),
        0
      )
    : 0
  const currentOrderStatus = currentOrder ? normalizeStatus(currentOrder.status) : ''
  const isCancelled = currentOrderStatus === 'cancelled'
  const isDelivered = currentOrderStatus === 'delivered'

  return (
    <CustomerRouteGuard>
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">Order Tracking</h1>

        {loading ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
                <div className="mt-4 h-4 w-64 animate-pulse rounded bg-gray-200" />
              </CardContent>
            </Card>
          </div>
        ) : null}

        {!loading && currentOrder ? (
          <>
            <Card className="mb-6 relative overflow-hidden border-slate-800 bg-[#000A22] text-white shadow-[0_24px_60px_-36px_rgba(15,23,42,0.7)]">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-red-500" />
              <CardContent className="p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-white sm:text-xl">Order #{currentOrder.id.slice(0, 8).toUpperCase()}</h2>
                    <p className="text-slate-400 text-sm mt-0.5">from <span className="font-bold text-orange-400">{getRestaurantDetails(currentOrder).name}</span></p>
                  </div>
                  <Badge variant={statusVariant(currentOrder.status)} className="font-bold">
                    {humanizeStatus(currentOrder.status)}
                  </Badge>
                </div>

                {!isCancelled &&
                currentOrder.restaurant_latitude &&
                currentOrder.restaurant_longitude &&
                currentOrder.customer_latitude &&
                currentOrder.customer_longitude ? (
                  <div className="mb-5 overflow-hidden rounded-2xl border border-slate-800 shadow-inner">
                    <DeliveryLiveMap
                      rider={
                        currentOrder.rider_latitude && currentOrder.rider_longitude
                          ? {
                              latitude: currentOrder.rider_latitude,
                              longitude: currentOrder.rider_longitude,
                            }
                          : null
                      }
                      restaurant={{
                        latitude: currentOrder.restaurant_latitude,
                        longitude: currentOrder.restaurant_longitude,
                      }}
                      customer={{
                        latitude: currentOrder.customer_latitude,
                        longitude: currentOrder.customer_longitude,
                      }}
                      heightClassName="h-[220px] sm:h-[300px]"
                    />
                  </div>
                ) : null}

                {/* Live Rider Details - Directly displayed when assigned, no search screen */}
                {!isCancelled && currentOrder.rider_name && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-5 flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-white shadow-xl backdrop-blur-xl md:flex-row"
                  >
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="relative h-16 w-16 rounded-full border-2 border-orange-500 overflow-hidden bg-slate-850 flex-shrink-0 flex items-center justify-center">
                        {currentOrder.rider_profile_image ? (
                          <Image
                            src={getOptimizedCloudinaryImageUrl(currentOrder.rider_profile_image, {
                              width: 160,
                              height: 160,
                              crop: 'fill',
                            })}
                            alt={currentOrder.rider_name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full w-full bg-slate-800 text-orange-400 font-bold text-xl">
                            {currentOrder.rider_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-lg text-white">{currentOrder.rider_name}</h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-slate-400">
                          <span className="bg-orange-500/20 text-orange-400 font-bold px-2 py-0.5 rounded-full text-xs">
                            {currentOrder.rider_vehicle_type || 'Delivery Partner'}
                          </span>
                          {currentOrder.rider_vehicle_number && (
                            <span className="font-mono text-xs border border-slate-700 px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                              {currentOrder.rider_vehicle_number}
                            </span>
                          )}
                        </div>
                        {currentOrder.rider_phone && (
                          <a
                            href={`tel:${currentOrder.rider_phone}`}
                            className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {currentOrder.rider_phone}
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex w-full items-center justify-around gap-5 border-t border-slate-800 pt-4 md:w-auto md:justify-end md:border-t-0 md:pt-0">
                      <div className="text-center md:text-right">
                        <p className="text-xs text-slate-400 font-medium">Estimated Arrival</p>
                        <p className="text-lg font-black text-orange-400 flex items-center gap-1 mt-0.5 justify-center md:justify-end">
                          <Clock className="w-4 h-4 animate-pulse text-orange-500" />
                          {currentOrder.estimated_total_eta_minutes
                            ? `${currentOrder.estimated_total_eta_minutes} mins`
                            : 'Calculating...'}
                        </p>
                      </div>
                      <div className="w-px h-10 bg-slate-800 hidden md:block" />
                      <div className="text-center md:text-right">
                        <p className="text-xs text-slate-400 font-medium">Distance Remaining</p>
                        <p className="text-lg font-black text-orange-400 flex items-center gap-1 mt-0.5 justify-center md:justify-end">
                          <MapPin className="w-4 h-4 text-orange-500" />
                          {currentOrder.route_distance_km
                            ? `${Number(currentOrder.route_distance_km).toFixed(1)} km`
                            : 'Calculating...'}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {isCancelled ? (
                  <div className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                      <div>
                        <p className="font-semibold text-white">This order was rejected by the restaurant.</p>
                        <p className="mt-1 text-sm text-slate-300">
                          You were not charged for this order. Please try another item or restaurant.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative mb-6 px-1 md:px-3">
                    <div className="absolute left-4 right-4 top-4 h-1 rounded bg-slate-800">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(currentStatusIndex / (orderStatuses.length - 1)) * 100}%` }}
                        transition={{ duration: 0.5 }}
                        className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded"
                      />
                    </div>
                    <div className="relative flex justify-between">
                      {orderStatuses.map((status, index) => {
                        const Icon = status.icon
                        const isActive = index <= currentStatusIndex
                        const isCurrent = index === currentStatusIndex

                        return (
                          <motion.div
                            key={status.key}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.08 }}
                            className="flex min-w-0 flex-1 flex-col items-center"
                          >
                            <div
                              className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                                isActive
                                  ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/20'
                                  : 'bg-slate-800 text-slate-500'
                              } ${isCurrent ? 'scale-110 ring-4 ring-orange-500/30' : ''}`}
                            >
                              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                            </div>
                            <span
                              className={`mt-2 max-w-[5.75rem] text-center text-[9px] font-semibold leading-tight md:text-xs ${
                                isActive ? 'text-orange-400 font-bold' : 'text-slate-500'
                              }`}
                            >
                              {status.label}
                            </span>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="h-16 w-16 overflow-hidden rounded-xl bg-slate-800 flex-shrink-0 relative">
                      {getRestaurantDetails(currentOrder).image ? (
                        <Image
                          src={getRestaurantDetails(currentOrder).image}
                          alt={getRestaurantDetails(currentOrder).name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-orange-400">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="font-bold text-lg text-white">{getRestaurantDetails(currentOrder).name}</h3>
                      <p className="text-sm text-slate-400">
                        {getRestaurantDetails(currentOrder).cuisines.join(', ') || humanizeStatus(currentOrder.status)}
                      </p>
                      {!isCancelled && !isDelivered && currentOrder.estimated_delivery && (
                        <p className="mt-1.5 text-xs font-bold text-orange-400">
                          Your order is on the way - {currentOrder.estimated_total_eta_minutes
                            ? `${currentOrder.estimated_total_eta_minutes} mins left`
                            : currentOrder.estimated_delivery}
                        </p>
                      )}
                    </div>
                    <Link href={`/restaurant/${currentOrder.restaurant_id}`} className="w-full sm:w-auto">
                      <Button variant="outline" className="w-full border-white bg-white text-slate-950 shadow-sm hover:bg-orange-50 hover:text-slate-950">
                        View Menu
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-8 border-slate-800 bg-[#000A22] text-white">
              <CardContent className="p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-bold text-white">Need Help?</h3>
                  <p className="hidden text-xs font-medium text-slate-400 sm:block">
                    {SUPPORT_PHONE_DISPLAY}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    size="sm"
                    className="h-10 justify-center bg-white text-slate-950 font-bold shadow-sm hover:bg-orange-50"
                    onClick={() => {
                      window.location.href = SUPPORT_TEL
                    }}
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    Call Support
                  </Button>
                  <Button
                    size="sm"
                    className="h-10 justify-center bg-[#16A34A] text-white font-bold shadow-sm hover:bg-[#15803D]"
                    onClick={() => {
                      const orderId = currentOrder?.id ? currentOrder.id.slice(0, 8).toUpperCase() : ''
                      window.open(getWhatsAppLink(`Hi%20Thinava%20Support%20I%20need%20help%20with%20order%20${orderId}`), '_blank')
                    }}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    WhatsApp Support
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}

        {/* Real-time Order Rejection Glassmorphic Modal */}
        {showRejectionPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-[#000A22] rounded-3xl overflow-hidden shadow-2xl border border-rose-500/30 p-8 text-center text-white"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-orange-500 to-rose-600" />
              
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/10 border-2 border-rose-500/30 text-rose-500">
                <AlertCircle className="w-10 h-10" />
              </div>
              
              <h3 className="text-2xl font-black bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-transparent mb-2">
                {rejectionDetails.title || 'Order Cancelled'}
              </h3>
              
              <p className="text-lg font-bold text-slate-100 mb-2">
                {rejectionDetails.message || 'Sorry! Your order was cancelled by the restaurant.'}
              </p>

              {rejectionDetails.reason && (
                <p className="text-sm italic text-slate-400 mb-4 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800">
                  Reason: {rejectionDetails.reason}
                </p>
              )}
              
              <p className="text-sm font-semibold text-orange-400/90 mb-8 px-2 py-1.5 rounded bg-orange-500/10 border border-orange-500/20">
                {rejectionDetails.refundMessage || 'Your payment will be fully refunded to your source account.'}
              </p>

              <div className="flex flex-col gap-3">
                <Link href={`/restaurant/${currentOrder?.restaurant_id || ''}`} className="w-full">
                  <Button 
                    className="w-full bg-gradient-to-r from-orange-500 to-red-650 hover:from-orange-650 hover:to-red-750 font-bold border-0 h-12 shadow-lg shadow-orange-500/20 rounded-xl text-white"
                    onClick={() => setShowRejectionPopup(false)}
                  >
                    Retry Ordering / View Menu
                  </Button>
                </Link>
                
                <Link href="/" className="w-full">
                  <Button 
                    variant="outline" 
                    className="w-full border-slate-800 bg-transparent text-slate-355 hover:bg-slate-850 hover:text-white font-bold h-12 rounded-xl"
                    onClick={() => setShowRejectionPopup(false)}
                  >
                    Go Back Home
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        )}

        {!loading && !currentOrder ? (
          <Card className="mb-8">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900">No active orders</h2>
              <p className="mt-2 text-gray-600">
                {orders.length > 0
                  ? 'Your completed and cancelled orders are listed below in order history.'
                  : 'Place an order and it will appear here with live status updates.'}
              </p>
              <Link href="/" className="mt-6 inline-flex">
                <Button>Browse Restaurants</Button>
              </Link>
            </CardContent>
          </Card>
        ) : null}

        <h2 className="mb-6 text-2xl font-bold text-gray-900">Past Orders</h2>
        <div className="space-y-4">
          {pastOrders.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-gray-600">
                No previous orders found yet.
              </CardContent>
            </Card>
          ) : (
            pastOrders.map((order) => {
              const restaurant = getRestaurantDetails(order)
              const statusNormalized = normalizeStatus(order.status)
              
              return (
                <div key={order.id}>
                  <Card className="border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-4">
                          <div className="h-16 w-16 overflow-hidden rounded-xl bg-slate-100 flex-shrink-0 ring-1 ring-slate-200/50">
                            {restaurant.image ? (
                              <Image
                                src={restaurant.image}
                                alt={restaurant.name}
                                width={64}
                                height={64}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-orange-50 text-orange-500">
                                <ImageIcon className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">{restaurant.name}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Ordered on {new Date(order.created_at).toLocaleDateString('en-IN')} at {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs font-semibold text-slate-400 mt-1">
                              ID: #{order.id.slice(0, 8).toUpperCase()}
                            </p>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2">
                          <p className="font-black text-lg text-slate-900 dark:text-white">{formatPrice(Number(order.total))}</p>
                          <Badge variant={statusVariant(order.status)}>
                            {humanizeStatus(order.status)}
                          </Badge>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2.5">
                        <Button
                          size="sm"
                          className="inline-flex items-center gap-1.5 rounded-full border-0 bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-md shadow-slate-900/15 hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/20 active:scale-95 transition-all"
                          onClick={() => setSelectedInvoiceOrder(order)}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          View Invoice
                        </Button>

                        {statusNormalized === 'delivered' && (
                          reviewedOrders[order.id] ? (
                            <Button
                              size="sm"
                              disabled
                              className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-4 py-2 text-xs font-bold text-green-700 cursor-not-allowed"
                            >
                              <Star className="w-3.5 h-3.5 fill-green-500 text-green-500" />
                              Already Reviewed
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="inline-flex items-center gap-1.5 rounded-full border-0 bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 hover:from-orange-600 hover:to-red-600 active:scale-95 transition-all"
                              onClick={() => {
                                setSelectedReviewOrder(order)
                                setReviewModalOpen(true)
                              }}
                            >
                              <Star className="w-3.5 h-3.5 fill-white/90" />
                              Rate Order
                            </Button>
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )
            })
          )}
        </div>

        {/* Invoice Modal Overlay */}
        {selectedInvoiceOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm select-none">
            <div className="fixed inset-0" onClick={() => setSelectedInvoiceOrder(null)} />
            <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl z-10 border border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedInvoiceOrder(null)}
                className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 z-20 print:hidden"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="max-h-[85vh] overflow-y-auto p-2">
                <InvoicePDF
                  invoice={{
                    id: selectedInvoiceOrder.id,
                    restaurantName: getRestaurantDetails(selectedInvoiceOrder).name,
                    restaurantAddress: 'Tadepalligudem Kitchen Partner',
                    customerName: user?.fullName || user?.name || 'Customer',
                    customerPhone: user?.phone || '',
                    deliveryAddress: 'Tadepalligudem Delivery Address',
                    paymentMethod: selectedInvoiceOrder.payment_method,
                    paymentStatus: selectedInvoiceOrder.payment_status || 'pending',
                    createdAt: selectedInvoiceOrder.created_at,
                    subtotal: Number(selectedInvoiceOrder.total) - 40,
                    deliveryFee: 25,
                    tax: 15,
                    discount: 0,
                    total: Number(selectedInvoiceOrder.total),
                    items: selectedInvoiceOrder.items || []
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Review Modal */}
        {selectedReviewOrder && (
          <ReviewModal
            isOpen={reviewModalOpen}
            onClose={() => {
              setReviewModalOpen(false)
              setSelectedReviewOrder(null)
            }}
            orderId={selectedReviewOrder.id}
            restaurantId={selectedReviewOrder.restaurant_id}
            restaurantName={getRestaurantDetails(selectedReviewOrder).name}
            riderId={selectedReviewOrder.delivery_partner_id || undefined}
            riderName={selectedReviewOrder.rider_name || undefined}
            onSuccess={() => setReviewedOrders((prev) => ({ ...prev, [selectedReviewOrder.id]: true }))}
          />
        )}
      </div>

      <Footer />
      <MobileNav />
      </div>
    </CustomerRouteGuard>
  )
}
