'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  Clock3,
  Gift,
  Loader,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { DeliveryBottomNav } from '@/components/delivery/DeliveryBottomNav'
import { deliveryApi } from '@/lib/delivery-api'
import { useDeliveryAuthStore } from '@/store/deliveryAuthStore'

type IncentivesViewModel = {
  todayDeliveries: number
  todayEarnings: number
  weekEarnings: number
  acceptanceRate: number
  cancellationRate: number
}

const formatCurrency = (value: number) => `Rs. ${Number(value || 0).toFixed(0)}`

const clampProgress = (value: number) => Math.max(0, Math.min(100, value))

export default function DeliveryIncentivesPage() {
  const router = useRouter()
  const token = useDeliveryAuthStore((state) => state.token)

  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<IncentivesViewModel>({
    todayDeliveries: 0,
    todayEarnings: 0,
    weekEarnings: 0,
    acceptanceRate: 100,
    cancellationRate: 0,
  })

  useEffect(() => {
    if (!token) {
      router.push('/delivery/login')
      return
    }

    void loadIncentives()
  }, [router, token])

  const loadIncentives = async () => {
    try {
      const [todayResult, weekResult, profileResult] = await Promise.all([
        deliveryApi.getTodayEarnings(token!),
        deliveryApi.getWeekEarnings(token!),
        deliveryApi.getProfile(token!),
      ])

      setMetrics({
        todayDeliveries: Number(todayResult.earnings.deliveries || 0),
        todayEarnings: Number(todayResult.earnings.total_amount || 0),
        weekEarnings: Number(weekResult.earnings.total_amount || 0),
        acceptanceRate: Number(profileResult.profile.acceptance_rate || 100),
        cancellationRate: Number(profileResult.profile.cancellation_rate || 0),
      })
    } catch (error) {
      toast.error('Failed to load incentives')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <Loader className="h-12 w-12 animate-spin text-orange-400" />
      </div>
    )
  }

  const streakGoal = 5
  const streakCompleted = Math.min(metrics.todayDeliveries, streakGoal)
  const streakRemaining = Math.max(streakGoal - metrics.todayDeliveries, 0)
  const streakProgress = clampProgress((streakCompleted / streakGoal) * 100)
  const qualityProgress = clampProgress(metrics.acceptanceRate)
  const weekendGoal = 15
  const weeklyTripsEstimate = Math.round(metrics.weekEarnings / 70)
  const weekendProgress = clampProgress((weeklyTripsEstimate / weekendGoal) * 100)

  const livePrograms = [
    {
      title: '5-order streak',
      payout: 'Rs. 100 bonus',
      helper:
        streakRemaining > 0
          ? `${streakRemaining} more delivery${streakRemaining === 1 ? '' : 'ies'} to unlock today.`
          : 'Unlocked for today. Keep going for extra momentum.',
      progress: streakProgress,
      icon: Target,
      accent: 'from-orange-500 to-red-500',
    },
    {
      title: 'Quality boost',
      payout: 'High acceptance priority',
      helper: `Acceptance ${metrics.acceptanceRate.toFixed(0)}% and cancellation ${metrics.cancellationRate.toFixed(0)}%.`,
      progress: qualityProgress,
      icon: ShieldCheck,
      accent: 'from-emerald-500 to-teal-500',
    },
    {
      title: 'Weekend accelerator',
      payout: 'Higher-volume zones',
      helper: `${Math.max(weekendGoal - weeklyTripsEstimate, 0)} more trips to hit the ${weekendGoal}-trip pace.`,
      progress: weekendProgress,
      icon: TrendingUp,
      accent: 'from-sky-500 to-indigo-500',
    },
  ]

  const boostCards = [
    {
      label: 'Lunch window',
      value: '12 PM - 2:30 PM',
      description: 'Peak dispatch hours usually unlock surge-based payouts.',
    },
    {
      label: 'Night bonus',
      value: 'After 10 PM',
      description: 'Late-hour deliveries can add an automatic night boost.',
    },
    {
      label: 'COD handling',
      value: 'Auto-added',
      description: 'Cash-on-delivery tasks include a handling bonus in payout.',
    },
  ]

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#020617_0%,#0f172a_26%,#f8fafc_26%,#f8fafc_100%)] pb-28">
      <div className="px-4 pb-6 pt-4 md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-center justify-between text-white">
            <Link
              href="/delivery/dashboard"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 backdrop-blur"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-orange-200">Thinava rewards</p>
              <h1 className="text-2xl font-bold">Incentives and boosts</h1>
            </div>

            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">
              Live
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="overflow-hidden border-0 bg-slate-950 text-white shadow-[0_35px_100px_-55px_rgba(15,23,42,0.95)]">
              <CardContent className="p-6 md:p-7">
                <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-orange-200">Rewards pulse</p>
                    <h2 className="mt-3 text-3xl font-bold">Stay in the hot zone and stack more than base pay.</h2>
                    <p className="mt-3 max-w-2xl text-sm text-white/65">
                      Thinava is now carrying delivery payouts, live route metrics, and rider performance into one dispatch flow. This screen turns those signals into easy-to-read earning opportunities.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
                    <div className="rounded-[28px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Today</p>
                      <p className="mt-2 text-3xl font-bold">{formatCurrency(metrics.todayEarnings)}</p>
                      <p className="mt-1 text-sm text-white/55">{metrics.todayDeliveries} completed deliveries</p>
                    </div>
                    <div className="rounded-[28px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">This week</p>
                      <p className="mt-2 text-3xl font-bold">{formatCurrency(metrics.weekEarnings)}</p>
                      <p className="mt-1 text-sm text-white/55">Momentum across active dispatch shifts</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              {livePrograms.map((program, index) => {
                const Icon = program.icon
                return (
                  <motion.div
                    key={program.title}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06 }}
                  >
                    <Card className="overflow-hidden border-0 bg-white shadow-[0_25px_80px_-60px_rgba(15,23,42,0.45)]">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Live program</p>
                            <h3 className="mt-2 text-2xl font-bold text-slate-950">{program.title}</h3>
                            <p className="mt-2 text-sm text-slate-500">{program.helper}</p>
                          </div>
                          <div className={`rounded-2xl bg-gradient-to-br ${program.accent} p-3 text-white shadow-lg`}>
                            <Icon className="h-6 w-6" />
                          </div>
                        </div>

                        <div className="mt-5">
                          <div className="flex items-center justify-between text-sm font-medium">
                            <span className="text-slate-500">Progress</span>
                            <span className="text-slate-950">{Math.round(program.progress)}%</span>
                          </div>
                          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${program.accent}`}
                              style={{ width: `${program.progress}%` }}
                            />
                          </div>
                        </div>

                        <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Reward</p>
                          <p className="mt-2 text-lg font-semibold">{program.payout}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>

            <div className="space-y-5">
              <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-0 bg-white shadow-[0_25px_80px_-60px_rgba(15,23,42,0.45)]">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-orange-100 p-3 text-orange-600">
                        <Gift className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Boost windows</p>
                        <h2 className="mt-1 text-2xl font-bold text-slate-950">High-value timing</h2>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {boostCards.map((card) => (
                        <div key={card.label} className="rounded-[24px] border border-slate-100 bg-slate-50/90 p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-semibold text-slate-950">{card.label}</p>
                              <p className="mt-1 text-sm text-slate-500">{card.description}</p>
                            </div>
                            <div className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-sm">
                              {card.value}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                <Card className="border-0 bg-slate-950 text-white shadow-[0_35px_90px_-70px_rgba(15,23,42,0.95)]">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-white/10 p-3 text-orange-200">
                        <Sparkles className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">What is live now</p>
                        <h2 className="mt-1 text-2xl font-bold">Current reward backbone</h2>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3 text-sm text-white/70">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        Dynamic delivery pay is already route-aware through base pay, distance, surge, rain, night, and COD handling.
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        Restaurant coordinates, rider tracking, and active delivery metrics are now part of the assignment flow.
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        The next backend layer is turning stored incentive and shift tables into admin-configurable APIs.
                      </div>
                    </div>

                    <Button
                      type="button"
                      className="mt-5 w-full bg-gradient-to-r from-orange-500 to-red-500"
                      onClick={() => router.push('/delivery/orders')}
                    >
                      <Clock3 className="mr-2 h-4 w-4" />
                      Go back to live offers
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                <Card className="border border-orange-200 bg-orange-50">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <Award className="mt-0.5 h-5 w-5 text-orange-600" />
                      <div>
                        <p className="font-semibold text-orange-950">Heads-up</p>
                        <p className="mt-1 text-sm text-orange-900/80">
                          This incentives screen is wired to live rider performance data, but the full admin-managed incentive engine is still the next step in the delivery rollout.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <DeliveryBottomNav />
    </div>
  )
}
