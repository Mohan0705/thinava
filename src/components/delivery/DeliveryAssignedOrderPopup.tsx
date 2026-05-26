'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock3, Loader, MapPin, Navigation, Siren, Sparkles, Wallet, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { DeliveryLiveMap } from '@/components/delivery/DeliveryLiveMap'
import { deliveryApi } from '@/lib/delivery-api'
import { getRealtimeSocket, releaseRealtimeSocket } from '@/lib/realtime'
import { useDeliveryAuthStore } from '@/store/deliveryAuthStore'
import { useDeliveryOrderStore } from '@/store/deliveryOrderStore'

const formatCurrency = (value: number | undefined) => `Rs. ${Number(value || 0).toFixed(0)}`
const OFFER_TIMEOUT_SECONDS = 60

export function DeliveryAssignedOrderPopup() {
  const router = useRouter()
  const pathname = usePathname()
  const token = useDeliveryAuthStore((state) => state.token)
  const assignmentRequest = useDeliveryOrderStore((state) => state.assignmentRequest)
  const setActiveOrder = useDeliveryOrderStore((state) => state.setActiveOrder)
  const setAssignmentRequest = useDeliveryOrderStore((state) => state.setAssignmentRequest)

  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(OFFER_TIMEOUT_SECONDS)
  const autoRejectTriggeredRef = useRef(false)
  const lastLocationRenderRef = useRef<{ latitude: number; longitude: number; renderedAt: number } | null>(null)
  const shouldShow =
    Boolean(token) &&
    Boolean(assignmentRequest) &&
    (assignmentRequest?.delivery_status === 'READY_FOR_ASSIGNMENT' ||
      assignmentRequest?.assignment_status === 'REQUESTED' ||
      assignmentRequest?.assignment_status === 'ASSIGNED') &&
    !['/delivery/login', '/delivery/register', '/delivery/active-order'].includes(pathname || '')

  const loadAssignmentRequest = async () => {
    if (!token) {
      return
    }

    try {
      const result = await deliveryApi.getAssignmentRequest(token)
      setAssignmentRequest(result.order)
    } catch {
      setAssignmentRequest(null)
    }
  }

  useEffect(() => {
    if (!token) {
      return
    }

    void loadAssignmentRequest()

    const socket = getRealtimeSocket('delivery_partner', token)
    if (!socket) {
      return
    }

    const handleAssignedOrder = () => {
      void loadAssignmentRequest()
    }

    socket.on('delivery:assignment_request', handleAssignedOrder)
    socket.on('RIDER_ASSIGNMENT_REQUEST', handleAssignedOrder)
    socket.on('delivery:offer_removed', handleAssignedOrder)

    return () => {
      socket.off('delivery:assignment_request', handleAssignedOrder)
      socket.off('RIDER_ASSIGNMENT_REQUEST', handleAssignedOrder)
      socket.off('delivery:offer_removed', handleAssignedOrder)
      releaseRealtimeSocket('delivery_partner', token)
    }
  }, [token])

  useEffect(() => {
    if (!shouldShow || !assignmentRequest?.id || !navigator.geolocation) {
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }
        lastLocationRenderRef.current = { ...nextLocation, renderedAt: Date.now() }
        setCurrentLocation(nextLocation)
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 12000 }
    )
  }, [assignmentRequest?.id, shouldShow])

  useEffect(() => {
    if (!shouldShow || !assignmentRequest) {
      return
    }

    autoRejectTriggeredRef.current = false
    setSecondsLeft(OFFER_TIMEOUT_SECONDS)

    try {
      const AudioConstructor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioConstructor) {
        return
      }
      const audioContext = new AudioConstructor()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime)
      gainNode.gain.setValueAtTime(0.001, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.14, audioContext.currentTime + 0.03)
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.45)
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.46)
    } catch {}
  }, [assignmentRequest?.id, shouldShow])

  useEffect(() => {
    if (!shouldShow || !assignmentRequest) {
      return
    }

    const expiresAt = assignmentRequest.assignment_expires_at
      ? Math.max(0, Math.ceil((new Date(assignmentRequest.assignment_expires_at).getTime() - Date.now()) / 1000))
      : OFFER_TIMEOUT_SECONDS
    setSecondsLeft(Math.min(OFFER_TIMEOUT_SECONDS, expiresAt || OFFER_TIMEOUT_SECONDS))

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1 && !autoRejectTriggeredRef.current) {
          autoRejectTriggeredRef.current = true
          window.clearInterval(timer)
          void handleReject(true)
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [assignmentRequest?.id, assignmentRequest?.assignment_expires_at, shouldShow])

  const handleAccept = async () => {
    if (!token || !assignmentRequest) {
      return
    }

    setAccepting(true)
    try {
      const result = await deliveryApi.confirmAssignedOrder(token, assignmentRequest.id)
      setActiveOrder(result.order)
      setAssignmentRequest(null)
      toast.success('Order accepted. Head to pickup.')
      router.push('/delivery/active-order')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to accept assigned order')
    } finally {
      setAccepting(false)
    }
  }

  const countdownPercent = useMemo(
    () => Math.max(0, Math.min(100, (secondsLeft / OFFER_TIMEOUT_SECONDS) * 100)),
    [secondsLeft]
  )

  const handleReject = async (silent = false) => {
    if (!token || !assignmentRequest) {
      return
    }

    setRejecting(true)
    try {
      await deliveryApi.rejectOrder(token, assignmentRequest.id)
      setAssignmentRequest(null)
      if (!silent) {
        toast.info('Order rejected and returned to dispatch.')
      }
    } catch (error) {
      if (!silent) {
        toast.error(error instanceof Error ? error.message : 'Failed to reject assigned order')
      }
    } finally {
      setRejecting(false)
    }
  }

  return (
    <AnimatePresence>
      {shouldShow && assignmentRequest ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-white text-slate-950"
        >
          <div className="relative h-full overflow-hidden">
            <DeliveryLiveMap
              rider={currentLocation}
              restaurant={
                assignmentRequest.restaurant_latitude && assignmentRequest.restaurant_longitude
                  ? {
                      latitude: assignmentRequest.restaurant_latitude,
                      longitude: assignmentRequest.restaurant_longitude,
                    }
                  : null
              }
              customer={
                assignmentRequest.customer_latitude && assignmentRequest.customer_longitude
                  ? {
                      latitude: assignmentRequest.customer_latitude,
                      longitude: assignmentRequest.customer_longitude,
                    }
                  : null
              }
              heightClassName="h-[58vh] rounded-none border-0"
            />

            <button
              type="button"
              onClick={() => handleReject(false)}
              disabled={rejecting}
              className="absolute left-5 top-6 inline-flex items-center gap-2 rounded-full border border-red-300/25 bg-red-500/15 px-4 py-2.5 text-sm font-bold text-red-100 shadow-xl backdrop-blur"
            >
              {rejecting ? <Loader className="h-5 w-5 animate-spin" /> : <X className="h-5 w-5" />}
              Reject
            </button>

            <div className="absolute right-5 top-6 rounded-[24px] border border-white/15 bg-[#000a22]/72 px-4 py-3 text-white shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-orange-500/20 p-2 text-orange-200">
                  <Clock3 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">Auto expire</p>
                  <p className="text-xl font-black">{secondsLeft}s</p>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500" style={{ width: `${countdownPercent}%` }} />
              </div>
            </div>

            <div className="pointer-events-none absolute inset-x-5 top-24 flex items-center justify-between gap-3">
              <div className="rounded-full border border-white/15 bg-[#000a22]/72 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-xl backdrop-blur-xl">
                {assignmentRequest.payment_type || 'PREPAID'}
              </div>
              <div className="rounded-full border border-orange-300/20 bg-orange-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-orange-100 shadow-xl backdrop-blur-xl">
                {assignmentRequest.night_badge ? 'Night surge' : 'Smart dispatch'}
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 rounded-t-[38px] border-t border-white/10 bg-[linear-gradient(180deg,rgba(0,10,34,0.72)_0%,rgba(0,10,34,0.95)_14%,rgba(0,10,34,0.98)_100%)] px-6 pb-6 pt-8 text-white shadow-[0_-24px_70px_-40px_rgba(15,23,42,0.85)] backdrop-blur-2xl">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-100">
                  <Siren className="h-3.5 w-3.5" />
                  New assigned order
                </div>
                <p className="mt-4 text-sm font-bold uppercase tracking-[0.28em] text-white/45">Estimated earning</p>
                <p className="mt-2 text-6xl font-black tracking-tight text-white">
                  {formatCurrency(assignmentRequest.estimated_earnings)}
                </p>
                <div className="mt-3 flex items-center justify-center gap-3 text-lg font-semibold text-white/65">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-5 w-5" />
                    {assignmentRequest.estimated_total_eta_minutes || '--'} mins
                  </span>
                  <span>|</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Navigation className="h-5 w-5" />
                    {Number(assignmentRequest.dropoff_distance_km || assignmentRequest.route_distance_km || 0).toFixed(2)} kms
                  </span>
                </div>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[28px] border border-white/10 bg-white/5 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-orange-500/15 p-2 text-orange-100">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Pickup</p>
                      <p className="mt-1 truncate text-lg font-bold text-white">{assignmentRequest.restaurant_name}</p>
                      <p className="mt-1 line-clamp-1 text-sm text-white/60">{assignmentRequest.restaurant_address}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/5 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-sky-500/15 p-2 text-sky-100">
                      <Navigation className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Drop area</p>
                      <p className="mt-1 truncate text-lg font-bold text-white">{assignmentRequest.customer_name}</p>
                      <p className="mt-1 line-clamp-1 text-sm text-white/60">{assignmentRequest.customer_address}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Per km</p>
                  <p className="mt-2 text-lg font-bold text-white">Rs. {Number(assignmentRequest.per_km_rate || 0).toFixed(0)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Route</p>
                  <p className="mt-2 text-lg font-bold text-white">{Number(assignmentRequest.route_distance_km || 0).toFixed(1)} km</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Pay type</p>
                  <p className="mt-2 inline-flex items-center justify-center gap-1 text-lg font-bold text-white">
                    <Wallet className="h-4 w-4 text-orange-300" />
                    {assignmentRequest.payment_type || 'PREPAID'}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleAccept}
                disabled={accepting}
                className="mt-8 h-16 w-full rounded-[24px] bg-[linear-gradient(135deg,#ff6b00_0%,#ff8c1a_38%,#ff4d00_100%)] text-xl font-bold text-white shadow-[0_18px_48px_-18px_rgba(255,107,0,0.85)] hover:opacity-95"
              >
                {accepting ? (
                  <>
                    <Loader className="mr-2 h-5 w-5 animate-spin" />
                    Accepting order...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Accept order
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
