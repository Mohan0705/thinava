'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Bell,
  Bike,
  CalendarDays,
  Coins,
  LogOut,
  Phone,
  Star,
  Wallet,
  MessageCircle,
  MapPin,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { DeliveryBottomNav } from '@/components/delivery/DeliveryBottomNav'
import { deliveryApi } from '@/lib/delivery-api'
import { useDeliveryAuthStore } from '@/store/deliveryAuthStore'
import { useRiderDashboardSync } from '@/lib/realtimeManager'
import { logSocketStatus } from '@/lib/socket-debug'
import { API_BASE_URL } from '@/lib/api'
import type { RiderWallet, CashPickupRequest } from '@/types/delivery'

const formatCurrency = (value: number | undefined) => `Rs. ${Number(value || 0).toFixed(0)}`

export default function DeliveryDashboardPage() {
  const router = useRouter()
  const token = useDeliveryAuthStore((state) => state.token)
  const partner = useDeliveryAuthStore((state) => state.partner)
  const setPartner = useDeliveryAuthStore((state) => state.setPartner)
  const logout = useDeliveryAuthStore((state) => state.logout)

  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(partner?.is_online ?? false)
  const [todayEarnings, setTodayEarnings] = useState(0)
  const [todayDeliveries, setTodayDeliveries] = useState(0)
  const [toggling, setToggling] = useState(false)
  const [recentReviews, setRecentReviews] = useState<any[]>([])
  const [displayOnlineTime, setDisplayOnlineTime] = useState('0h 0m')
  const hasActiveOrder = Boolean(partner?.current_order_id)

  const [wallet, setWallet] = useState<RiderWallet | null>(null)
  const [supportPhone, setSupportPhone] = useState('+918978992808')
  const [supportWhatsapp, setSupportWhatsapp] = useState('918978992808')
  const [riderZone, setRiderZone] = useState<string | null>(null)
  const [requestingPickup, setRequestingPickup] = useState(false)
  const [pickupRequests, setPickupRequests] = useState<CashPickupRequest[]>([])
  const [showPickupModal, setShowPickupModal] = useState(false)
  const [rating, setRating] = useState<number>(0)

  useEffect(() => {
    if (!token) {
      router.push('/delivery/login')
      return
    }
    
    // STEP 1-2: Verify socket connection status
    logSocketStatus('[DASHBOARD_MOUNT] Socket status check')
    const riderId = useDeliveryAuthStore.getState().partner?.id
    console.log('[DASHBOARD] Dashboard mounted', {
      tokenLength: token.length,
      riderId,
      timestamp: new Date().toISOString(),
    })
    
    void loadDashboard()
  }, [router, token])

  // Setup realtime synchronization for dashboard updates
  useRiderDashboardSync(token, (event) => {
    console.log('[DASHBOARD] Event callback triggered:', event.type)
    // Sync local state with realtime updates from store
    const store = useDeliveryAuthStore.getState()
    
    if (event.type === 'earnings_updated' && event.data?.earnings) {
      const newEarnings = Number(event.data.earnings.total_amount || store.realtimeStats.todayEarnings || 0)
      const newDeliveries = Number(event.data.earnings.deliveries || store.realtimeStats.todayDeliveries || 0)
      console.log('[DASHBOARD] Updating from earnings_updated:', { newEarnings, newDeliveries })
      setTodayEarnings(newEarnings)
      setTodayDeliveries(newDeliveries)
    }
    
    if (event.type === 'stats_updated' && event.data?.stats) {
      const stats = event.data.stats
      console.log('[DASHBOARD] Updating from stats_updated:', stats)
      if (stats.average_rating) setRating(Number(stats.average_rating))
      if (stats.total_deliveries) setTodayDeliveries(Number(stats.total_deliveries))
      if (stats.total_earned) setTodayEarnings(Number(stats.total_earned))
    }
    
    if (event.type === 'wallet_updated' && event.data?.wallet) {
      console.log('[DASHBOARD] Updating from wallet_updated:', event.data.wallet)
      // Wallet state will be updated via store
    }
  })

  // STEP 12: Fallback polling every 5 seconds for missed events
  useEffect(() => {
    if (!token) return
    
    console.log('[DASHBOARD] Starting fallback polling interval')
    const pollInterval = setInterval(() => {
      console.log('[DASHBOARD] Fallback poll triggered')
      void loadDashboard()
    }, 5000)
    
    return () => {
      clearInterval(pollInterval)
      console.log('[DASHBOARD] Stopped fallback polling')
    }
  }, [token])

  useEffect(() => {
    if (!isOnline) {
      setDisplayOnlineTime('0h 0m')
      return
    }

    const updateTime = () => {
      const onlineSince = partner?.online_since
      if (!onlineSince) return

      const elapsedMs = Date.now() - new Date(onlineSince).getTime()
      const totalSeconds = Math.floor(elapsedMs / 1000)
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      setDisplayOnlineTime(`${hours}h ${minutes}m`)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [isOnline, partner?.online_since])

  const loadDashboard = async () => {
    try {
      console.log('[DASHBOARD] Loading dashboard data...')
      const [earningsResult, profileResult] = await Promise.all([
        deliveryApi.getTodayEarnings(token!),
        deliveryApi.getProfile(token!),
      ])

      const earnings = Number(earningsResult.earnings.total_amount || 0)
      const deliveries = Number(earningsResult.earnings.deliveries || 0)
      console.log('[DASHBOARD] API earnings:', { earnings, deliveries })
      
      setTodayEarnings(earnings)
      setTodayDeliveries(deliveries)
      setPartner(profileResult.profile)
      setIsOnline(profileResult.profile.is_online)
      setRating(Number(profileResult.profile.average_rating || 0))

      const profile = profileResult.profile
      if (profile?.id) {
        try {
          const [walletRes, supportRes, reviewsRes] = await Promise.all([
            deliveryApi.getWallet(token!),
            deliveryApi.getSupportInfo(token!),
            fetch(`${API_BASE_URL}/ratings/analytics/rider/${profile.id}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            }).then(r => r.json()).catch(() => ({ analytics: { recent_reviews: [] } })),
          ])

          setWallet(walletRes.wallet)
          setSupportPhone(supportRes.phone)
          setSupportWhatsapp(supportRes.whatsapp)

          if (reviewsRes.analytics?.recent_reviews) {
            setRecentReviews(reviewsRes.analytics.recent_reviews)
          }

          if (reviewsRes.analytics?.average) {
            const freshRating = Number(reviewsRes.analytics.average)
            if (freshRating > 0) setRating(freshRating)
          }
        } catch {
          // non-critical
        }
      }
    } catch (error) {
      toast.error('Failed to load delivery dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleOnline = async () => {
    if (isOnline && hasActiveOrder) {
      toast.error('Complete active order before going offline.')
      return
    }

    setToggling(true)
    try {
      const result = await deliveryApi.setOnlineStatus(token!, !isOnline)
      const nextOnline = result.is_online
      setIsOnline(nextOnline)
      if (partner) {
        setPartner({
          ...partner,
          is_online: nextOnline,
          online_since: result.online_since ?? (nextOnline ? new Date().toISOString() : null),
        })
      }
      toast.success(nextOnline ? 'You are live for new dispatch offers.' : 'You are offline for now.')
    } catch (error) {
      toast.error('Failed to update live status')
    } finally {
      setToggling(false)
    }
  }

  const handleLogout = () => {
    logout()
    router.push('/delivery/login')
  }

  const handleRequestPickup = async () => {
    if (!token) return
    setRequestingPickup(true)
    try {
      const result = await deliveryApi.requestCashPickup(token)
      setPickupRequests((prev) => [result.request, ...prev])
      toast.success('Cash pickup requested. Support will contact you soon.')
      setShowPickupModal(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to request pickup')
    } finally {
      setRequestingPickup(false)
    }
  }

  const progressTarget = 20
  const progressPercent = Math.max(8, Math.min(100, (todayDeliveries / progressTarget) * 100))
  const initials = useMemo(() => {
    const label = partner?.full_name || 'TP'
    return label
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }, [partner?.full_name])

  const floatingCash = wallet?.floating_cash ?? partner?.cash_in_hand ?? 0
  const floatingCashLimit = wallet?.floating_cash_limit ?? 1500
  const cashPercent = floatingCashLimit > 0 ? Math.round((floatingCash / floatingCashLimit) * 100) : 0

  const quickActions = [
    {
      label: 'My Shifts',
      helper: 'Book busy slots',
      icon: CalendarDays,
      color: 'from-amber-500 to-orange-500',
      onClick: () => router.push('/delivery/shifts'),
    },
    {
      label: 'Earnings',
      helper: 'Trips and trends',
      icon: Coins,
      color: 'from-emerald-500 to-green-500',
      onClick: () => router.push('/delivery/earnings'),
    },
    {
      label: 'Wallet',
      helper: 'Cash and payouts',
      icon: Wallet,
      color: 'from-red-500 to-rose-500',
      onClick: () => router.push('/delivery/more'),
    },
  ]

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#000A22] text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-orange-400/30 border-t-orange-400" />
          <p className="mt-4 text-sm text-white/60">Loading Thinava rider command center...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#000A22_0%,#051634_22%,#0a1e40_36%,#f8fafc_36%,#f8fafc_100%)] pb-28">
      <div className="px-4 pb-6 pt-4 md:px-8">
        <div className="mx-auto max-w-6xl">

          {/* Floating Cash Warning Banners */}
          {cashPercent >= 100 && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
              <Card className="border-0 bg-gradient-to-r from-red-600 to-red-700 shadow-lg">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <AlertTriangle className="mt-0.5 h-7 w-7 shrink-0 text-red-200" />
                    <div className="min-w-0">
                      <p className="font-bold text-white text-base">Cash collected is high!</p>
                      <p className="mt-1 text-sm text-red-200">You may not get new COD orders until cash is collected.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="bg-white text-red-700 hover:bg-red-50 font-semibold"
                          onClick={() => setShowPickupModal(true)}
                        >
                          <Wallet className="mr-1.5 h-4 w-4" />
                          Contact Support
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="border border-white/40 text-white hover:bg-white/10 font-semibold"
                          onClick={() => {
                            if (supportPhone) window.open(`tel:${supportPhone}`, '_blank')
                          }}
                        >
                          <Phone className="mr-1.5 h-4 w-4" />
                          Call Support
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {cashPercent >= 80 && cashPercent < 100 && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
              <Card className="border-0 bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-100" />
                      <p className="text-sm font-semibold text-white">Cash collection at {cashPercent}%. Contact support when ready.</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0 bg-white text-orange-700 hover:bg-orange-50 font-semibold"
                      onClick={() => setShowPickupModal(true)}
                    >
                      Contact
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[34px] border border-white/10 bg-white/5 p-4 text-white shadow-[0_30px_80px_-40px_rgba(0,10,34,0.95)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleToggleOnline}
                disabled={toggling || (isOnline && hasActiveOrder)}
                className={`inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  isOnline
                    ? 'border-emerald-400/35 bg-emerald-500/20 text-emerald-100'
                    : 'border-white/10 bg-white/5 text-white/75'
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isOnline ? 'bg-emerald-400 shadow-[0_0_16px_rgba(74,222,128,0.9)]' : 'bg-white/40'
                  }`}
                />
                {toggling ? 'Updating...' : isOnline ? 'Online' : 'Offline'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80"
                >
                  <Bell className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/delivery/profile')}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-sm font-bold text-white shadow-lg"
                >
                  {initials}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[32px] bg-[linear-gradient(135deg,rgba(255,107,0,0.95)_0%,rgba(123,52,0,0.85)_45%,rgba(8,16,36,0.95)_100%)] p-5 shadow-[0_35px_80px_-50px_rgba(255,107,0,0.8)]">
                {isOnline && hasActiveOrder ? (
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-50">
                    Complete active order before going offline
                  </div>
                ) : null}
                <p className="text-sm font-medium text-orange-50/90">Today's earnings</p>
                <div className="mt-3 flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-4xl font-bold tracking-tight">{formatCurrency(todayEarnings)}</h1>
                    <p className="mt-2 text-sm text-orange-50/75">
                      Smart route pay and completed trips.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-right backdrop-blur">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-orange-50/60">Live rating</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-lg font-bold">
                      {rating > 0 ? (
                        <>{rating.toFixed(1)}<Star className="h-4 w-4 fill-current text-yellow-300" /></>
                      ) : (
                        <span className="text-sm font-semibold text-orange-50/80">New</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.18em] text-orange-50/60">Orders</p>
                    <p className="mt-2 text-3xl font-bold">{todayDeliveries}</p>
                  </div>
                  <div className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.18em] text-orange-50/60">Online</p>
                    <p className="mt-2 text-3xl font-bold">{displayOnlineTime}</p>
                  </div>
                  <div className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.18em] text-orange-50/60">Cash</p>
                    <p className="mt-2 text-3xl font-bold">{formatCurrency(floatingCash)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-white/10 bg-[#06152f]/90 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/80">Today's progress</p>
                    <p className="mt-1 text-sm text-white/45">
                      {todayDeliveries} / {progressTarget} deliveries
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-orange-400 to-orange-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Floating cash meter */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Floating cash</span>
                    <span className={cashPercent >= 100 ? 'text-red-300 font-semibold' : cashPercent >= 80 ? 'text-amber-300' : 'text-emerald-300'}>
                      {cashPercent}% of limit
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all ${
                        cashPercent >= 100 ? 'bg-red-500' : cashPercent >= 80 ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.min(cashPercent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <Card className="overflow-hidden border-0 bg-white shadow-[0_30px_90px_-65px_rgba(0,10,34,0.55)]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Quick actions</p>
                      <h2 className="mt-2 text-2xl font-bold text-slate-950">Rider control</h2>
                    </div>
                    <Bike className="h-6 w-6 text-orange-500" />
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {quickActions.map((action) => {
                      const Icon = action.icon
                      return (
                        <button
                          key={action.label}
                          type="button"
                          onClick={action.onClick}
                          className="rounded-[26px] border border-slate-100 bg-slate-50/80 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg"
                        >
                          <div className={`inline-flex rounded-2xl bg-gradient-to-br ${action.color} p-3 text-white shadow-lg`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <p className="mt-4 font-semibold text-slate-950">{action.label}</p>
                          <p className="mt-1 text-sm text-slate-500">{action.helper}</p>
                        </button>
                      )
                    })}
                  </div>

                  {/* Support buttons */}
                  <div className="mt-5 pt-5 border-t border-slate-100">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 mb-3">Support</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white font-semibold"
                        onClick={() => window.open(`https://wa.me/${supportWhatsapp}`, '_blank')}
                      >
                        <MessageCircle className="mr-1.5 h-4 w-4" />
                        WhatsApp
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="bg-slate-100 text-slate-800 hover:bg-slate-200 font-semibold"
                        onClick={() => window.open(`tel:${supportPhone}`, '_blank')}
                      >
                        <Phone className="mr-1.5 h-4 w-4" />
                        Call
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="bg-orange-50 text-orange-700 hover:bg-orange-100 font-semibold"
                        onClick={() => setShowPickupModal(true)}
                      >
                        <Wallet className="mr-1.5 h-4 w-4" />
                        Pickup
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Zone info card */}
              <Card className="overflow-hidden border-0 bg-white shadow-[0_30px_90px_-65px_rgba(0,10,34,0.55)]">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-sky-600" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Your Zone</p>
                      <p className="font-semibold text-slate-950">{riderZone || 'Tadepalligudem Central'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="space-y-5">
              <Card className="overflow-hidden border-0 bg-white shadow-[0_30px_90px_-65px_rgba(0,10,34,0.55)]">
                <CardContent className="p-6">
                  <div className="flex gap-3">
                    <Button type="button" className="flex-1" onClick={() => router.push('/delivery/orders')}>
                      Go to live orders
                    </Button>
                    <Button type="button" variant="outline" className="flex-1 border-red-200 text-red-700" onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {recentReviews.length > 0 && (
                <Card className="overflow-hidden border-0 bg-white shadow-[0_30px_90px_-65px_rgba(0,10,34,0.55)]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Recent reviews</p>
                        <h2 className="mt-2 text-2xl font-bold text-slate-950">Customer feedback</h2>
                      </div>
                      <Star className="h-6 w-6 text-yellow-500" />
                    </div>
                    <div className="mt-5 space-y-4">
                      {recentReviews.slice(0, 5).map((review, index) => (
                        <div key={index} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                          <div className="flex items-center gap-1 mb-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-3 w-3 ${
                                  star <= (review.rider_rating || 0)
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'fill-slate-200 text-slate-200'
                                }`}
                              />
                            ))}
                            <span className="ml-2 text-xs text-slate-400">{new Date(review.created_at).toLocaleDateString()}</span>
                          </div>
                          {review.review_text && (
                            <p className="text-sm text-slate-600">{review.review_text}</p>
                          )}
                          <p className="mt-1 text-xs text-slate-400">{review.customer_name}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Cash Pickup Request Modal */}
      {showPickupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
            <Card className="border-0 shadow-2xl">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-slate-950">Request Cash Pickup</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Your current floating cash is <strong className="text-slate-950">{formatCurrency(floatingCash)}</strong>.
                  A support agent will contact you to collect the cash.
                </p>

                {pickupRequests.filter(r => r.status === 'pending').length > 0 && (
                  <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
                    <p className="text-sm font-semibold text-amber-800">Pending pickup request</p>
                    <p className="mt-1 text-xs text-amber-700">
                      You already have a pending pickup request. Support will contact you shortly.
                    </p>
                  </div>
                )}

                <div className="mt-6 flex gap-3">
                  <Button
                    type="button"
                    className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600"
                    disabled={requestingPickup || pickupRequests.some(r => r.status === 'pending')}
                    onClick={handleRequestPickup}
                  >
                    {requestingPickup ? 'Requesting...' : 'Confirm Request'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowPickupModal(false)}
                  >
                    Cancel
                  </Button>
                </div>

                <div className="mt-4 flex gap-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-1 border-green-200 text-green-700"
                    onClick={() => {
                      if (supportWhatsapp) window.open(`https://wa.me/${supportWhatsapp}`, '_blank')
                    }}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    WhatsApp
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-1 border-sky-200 text-sky-700"
                    onClick={() => {
                      if (supportPhone) window.open(`tel:${supportPhone}`, '_blank')
                    }}
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    Call
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      <DeliveryBottomNav />
    </div>
  )
}
