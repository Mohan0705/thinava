'use client'

import Link from 'next/link'
import { BarChart3, IndianRupee, ShoppingBag, Store, Timer, Truck } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AdminPageShell } from '@/components/admin/AdminPageShell'
import { AdminMetricCard } from '@/components/admin/AdminMetricCard'
import { OperationsMap } from '@/components/admin/OperationsMap'
import { RealtimeFeed } from '@/components/admin/RealtimeFeed'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { adminApi } from '@/features/admin/api'
import { useAdminAuthStore } from '@/features/admin/auth-store'
import { adminPermissions } from '@/features/admin/permissions'
import { useAdminQuery } from '@/features/admin/use-admin-query'
import { useAdminRealtimeSync } from '@/lib/realtimeManager'
import { formatPrice } from '@/lib/utils'

const pieColors = ['#f97316', '#fb7185', '#f59e0b', '#0ea5e9', '#111827']

export default function AdminDashboardPage() {
  const token = useAdminAuthStore((state) => state.token)
  const { data, loading, error, refetch } = useAdminQuery(
    async () => {
      const response = await adminApi.getDashboard(token || '')
      return response.dashboard
    },
    [token],
    15000
  )

  useAdminRealtimeSync(token, () => refetch())

  return (
    <AdminPageShell
      title="Platform Operations"
      description="Realtime dispatch, revenue, and ecosystem health across Thinava's customer, restaurant, rider, and support loops."
      permission={adminPermissions.dashboard}
      actions={
        <>
          <Link href="/admin/orders">
            <Button variant="outline">Open Orders Desk</Button>
          </Link>
          <Link href="/admin/live-map">
            <Button>Launch Live Map</Button>
          </Link>
        </>
      }
    >
      {error && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-semibold text-slate-700 mb-2">Unable to load dashboard</p>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
        </div>
      ) : !data || loading ? (
        <div className="grid gap-6">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-40 rounded-[28px]" />
            ))}
          </div>
          <Skeleton className="h-[420px] rounded-[28px]" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard
              label="Orders Today"
              value={data.metrics.orders_today.toString()}
              delta={`${data.metrics.failed_orders} failed orders flagged`}
              accent="bg-[linear-gradient(135deg,#fb923c,#f97316)]"
              icon={ShoppingBag}
            />
            <AdminMetricCard
              label="Active Deliveries"
              value={data.metrics.active_deliveries.toString()}
              delta={`${data.metrics.online_riders} riders available right now`}
              accent="bg-[linear-gradient(135deg,#0ea5e9,#2563eb)]"
              icon={Truck}
            />
            <AdminMetricCard
              label="Revenue Today"
              value={formatPrice(data.metrics.revenue_today)}
              delta={`${formatPrice(data.metrics.platform_commission)} platform commission`}
              accent="bg-[linear-gradient(135deg,#22c55e,#16a34a)]"
              icon={IndianRupee}
            />
            <AdminMetricCard
              label="Average Delivery"
              value={`${data.metrics.average_delivery_time} min`}
              delta={`${data.metrics.active_restaurants} active restaurants`}
              accent="bg-[linear-gradient(135deg,#f43f5e,#ef4444)]"
              icon={Timer}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border border-white/70 bg-white/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <BarChart3 className="h-5 w-5 text-orange-600" />
                  Revenue and Order Momentum
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-2">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.revenue_trend}>
                      <defs>
                        <linearGradient id="dashboardRevenue" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="revenue" stroke="#f97316" fill="url(#dashboardRevenue)" strokeWidth={2.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.order_status_breakdown} dataKey="value" nameKey="label" innerRadius={58} outerRadius={96}>
                        {data.order_status_breakdown.map((entry, index) => (
                          <Cell key={entry.status} fill={pieColors[index % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <RealtimeFeed items={data.activity_feed} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <OperationsMap data={data.live_map} compact />

            <Card className="border border-white/70 bg-white/90">
              <CardHeader>
                <CardTitle className="text-xl">Busy Zone Heat</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.zone_performance}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                      <XAxis dataKey="zone" tickLine={false} axisLine={false} angle={-12} textAnchor="end" height={50} />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="orders" fill="#f97316" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid gap-3">
                  {data.zone_performance.slice(0, 4).map((zone) => (
                    <div key={zone.zone} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-900">{zone.zone}</p>
                        <p className="text-sm text-slate-500">{zone.orders} orders</p>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {zone.delayed} delayed, {formatPrice(zone.revenue)} revenue tracked.
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AdminPageShell>
  )
}
