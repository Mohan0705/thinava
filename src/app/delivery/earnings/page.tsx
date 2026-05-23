'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Award, Calendar, Loader, MapPin, TrendingUp, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { DeliveryBottomNav } from '@/components/delivery/DeliveryBottomNav'
import { deliveryApi } from '@/lib/delivery-api'
import { useDeliveryAuthStore } from '@/store/deliveryAuthStore'
import { EarningRecord } from '@/types/delivery'

interface EarningsSummary {
  today: number
  week: number
  month: number
  totalDeliveries: number
  history: EarningRecord[]
}

const formatCurrency = (value: number | undefined) => `Rs. ${Number(value || 0).toFixed(2)}`

export default function DeliveryEarningsPage() {
  const router = useRouter()
  const token = useDeliveryAuthStore((state) => state.token)

  const [loading, setLoading] = useState(true)
  const [earnings, setEarnings] = useState<EarningsSummary>({
    today: 0,
    week: 0,
    month: 0,
    totalDeliveries: 0,
    history: [],
  })
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today')

  useEffect(() => {
    if (!token) {
      router.push('/delivery/login')
      return
    }

    void loadEarnings()
  }, [router, token])

  const loadEarnings = async () => {
    try {
      const [todayRes, weekRes, monthRes, historyRes] = await Promise.all([
        deliveryApi.getTodayEarnings(token!),
        deliveryApi.getWeekEarnings(token!),
        deliveryApi.getMonthEarnings(token!),
        deliveryApi.getEarningsHistory(token!, 50),
      ])

      setEarnings({
        today: Number(todayRes.earnings.total_amount || 0),
        week: Number(weekRes.earnings.total_amount || 0),
        month: Number(monthRes.earnings.total_amount || 0),
        totalDeliveries: historyRes.history.length,
        history: historyRes.history,
      })
    } catch {
      toast.error('Failed to load earnings')
    } finally {
      setLoading(false)
    }
  }

  const periodEarnings = {
    today: earnings.today,
    week: earnings.week,
    month: earnings.month,
  }

  const averagePerDelivery = useMemo(() => {
    if (earnings.totalDeliveries === 0) {
      return 0
    }

    return earnings.month / earnings.totalDeliveries
  }, [earnings.month, earnings.totalDeliveries])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#000A22] text-white">
        <Loader className="h-12 w-12 animate-spin text-orange-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#000A22_0%,#071833_26%,#f8fafc_26%,#f8fafc_100%)] pb-28">
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-orange-200">Thinava earnings</p>
              <h1 className="text-2xl font-bold">Wallet pulse</h1>
            </div>

            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Live
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="overflow-hidden border-0 bg-slate-950 text-white shadow-[0_35px_90px_-60px_rgba(0,10,34,0.95)]">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-200">
                      {selectedPeriod.toUpperCase()} EARNINGS
                    </p>
                    <h2 className="mt-3 text-5xl font-black tracking-tight">
                      {formatCurrency(periodEarnings[selectedPeriod])}
                    </h2>
                    <p className="mt-2 text-sm text-white/60">
                      Route distance, COD handling, and per-delivery payouts flow into this stream.
                    </p>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/45">Average per delivery</p>
                    <p className="mt-2 text-3xl font-bold">{formatCurrency(averagePerDelivery)}</p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3">
                  {(['today', 'week', 'month'] as const).map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setSelectedPeriod(period)}
                      className={`rounded-[24px] border px-4 py-4 text-left transition ${
                        selectedPeriod === period
                          ? 'border-orange-300/25 bg-orange-500/15 text-white'
                          : 'border-white/10 bg-white/5 text-white/75'
                      }`}
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em]">{period}</div>
                      <div className="mt-2 text-xl font-bold">Rs. {Number(periodEarnings[period] || 0).toFixed(0)}</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <Card className="border-0 bg-white shadow-[0_30px_90px_-65px_rgba(0,10,34,0.55)]">
                <CardContent className="grid gap-3 p-6 sm:grid-cols-3">
                  <div className="rounded-[24px] bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      <Award className="h-4 w-4 text-orange-500" />
                      Deliveries
                    </div>
                    <p className="mt-3 text-3xl font-bold text-slate-950">{earnings.totalDeliveries}</p>
                  </div>

                  <div className="rounded-[24px] bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      <Calendar className="h-4 w-4 text-sky-500" />
                      Weekly
                    </div>
                    <p className="mt-3 text-3xl font-bold text-slate-950">{formatCurrency(earnings.week)}</p>
                  </div>

                  <div className="rounded-[24px] bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      <Wallet className="h-4 w-4 text-emerald-500" />
                      Monthly
                    </div>
                    <p className="mt-3 text-3xl font-bold text-slate-950">{formatCurrency(earnings.month)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 bg-white shadow-[0_30px_90px_-65px_rgba(0,10,34,0.55)]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Performance</p>
                      <h2 className="mt-2 text-2xl font-bold text-slate-950">Earning edge</h2>
                    </div>
                    <TrendingUp className="h-6 w-6 text-orange-500" />
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
                      <p className="font-semibold text-emerald-950">COD handling</p>
                      <p className="mt-1 text-sm text-emerald-900/75">
                        COD collections and payout credits are now synced automatically at delivery completion.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card className="border-0 bg-white shadow-[0_30px_90px_-65px_rgba(0,10,34,0.55)]">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-bold text-slate-950">Recent trips</h2>
                  <p className="mt-1 text-sm text-slate-500">Completed deliveries and payout records synced from the dispatch backend.</p>

                  <div className="mt-5 space-y-3">
                    {earnings.history.length > 0 ? (
                      earnings.history.map((record) => (
                        <div
                          key={record.id}
                          className="flex items-center justify-between rounded-[24px] border border-slate-100 bg-slate-50 px-4 py-4"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="rounded-2xl bg-orange-100 p-3 text-orange-600">
                              <MapPin className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-950">{record.restaurant_name}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {record.distance_km} km | {record.duration_minutes} min
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="font-bold text-slate-950">{formatCurrency(record.amount)}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(record.earned_at).toLocaleDateString('en-IN')}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                        No completed payout records yet.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      <DeliveryBottomNav />
    </div>
  )
}
