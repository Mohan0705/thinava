'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Clock3, Navigation, Truck } from 'lucide-react'
import { apiRequest } from '@/lib/api'
import { getRealtimeSocket, releaseRealtimeSocket } from '@/lib/realtime'
import { useAuthStore } from '@/store/authStore'
import type { DeliveryRealtimeEvent } from '@/types/delivery'

type ActiveCustomerOrder = {
  id: string
  restaurant_name?: string
  rider_name?: string | null
  status: string
  delivery_status?: string | null
  estimated_total_eta_minutes?: number | null
}

const terminalStatuses = new Set(['delivered', 'cancelled'])

const normalize = (value: string | null | undefined) => String(value || '').trim().toLowerCase()

const stageIndexForOrder = (order: ActiveCustomerOrder) => {
  const status = normalize(order.status)
  const deliveryStatus = normalize(order.delivery_status)

  if (status === 'delivered' || deliveryStatus === 'delivered') return 4
  if (deliveryStatus === 'reached_customer') return 3
  if (deliveryStatus === 'picked_up' || status === 'out_for_delivery') return 2
  if (status === 'preparing' || status === 'ready_for_pickup') return 1
  return 0
}

const progressStages = ['Placed', 'Preparing', 'Picked up', 'Near you', 'Delivered']

const playChime = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    oscillator.type = 'sine'
    const now = audioCtx.currentTime
    oscillator.frequency.setValueAtTime(659.25, now)
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
    oscillator.start(now)
    oscillator.stop(now + 0.6)
  } catch {
    // Ignore audio context autoplay blocks
  }
}

const showNotification = (title: string, body: string) => {
  if (!('Notification' in window)) return
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/logo.png' })
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification(title, { body, icon: '/logo.png' })
      }
    })
  }
}

export function HomeActiveOrderCard() {
  const hydrated = useAuthStore((state) => state.hydrated)
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const [activeOrder, setActiveOrder] = useState<ActiveCustomerOrder | null>(null)

  useEffect(() => {
    if (!hydrated || !token || !user?.id) {
      setActiveOrder(null)
      return
    }

    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }

    let mounted = true

    const loadOrders = async () => {
      try {
        const response = await apiRequest<{ orders?: ActiveCustomerOrder[] }>(`/orders/user/${user.id}`, {
          token,
        })

        if (!mounted) return

        const currentOrder =
          (response.orders || []).find((order) => !terminalStatuses.has(normalize(order.status))) || null
        setActiveOrder(currentOrder)
      } catch {
        if (mounted) setActiveOrder(null)
      }
    }

    void loadOrders()

    const socket = getRealtimeSocket('customer', token)
    const refreshFromRealtime = (event?: DeliveryRealtimeEvent) => {
      if (mounted && event?.order) {
        const realtimeOrder = event.order

        setActiveOrder((prev) => {
          if (prev && normalize(prev.status) !== normalize(realtimeOrder.status)) {
            playChime()
            showNotification(
              `Thinava — ${realtimeOrder.restaurant_name || 'Order Update'}`,
              `Your order is now: ${String(realtimeOrder.status).replace(/_/g, ' ').toUpperCase()}`
            )
          }

          if (terminalStatuses.has(normalize(realtimeOrder.status))) return null

          return {
            id: realtimeOrder.id,
            restaurant_name: realtimeOrder.restaurant_name,
            rider_name: realtimeOrder.rider_name,
            status: realtimeOrder.status,
            delivery_status: realtimeOrder.delivery_status,
            estimated_total_eta_minutes: realtimeOrder.estimated_total_eta_minutes,
          }
        })
      } else {
        void loadOrders()
      }
    }

    socket.on('customer:order_updated', refreshFromRealtime)
    socket.on('delivery:location_updated', refreshFromRealtime)

    const fallbackIntervalId = window.setInterval(() => {
      void loadOrders()
    }, 60000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void loadOrders()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mounted = false
      window.clearInterval(fallbackIntervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      socket.off('customer:order_updated', refreshFromRealtime)
      socket.off('delivery:location_updated', refreshFromRealtime)
      releaseRealtimeSocket('customer', token)
    }
  }, [hydrated, token, user?.id])

  const currentStage = useMemo(() => (activeOrder ? stageIndexForOrder(activeOrder) : 0), [activeOrder])

  if (!hydrated || !token || !activeOrder) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="container mx-auto px-4 pt-4 md:pt-6"
    >
      <div className="overflow-hidden rounded-2xl border border-thinava-border bg-thinava-text p-5 text-white shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-thinava-primary">
              Active order
            </p>
            <h2 className="mt-1 text-lg font-bold">{activeOrder.restaurant_name || 'Your order'}</h2>
            <p className="mt-1 text-sm text-gray-400">
              Rider: {activeOrder.rider_name || 'Assigning partner'}
            </p>
          </div>
          <Link
            href="/orders"
            className="inline-flex rounded-xl bg-thinava-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-105"
          >
            Track order
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white/10 p-3">
            <Clock3 className="h-4 w-4 text-thinava-primary" />
            <p className="mt-2 text-xl font-bold">{activeOrder.estimated_total_eta_minutes || '--'}</p>
            <p className="text-[11px] text-gray-400">min ETA</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <Truck className="h-4 w-4 text-thinava-success" />
            <p className="mt-2 text-sm font-bold capitalize">
              {String(activeOrder.status || 'placed').replace(/_/g, ' ')}
            </p>
            <p className="text-[11px] text-gray-400">Status</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <Navigation className="h-4 w-4 text-blue-300" />
            <p className="mt-2 text-sm font-bold">{progressStages[currentStage]}</p>
            <p className="text-[11px] text-gray-400">Stage</p>
          </div>
        </div>

        <div className="mt-4 flex gap-1">
          {progressStages.map((stage, index) => (
            <div key={stage} className="flex-1">
              <div
                className={`h-1 rounded-full ${index <= currentStage ? 'bg-thinava-primary' : 'bg-white/20'}`}
              />
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}
