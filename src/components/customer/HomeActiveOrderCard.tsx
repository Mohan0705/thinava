'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Clock3, Navigation, Sparkles, Truck } from 'lucide-react'
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

  if (status === 'delivered' || deliveryStatus === 'delivered') {
    return 4
  }

  if (deliveryStatus === 'reached_customer') {
    return 3
  }

  if (deliveryStatus === 'picked_up' || status === 'out_for_delivery') {
    return 2
  }

  if (status === 'preparing' || status === 'ready_for_pickup') {
    return 1
  }

  return 0
}

const progressStages = ['Order placed', 'Preparing', 'Picked up', 'Near you', 'Delivered']

const playChime = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)

    oscillator.type = 'sine'
    const now = audioCtx.currentTime
    oscillator.frequency.setValueAtTime(659.25, now) // E5
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3)

    oscillator.frequency.setValueAtTime(783.99, now + 0.15) // G5
    gainNode.gain.setValueAtTime(0, now + 0.15)
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.2)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5)

    oscillator.start(now)
    oscillator.stop(now + 0.6)
  } catch (error) {
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

        if (!mounted) {
          return
        }

        const currentOrder =
          (response.orders || []).find((order) => !terminalStatuses.has(normalize(order.status))) || null
        setActiveOrder(currentOrder)
      } catch {
        if (mounted) {
          setActiveOrder(null)
        }
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
          
          if (terminalStatuses.has(normalize(realtimeOrder.status))) {
            return null
          }
          
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
      if (document.visibilityState === 'visible') {
        void loadOrders()
      }
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

  if (!hydrated || !token || !activeOrder) {
    return null
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="container mx-auto px-4 py-8"
    >
      <div className="overflow-hidden rounded-[32px] border border-orange-100 bg-[linear-gradient(135deg,#111827_0%,#1f2937_42%,#f97316_160%)] p-6 text-white shadow-[0_35px_90px_-45px_rgba(249,115,22,0.55)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-100">
              <Sparkles className="h-3.5 w-3.5" />
              Active order
            </div>
            <h2 className="mt-4 text-2xl font-bold">{activeOrder.restaurant_name || 'Your live order'}</h2>
            <p className="mt-2 text-sm text-white/70">
              Rider: {activeOrder.rider_name || 'Assigning delivery partner'}
            </p>
          </div>

          <Link
            href="/orders"
            className="inline-flex items-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-50"
          >
            Live tracking
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              <Clock3 className="h-4 w-4 text-orange-200" />
              ETA
            </div>
            <p className="mt-3 text-3xl font-bold">{activeOrder.estimated_total_eta_minutes || '--'} min</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              <Truck className="h-4 w-4 text-emerald-200" />
              Order status
            </div>
            <p className="mt-3 text-lg font-bold">{String(activeOrder.status || 'Placed').replace(/_/g, ' ')}</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              <Navigation className="h-4 w-4 text-sky-200" />
              Delivery flow
            </div>
            <p className="mt-3 text-lg font-bold">{progressStages[currentStage]}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          {progressStages.map((stage, index) => (
            <div key={stage} className="space-y-2">
              <div className={`h-2 rounded-full ${index <= currentStage ? 'bg-white' : 'bg-white/20'}`} />
              <p className={`text-xs font-medium ${index <= currentStage ? 'text-white' : 'text-white/45'}`}>
                {stage}
              </p>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}
