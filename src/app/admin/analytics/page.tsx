'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AdminPageShell } from '@/components/admin/AdminPageShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { adminApi } from '@/features/admin/api'
import { useAdminAuthStore } from '@/features/admin/auth-store'
import { adminPermissions } from '@/features/admin/permissions'
import { useAdminQuery } from '@/features/admin/use-admin-query'
import { formatPrice } from '@/lib/utils'

export default function AdminAnalyticsPage() {
  const token = useAdminAuthStore((state) => state.token)
  const { data } = useAdminQuery(
    async () => {
      const response = await adminApi.getAnalytics(token || '')
      return response.analytics
    },
    [token],
    25000
  )

  return (
    <AdminPageShell
      title="Analytics Intelligence"
      description="Trace order velocity, customer growth, hotspot concentration, restaurant traction, and rider efficiency across the platform."
      permission={adminPermissions.analytics}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Avg Delivery Time</p><p className="mt-2 text-3xl font-bold">{data?.platform_health.avg_delivery_time ?? 0} min</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Fraud Alerts</p><p className="mt-2 text-3xl font-bold text-amber-600">{data?.platform_health.fraud_alerts ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Cancellation Rate</p><p className="mt-2 text-3xl font-bold">{data?.platform_health.cancellation_rate ?? 0}%</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Active Restaurants</p><p className="mt-2 text-3xl font-bold">{data?.platform_health.active_restaurants ?? 0}</p></CardContent></Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border border-white/70 bg-white/90">
            <CardHeader><CardTitle>14 Day Order and Revenue Trend</CardTitle></CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.order_trends || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="orders" stroke="#f97316" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="revenue" stroke="#0f172a" strokeWidth={2.2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border border-white/70 bg-white/90">
            <CardHeader><CardTitle>Zone Heatmap Proxy</CardTitle></CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.busiest_zones || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                  <XAxis dataKey="zone" tickLine={false} axisLine={false} angle={-12} textAnchor="end" height={60} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="orders" fill="#f97316" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="border border-white/70 bg-white/90 xl:col-span-1">
            <CardHeader><CardTitle>Top Restaurants</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data?.top_restaurants.map((restaurant) => (
                <div key={restaurant.name} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <p className="font-semibold text-slate-900">{restaurant.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{restaurant.orders} orders · {restaurant.rating.toFixed(1)} rating</p>
                  <p className="mt-2 text-sm font-semibold text-orange-700">{formatPrice(restaurant.revenue)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-white/70 bg-white/90 xl:col-span-1">
            <CardHeader><CardTitle>Rider Efficiency</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data?.rider_efficiency.map((rider) => (
                <div key={rider.name} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <p className="font-semibold text-slate-900">{rider.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{rider.deliveries} deliveries · {rider.rating.toFixed(1)} rating</p>
                  <p className="mt-2 text-sm font-semibold text-emerald-700">{formatPrice(rider.earnings)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-white/70 bg-white/90 xl:col-span-1">
            <CardHeader><CardTitle>Customer Growth</CardTitle></CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.customer_growth || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="users" fill="#0ea5e9" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminPageShell>
  )
}
