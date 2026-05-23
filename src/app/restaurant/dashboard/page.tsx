'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DollarSign, ListOrdered, Package2, Sparkles, Star, Store, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { MetricCard } from '@/components/restaurant-panel/MetricCard'
import { PanelSkeleton } from '@/components/restaurant-panel/PanelSkeleton'
import { RestaurantPanelShell } from '@/components/restaurant-panel/RestaurantPanelShell'
import { RestaurantRouteGuard } from '@/components/restaurant-panel/RestaurantRouteGuard'
import { StatusBadge } from '@/components/restaurant-panel/StatusBadge'
import { restaurantPanelApi } from '@/lib/restaurant-panel-api'
import { useRestaurantOwnerAuthStore } from '@/store/restaurantOwnerAuthStore'
import { RestaurantDashboardSummary, RestaurantAnalytics } from '@/types/restaurant-panel'
import { formatPrice } from '@/lib/utils'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

function DashboardContent() {
  const token = useRestaurantOwnerAuthStore((state) => state.token)
  const owner = useRestaurantOwnerAuthStore((state) => state.owner)
  const [summary, setSummary] = useState<RestaurantDashboardSummary | null>(null)
  const [analytics, setAnalytics] = useState<RestaurantAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [days, setDays] = useState(7)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadDashboardData = async () => {
      if (!token) {
        return
      }

      try {
        const [summaryRes, analyticsRes] = await Promise.all([
          restaurantPanelApi.getSummary(token),
          restaurantPanelApi.getAnalytics(token, days),
        ])
        if (isMounted) {
          setSummary(summaryRes.summary)
          setAnalytics(analyticsRes.analytics)
          setLoadError(null)
        }
      } catch (error) {
        console.error('Failed to load dashboard analytics data:', error)
        if (isMounted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Failed to load dashboard data'
          )
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadDashboardData()

    return () => {
      isMounted = false
    }
  }, [token, days])

  if (loading || !summary) {
    if (loadError && !loading) {
      return (
        <RestaurantPanelShell
          title="Dashboard"
          description="Monitor your live order pipeline, revenue pulse, stock readiness, and overall store health."
        >
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-lg font-semibold text-slate-700 mb-2">Unable to load dashboard</p>
            <p className="text-sm text-slate-500 mb-6">{loadError}</p>
            <Button onClick={() => { setLoading(true); setLoadError(null); window.location.reload(); }}>
              Retry
            </Button>
          </div>
        </RestaurantPanelShell>
      )
    }
    return (
      <RestaurantPanelShell
        title="Dashboard"
        description="Monitor your live order pipeline, revenue pulse, stock readiness, and overall store health."
      >
        <PanelSkeleton />
      </RestaurantPanelShell>
    )
  }

  return (
    <RestaurantPanelShell
      title="Dashboard"
      description="Monitor your live order pipeline, revenue pulse, stock readiness, and overall store health."
      actions={
        <>
          <Link href="/restaurant/orders">
            <Button variant="outline" className="bg-white">
              Review orders
            </Button>
          </Link>
          <Link href="/restaurant/menu">
            <Button>Manage menu</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Total orders today"
            value={summary.total_orders_today.toString()}
            hint="Orders received since midnight"
            icon={<ListOrdered className="h-6 w-6" />}
          />
          <MetricCard
            label="Pending orders"
            value={summary.pending_orders.toString()}
            hint="Need kitchen attention right now"
            icon={<Sparkles className="h-6 w-6" />}
          />
          <MetricCard
            label="Active menu items"
            value={summary.active_menu_items.toString()}
            hint="Items currently available to customers"
            icon={<Package2 className="h-6 w-6" />}
          />
          <MetricCard
            label="Average rating"
            value={summary.average_rating > 0 ? summary.average_rating.toFixed(1) : '—'}
            hint={summary.total_reviews > 0 ? `${summary.total_reviews} review${summary.total_reviews === 1 ? '' : 's'}` : 'No reviews yet'}
            icon={<Star className="h-6 w-6" />}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <Card className="border border-white/60 bg-white/90">
            <CardContent className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Operational snapshot</p>
                  <h2 className="text-2xl font-semibold text-slate-950">Storefront health</h2>
                </div>
                <StatusBadge status={summary.restaurant_status} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl bg-slate-950 p-5 text-white">
                  <div className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
                    Partner profile
                  </div>
                  <h3 className="text-xl font-semibold">{owner?.restaurant.name}</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    Keep your store details fresh so the customer app reflects accurate branding, timing, and availability.
                  </p>
                </div>

                <div className="rounded-3xl bg-orange-50 p-5">
                  <div className="mb-3 inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
                    Offer spotlight
                  </div>
                  <h3 className="text-xl font-semibold text-slate-950">
                    {summary.active_offer || 'No active offer'}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Update the offer banner from Settings whenever you want to promote a lunch combo, festival deal, or delivery push.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/60 bg-white/90">
            <CardContent className="p-6">
              <div className="mb-5">
                <p className="text-sm font-medium text-slate-500">Quick actions</p>
                <h2 className="text-2xl font-semibold text-slate-950">Stay in flow</h2>
              </div>

              <div className="space-y-3">
                {[
                  {
                    href: '/restaurant/orders',
                    title: 'Process incoming orders',
                    copy: 'Accept, reject, prepare, and dispatch without leaving the queue.',
                  },
                  {
                    href: '/restaurant/menu',
                    title: 'Update prices and stock',
                    copy: 'Take sold-out items offline instantly and keep catalog pricing current.',
                  },
                  {
                    href: '/restaurant/categories',
                    title: 'Organize menu sections',
                    copy: 'Keep browsing clean with category ordering and naming updates.',
                  },
                  {
                    href: '/restaurant/settings',
                    title: 'Edit store settings',
                    copy: 'Adjust branding, timings, radius, and minimum order values.',
                  },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-start justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-orange-300 hover:bg-orange-50"
                  >
                    <div>
                      <div className="font-semibold text-slate-950">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-500">{item.copy}</div>
                    </div>
                    <ArrowRight className="mt-1 h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-orange-500" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics & Visual Insights Section */}
        <div className="space-y-6 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-950 dark:text-white">Performance Insights</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Deep dive into sales trends, customer dish preferences, and order timings.</p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Button
                variant={days === 7 ? 'default' : 'ghost'}
                size="sm"
                className="rounded-xl px-4 py-1.5 text-xs font-semibold"
                onClick={() => setDays(7)}
              >
                7 Days
              </Button>
              <Button
                variant={days === 30 ? 'default' : 'ghost'}
                size="sm"
                className="rounded-xl px-4 py-1.5 text-xs font-semibold"
                onClick={() => setDays(30)}
              >
                30 Days
              </Button>
            </div>
          </div>

          {/* Extra Analytics Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border border-white/60 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
              <CardContent className="p-5">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider dark:text-slate-400">Average Order Value</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{formatPrice(analytics?.summary.avgOrderValue || 0)}</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Revenue per order in this period</p>
              </CardContent>
            </Card>
            <Card className="border border-white/60 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
              <CardContent className="p-5">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider dark:text-slate-400">Order Success Rate</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
                  {analytics?.summary.totalOrders && analytics?.summary.totalOrders > 0
                    ? `${Math.round((analytics.summary.completedOrders / analytics.summary.totalOrders) * 100)}%`
                    : '0%'}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{analytics?.summary.completedOrders} of {analytics?.summary.totalOrders || 0} orders completed</p>
              </CardContent>
            </Card>
            <Card className="border border-white/60 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
              <CardContent className="p-5">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider dark:text-slate-400">Cancellation Rate</p>
                <h3 className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
                  {analytics?.summary.totalOrders && analytics?.summary.totalOrders > 0
                    ? `${Math.round((analytics.summary.cancelledOrders / analytics.summary.totalOrders) * 100)}%`
                    : '0%'}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{analytics?.summary.cancelledOrders} orders cancelled</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Revenue & Sales Trend */}
            <Card className="border border-white/60 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
              <CardContent className="p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-slate-950 dark:text-white">Revenue Trend</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Daily business growth and total orders count</p>
                </div>
                <div className="h-72 w-full">
                  {mounted && analytics && analytics.salesTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.salesTrend}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          }}
                          formatter={(value: any, name: any) => {
                            if (name === 'revenue') return [formatPrice(value), 'Revenue']
                            return [value, 'Orders']
                          }}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="revenue" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">
                      No sales data found for this period.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Dishes */}
            <Card className="border border-white/60 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
              <CardContent className="p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-slate-950 dark:text-white">Top Selling Dishes</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Most popular menu items ordered in Tadepalligudem</p>
                </div>
                <div className="h-72 w-full">
                  {mounted && analytics && analytics.topDishes.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.topDishes} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={100} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                          }}
                        />
                        <Bar dataKey="quantity" fill="#3b82f6" radius={[0, 8, 8, 0]} name="Quantity Ordered" barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">
                      No menu orders data found for this period.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Peak Hours Analysis */}
            <Card className="border border-white/60 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/90 lg:col-span-2">
              <CardContent className="p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-slate-950 dark:text-white">Hourly Traffic Analysis (Peak Hours)</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Distribution of orders throughout the day (24-hour format)</p>
                </div>
                <div className="h-64 w-full">
                  {mounted && analytics && analytics.peakHours.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.peakHours}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="hour"
                          stroke="#94a3b8"
                          fontSize={10}
                          tickLine={false}
                          tickFormatter={(hour: number) => {
                            const suffix = hour >= 12 ? 'PM' : 'AM'
                            const displayHour = hour % 12 || 12
                            return `${displayHour} ${suffix}`
                          }}
                        />
                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                          }}
                          formatter={(value: any) => [`${value} Orders`, 'Order count']}
                          labelFormatter={(hour: any) => {
                            const suffix = hour >= 12 ? 'PM' : 'AM'
                            const displayHour = hour % 12 || 12
                            return `Time: ${displayHour}:00 ${suffix}`
                          }}
                        />
                        <Bar dataKey="orders" fill="#10b981" radius={[8, 8, 0, 0]} name="Orders count" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">
                      No hourly data available yet.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Reviews */}
            {analytics?.reviews && analytics.reviews.length > 0 ? (
              <Card className="border border-white/60 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/90 lg:col-span-2">
                <CardContent className="p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-slate-950 dark:text-white">Recent Reviews</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">What customers are saying about your food and service</p>
                  </div>
                  <div className="space-y-4">
                    {analytics.reviews.map((review, index) => (
                      <div key={index} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-3.5 w-3.5 ${
                                  star <= (review.restaurant_rating || 0)
                                    ? 'fill-orange-400 text-orange-400'
                                    : 'fill-slate-200 text-slate-200'
                                }`}
                              />
                            ))}
                            <span className="ml-2 text-xs font-medium text-slate-500">{review.customer_name}</span>
                          </div>
                          <span className="text-xs text-slate-400">{new Date(review.created_at).toLocaleDateString()}</span>
                        </div>
                        {review.review_text && (
                          <p className="text-sm text-slate-600">{review.review_text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </RestaurantPanelShell>
  )
}

export default function RestaurantDashboardPage() {
  return (
    <RestaurantRouteGuard>
      <DashboardContent />
    </RestaurantRouteGuard>
  )
}
