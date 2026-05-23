'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Bell,
  HelpCircle,
  Loader,
  ShieldCheck,
  User,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DeliveryBottomNav } from '@/components/delivery/DeliveryBottomNav'
import { deliveryApi } from '@/lib/delivery-api'
import { useDeliveryAuthStore } from '@/store/deliveryAuthStore'

const formatCurrency = (value: number | undefined) => `Rs. ${Number(value || 0).toFixed(0)}`

export default function DeliveryMorePage() {
  const router = useRouter()
  const token = useDeliveryAuthStore((state) => state.token)
  const partner = useDeliveryAuthStore((state) => state.partner)

  const [loading, setLoading] = useState(true)
  const [todayEarnings, setTodayEarnings] = useState(0)

  useEffect(() => {
    if (!token) {
      router.push('/delivery/login')
      return
    }

    void deliveryApi.getTodayEarnings(token)
      .then((result) => {
        setTodayEarnings(Number(result.earnings.total_amount || 0))
      })
      .catch(() => {
        toast.error('Failed to load partner tools')
      })
      .finally(() => setLoading(false))
  }, [router, token])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#000A22] text-white">
        <Loader className="h-12 w-12 animate-spin text-orange-400" />
      </div>
    )
  }

  const actionCards = [
    {
      title: 'Profile',
      helper: 'Identity, vehicle, bank details, KYC',
      icon: User,
      href: '/delivery/profile',
      tone: 'from-orange-500 to-orange-600',
    },
    {
      title: 'Support',
      helper: 'Need help, incidents, and escalation routes',
      icon: HelpCircle,
      href: '/delivery/profile',
      tone: 'from-sky-500 to-cyan-600',
    },
    {
      title: 'Notifications',
      helper: 'Dispatch updates and ops alerts',
      icon: Bell,
      href: '/delivery/orders',
      tone: 'from-emerald-500 to-teal-600',
    },
  ]

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#000A22_0%,#081b39_28%,#f8fafc_28%,#f8fafc_100%)] pb-28">
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-orange-200">Thinava tools</p>
              <h1 className="text-2xl font-bold">More</h1>
            </div>

            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Partner hub
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="overflow-hidden border-0 bg-slate-950 text-white shadow-[0_35px_90px_-60px_rgba(0,10,34,0.95)]">
              <CardContent className="p-6">
                <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-200">Partner toolkit</p>
                    <h2 className="mt-3 text-3xl font-bold">Everything beyond live orders in one clean control layer.</h2>
                    <p className="mt-3 text-sm text-white/60">
                      This section groups partner identity, incentives, wallet visibility, and support so the main flow stays focused on dispatch and navigation.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/45">Wallet snapshot</p>
                      <p className="mt-2 text-2xl font-bold">{formatCurrency(partner?.cash_in_hand)}</p>
                      <p className="mt-1 text-sm text-emerald-200">Cash currently in hand</p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/45">Today's total</p>
                      <p className="mt-2 text-2xl font-bold">{formatCurrency(todayEarnings)}</p>
                      <p className="mt-1 text-sm text-orange-200">Live earnings synced</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-4 sm:grid-cols-2">
              {actionCards.map((action, index) => {
                const Icon = action.icon
                return (
                  <motion.div key={action.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                    <Link href={action.href}>
                      <Card className="h-full overflow-hidden border-0 bg-white shadow-[0_25px_80px_-60px_rgba(0,10,34,0.35)] transition hover:-translate-y-0.5 hover:shadow-lg">
                        <CardContent className="p-5">
                          <div className={`inline-flex rounded-2xl bg-gradient-to-br ${action.tone} p-3 text-white shadow-lg`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <h3 className="mt-4 text-xl font-bold text-slate-950">{action.title}</h3>
                          <p className="mt-2 text-sm text-slate-500">{action.helper}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                )
              })}
            </div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <Card className="border-0 bg-white shadow-[0_25px_80px_-60px_rgba(0,10,34,0.35)]">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
                      <Wallet className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Cash center</p>
                      <h2 className="mt-1 text-2xl font-bold text-slate-950">Wallet and settlements</h2>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[26px] bg-slate-950 p-5 text-white">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/45">Floating cash</p>
                    <p className="mt-2 text-3xl font-bold">{formatCurrency(partner?.cash_in_hand)}</p>
                    <p className="mt-2 text-sm text-white/60">
                      Delivery payouts are already updating the wallet table. The next backend layer is exposing full transaction history, payout requests, and settlement actions.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-orange-200 bg-orange-50">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-orange-600" />
                    <div>
                      <p className="font-semibold text-orange-950">Rollout note</p>
                      <p className="mt-1 text-sm text-orange-900/80">
                        This hub is now aligned with the Thinava premium shell. The full wallet, support, referral, and notification screens are the next product slices to flesh out behind these entry points.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="mt-4 w-full bg-gradient-to-r from-orange-500 to-orange-600"
                    onClick={() => router.push('/delivery/orders')}
                  >
                    Return to live orders
                  </Button>
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
