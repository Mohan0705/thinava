'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AdminPageShell } from '@/components/admin/AdminPageShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { adminApi } from '@/features/admin/api'
import { useAdminAuthStore } from '@/features/admin/auth-store'
import { adminPermissions } from '@/features/admin/permissions'
import { useAdminQuery } from '@/features/admin/use-admin-query'
import { useAdminRealtimeSync } from '@/lib/realtimeManager'
import { formatPrice } from '@/lib/utils'

type OrderFilters = {
  status: string
  restaurant: string
  rider: string
  area: string
  payment_method: string
}

export default function AdminOrdersPage() {
  const token = useAdminAuthStore((state) => state.token)
  const [refreshKey, setRefreshKey] = useState(0)
  const [filters, setFilters] = useState<OrderFilters>({
    status: '',
    restaurant: '',
    rider: '',
    area: '',
    payment_method: '',
  })

  const ordersQuery = useAdminQuery(
    async () => {
      const response = await adminApi.getOrders(
        token || '',
        Object.fromEntries(Object.entries(filters).filter(([, value]) => value))
      )
      return response
    },
    [token, filters.status, filters.restaurant, filters.rider, filters.area, filters.payment_method, refreshKey],
    12000
  )

  const partnersQuery = useAdminQuery(
    async () => adminApi.getDeliveryPartners(token || ''),
    [token, refreshKey],
    20000
  )

  const bestOnlineRiderId = useMemo(() => {
    const ridersList = (partnersQuery.data as any)?.riders || (partnersQuery.data as any)?.partners || []
    return ridersList.find((partner: any) => partner.is_online && !partner.force_offline && !partner.is_suspended)?.id
  }, [partnersQuery.data])

  const refresh = () => setRefreshKey((current) => current + 1)

  useAdminRealtimeSync(token, () => refresh())

  const handleStatusUpdate = async (orderId: string, status: string) => {
    try {
      console.log('Updating order status:', orderId, status)
      await adminApi.updateOrderStatus(token || '', orderId, status)
      toast.success(`Order moved to ${status.replace(/_/g, ' ')}`)
      refresh()
    } catch (error) {
      console.error('Status update failed:', error)
      toast.error(error instanceof Error ? error.message : 'Unable to update order')
    }
  }

  const handleCancelOrder = async (orderId: string) => {
    const reason = window.prompt('Cancellation reason', 'Operational cancellation by admin')
    if (!reason) {
      return
    }

    try {
      await adminApi.cancelOrder(token || '', orderId, reason)
      toast.success('Order cancelled')
      refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to cancel order')
    }
  }

  const handleMarkDelivered = async (orderId: string) => {
    try {
      console.log('Marking order delivered:', orderId)
      await adminApi.markDelivered(token || '', orderId)
      toast.success('Order marked as delivered')
      refresh()
    } catch (error) {
      console.error('Mark delivered failed:', error)
      toast.error(error instanceof Error ? error.message : 'Unable to mark order as delivered')
    }
  }

  const handleReassign = async (orderId: string) => {
    if (!bestOnlineRiderId) {
      toast.error('No online rider available for reassignment')
      return
    }

    try {
      await adminApi.reassignRider(token || '', orderId, bestOnlineRiderId)
      toast.success('Rider reassigned')
      refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to reassign rider')
    }
  }

  return (
    <AdminPageShell
      title="Orders Command Desk"
      description="Monitor every platform order, isolate delays, push status corrections, and reroute delivery flow from one live queue."
      permission={adminPermissions.orders}
      actions={<Button onClick={refresh}>Refresh Queue</Button>}
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Active</p><p className="mt-1 text-2xl font-bold">{ordersQuery.data?.summary.active ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Delayed</p><p className="mt-1 text-2xl font-bold text-amber-600">{ordersQuery.data?.summary.delayed ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Cancelled</p><p className="mt-1 text-2xl font-bold text-rose-600">{ordersQuery.data?.summary.cancelled ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">COD Orders</p><p className="mt-1 text-2xl font-bold">{ordersQuery.data?.summary.cod ?? 0}</p></CardContent></Card>
        </div>

        <Card className="sticky top-28 z-10 border border-white/70 bg-white/95 backdrop-blur">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 pt-0 md:grid-cols-2 xl:grid-cols-5">
            <select className="h-10 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="">All statuses</option>
              {ordersQuery.data?.filters.statuses.map((status) => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
            </select>
            <select className="h-10 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm" value={filters.restaurant} onChange={(event) => setFilters((current) => ({ ...current, restaurant: event.target.value }))}>
              <option value="">All restaurants</option>
              {ordersQuery.data?.filters.restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
            </select>
            <select className="h-10 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm" value={filters.rider} onChange={(event) => setFilters((current) => ({ ...current, rider: event.target.value }))}>
              <option value="">All riders</option>
              {ordersQuery.data?.filters.riders.map((rider) => <option key={rider.id} value={rider.id}>{rider.name}</option>)}
            </select>
            <select className="h-10 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm" value={filters.area} onChange={(event) => setFilters((current) => ({ ...current, area: event.target.value }))}>
              <option value="">All areas</option>
              {ordersQuery.data?.filters.areas.map((area) => <option key={area} value={area}>{area}</option>)}
            </select>
            <select className="h-10 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm" value={filters.payment_method} onChange={(event) => setFilters((current) => ({ ...current, payment_method: event.target.value }))}>
              <option value="">All payments</option>
              {ordersQuery.data?.filters.payment_methods.map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
          </CardContent>
        </Card>

        {ordersQuery.error && !ordersQuery.loading ? (
          <Card>
            <CardContent className="p-4 text-sm text-rose-700">
              {ordersQuery.error}
            </CardContent>
          </Card>
        ) : null}

        {ordersQuery.loading && !ordersQuery.data ? (
          <Card>
            <CardContent className="p-4 text-sm text-slate-500">Loading orders...</CardContent>
          </Card>
        ) : null}

        <div className="space-y-3">
          {ordersQuery.data?.orders.map((order) => {
            const statusLower = (order.status_label || order.status || '').toLowerCase()
            const isTerminal = statusLower === 'delivered' || statusLower === 'cancelled'

            return (
            <Card key={order.id} className={`border ${isTerminal ? 'border-slate-200 opacity-75' : 'border-white/70'} bg-white/95`}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-950">#{order.id.slice(0, 8)}</h3>
                      <Badge variant={order.is_delayed ? 'destructive' : 'outline'}>{order.status_label}</Badge>
                      <Badge variant="secondary">{order.delivery_status_label}</Badge>
                      <Badge variant={order.payment_method === 'COD' ? 'secondary' : 'success'}>{order.payment_method}</Badge>
                      <Badge variant={order.cash_collected ? 'success' : 'outline'}>{order.payment_status || 'pending'}</Badge>
                    </div>
                    <div className="grid gap-1.5 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                      <p><span className="font-semibold text-slate-900">Restaurant:</span> {order.restaurant.name}</p>
                      <p><span className="font-semibold text-slate-900">Customer:</span> {order.customer.name}</p>
                      <p><span className="font-semibold text-slate-900">Rider:</span> {order.rider?.name || 'Unassigned'}</p>
                      <p><span className="font-semibold text-slate-900">Area:</span> {order.area}</p>
                    </div>
                    <p className="text-sm text-slate-500">{order.customer.address}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Total {formatPrice(order.total)}</span>
                      <span>{order.item_count} items</span>
                      <span>{order.elapsed_minutes} min elapsed</span>
                      <span>Commission {formatPrice(order.platform_commission_amount)}</span>
                      <span>Placed {new Date(order.created_at).toLocaleString('en-IN')}</span>
                      {order.delivery_assigned_at ? <span>Assigned {new Date(order.delivery_assigned_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span> : null}
                    </div>
                    {order.items?.length ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Ordered items</p>
                        <div className="grid gap-1.5 md:grid-cols-2">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                              <span className="font-medium text-slate-900">{item.quantity} x {item.name}</span>
                              <span className="font-bold text-slate-900">{formatPrice(item.price)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:max-w-[360px] xl:justify-end">
                    <Button size="sm" variant="outline" disabled={isTerminal} className={isTerminal ? 'opacity-40 cursor-not-allowed' : ''} onClick={() => handleStatusUpdate(order.id, 'PREPARING')}>Preparing</Button>
                    <Button size="sm" variant="outline" disabled={isTerminal} className={isTerminal ? 'opacity-40 cursor-not-allowed' : ''} onClick={() => handleStatusUpdate(order.id, 'READY_FOR_PICKUP')}>Ready</Button>
                    <Button size="sm" variant="outline" disabled={isTerminal} className={isTerminal ? 'opacity-40 cursor-not-allowed' : ''} onClick={() => handleStatusUpdate(order.id, 'PICKED_UP')}>Picked Up</Button>
                    <Button size="sm" variant="outline" disabled={isTerminal} className={isTerminal ? 'opacity-40 cursor-not-allowed' : ''} onClick={() => handleStatusUpdate(order.id, 'ARRIVING')}>Arriving</Button>
                    <Button size="sm" variant="default" disabled={isTerminal} className={`bg-emerald-600 hover:bg-emerald-700 ${isTerminal ? 'opacity-40 cursor-not-allowed' : ''}`} onClick={() => handleMarkDelivered(order.id)}>Delivered</Button>
                    <Button size="sm" variant="outline" disabled={isTerminal} className={isTerminal ? 'opacity-40 cursor-not-allowed' : ''} onClick={() => handleReassign(order.id)}>Reassign</Button>
                    <Button size="sm" variant="destructive" disabled={isTerminal} className={isTerminal ? 'opacity-40 cursor-not-allowed' : ''} onClick={() => handleCancelOrder(order.id)}>Cancel</Button>
                    <a href={`tel:${order.customer.phone}`}><Button size="sm" variant="secondary" className="w-full">Customer</Button></a>
                    {order.rider?.phone ? <a href={`tel:${order.rider.phone}`}><Button size="sm" variant="secondary" className="w-full">Rider</Button></a> : null}
                  </div>
                </div>
              </CardContent>
            </Card>
            )
          })}
        </div>
      </div>
    </AdminPageShell>
  )
}
