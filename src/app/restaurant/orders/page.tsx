'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { BellRing, Check, Clock3, MessageCircle, PackageCheck, RefreshCw, X, User, Phone, Truck, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/restaurant-panel/EmptyState'
import { PanelSkeleton } from '@/components/restaurant-panel/PanelSkeleton'
import { RestaurantPanelShell } from '@/components/restaurant-panel/RestaurantPanelShell'
import { RestaurantRouteGuard } from '@/components/restaurant-panel/RestaurantRouteGuard'
import { restaurantPanelApi } from '@/lib/restaurant-panel-api'
import { useRestaurantOwnerAuthStore } from '@/store/restaurantOwnerAuthStore'
import { getRealtimeSocket, releaseRealtimeSocket } from '@/lib/realtime'

type OrderStatus = 'PLACED' | 'ACCEPTED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED'

type OrderItem = {
  id: string
  menu_item_id: string
  quantity: number
  price: number
  name: string
  image: string
  notes: string
}

type Order = {
  id: string
  status: OrderStatus
  total: number
  payment_method: string
  payment_status: string
  estimated_delivery: string
  created_at: string
  customer: { name: string; phone: string }
  items: OrderItem[]
  rider: { name: string; phone: string } | null
}

const statusConfig: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  PLACED: { label: 'New Order', color: 'text-blue-700', bg: 'bg-blue-100' },
  ACCEPTED: { label: 'Accepted', color: 'text-sky-700', bg: 'bg-sky-100' },
  PREPARING: { label: 'Preparing', color: 'text-orange-700', bg: 'bg-orange-100' },
  READY_FOR_PICKUP: { label: 'Ready for Pickup', color: 'text-amber-700', bg: 'bg-amber-100' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', color: 'text-purple-700', bg: 'bg-purple-100' },
  DELIVERED: { label: 'Delivered', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  CANCELLED: { label: 'Cancelled', color: 'text-rose-700', bg: 'bg-rose-100' },
}

const workflowActions: Partial<Record<OrderStatus, Array<{ label: string; status: OrderStatus; variant?: 'default' | 'outline' | 'destructive' }>>> = {
  PLACED: [
    { label: 'Accept Order', status: 'ACCEPTED' },
    { label: 'Reject', status: 'CANCELLED', variant: 'destructive' },
  ],
  ACCEPTED: [{ label: 'Start Preparing', status: 'PREPARING' }],
  PREPARING: [{ label: 'Ready for Pickup', status: 'READY_FOR_PICKUP' }],
  READY_FOR_PICKUP: [
    { label: 'Handover to Rider', status: 'OUT_FOR_DELIVERY' },
  ],
  OUT_FOR_DELIVERY: [],
  DELIVERED: [],
  CANCELLED: [],
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const config = statusConfig[status] || statusConfig.PLACED
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${config.bg} ${config.color}`}>
      {config.label}
    </span>
  )
}

function PaymentBadge({ method, status }: { method: string; status: string }) {
  const isCod = method.toLowerCase() === 'cod'
  const label = isCod ? 'COD' : 'Online'
  
  let paymentLabel = status || 'pending'
  if (isCod && status === 'pending') paymentLabel = 'Collect on Delivery'
  if (isCod && status === 'cod_collected') paymentLabel = 'Collected'
  if (!isCod && status === 'paid') paymentLabel = 'Paid'
  if (status === 'refunded') paymentLabel = 'Refunded'
  if (status === 'refund_pending') paymentLabel = 'Refund Pending'
  if (status === 'cancelled') paymentLabel = 'Cancelled'

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${isCod ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
        {label}
      </span>
      <span className="text-xs text-slate-500">{paymentLabel}</span>
    </div>
  )
}

function OrdersContent() {
  const token = useRestaurantOwnerAuthStore((state) => state.token)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [highlightedIds, setHighlightedIds] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL')
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'COD' | 'ONLINE'>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const knownOrderIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    let isMounted = true

    const loadOrders = async (background = false) => {
      if (!token) return

      try {
        const response = await restaurantPanelApi.getOrders(token)
        const freshIds = new Set(response.orders.map((order: Order) => order.id))
        const newIds = response.orders
          .map((order: Order) => order.id)
          .filter((id: string) => knownOrderIds.current.size > 0 && !knownOrderIds.current.has(id))

        if (isMounted) {
          setOrders(response.orders)

          if (newIds.length > 0) {
            setHighlightedIds(newIds)
            toast.success(`${newIds.length} new order${newIds.length > 1 ? 's' : ''} received`)
            window.setTimeout(() => {
              setHighlightedIds((current) => current.filter((id) => !newIds.includes(id)))
            }, 5000)
          }
        }

        knownOrderIds.current = freshIds
      } catch (error) {
        if (!background && isMounted) {
          toast.error(error instanceof Error ? error.message : 'Unable to load orders')
        }
      } finally {
        if (isMounted && !background) {
          setLoading(false)
        }
      }
    }

    loadOrders()
    const interval = window.setInterval(() => loadOrders(true), 15000)

    return () => {
      isMounted = false
      window.clearInterval(interval)
    }
  }, [token])

  useEffect(() => {
    if (!token) return

    const socket = getRealtimeSocket('restaurant', token)
    if (!socket) return

    const refreshOrders = () => {
      void restaurantPanelApi.getOrders(token).then((response) => {
        setOrders(response.orders)
        knownOrderIds.current = new Set(response.orders.map((order: Order) => order.id))
      }).catch(() => undefined)
    }

    socket.on('restaurant:order_updated', refreshOrders)
    socket.on('ORDER_PREPARING', refreshOrders)
    socket.on('ORDER_READY', refreshOrders)
    socket.on('ORDER_ASSIGNED', refreshOrders)
    socket.on('PICKED_UP', refreshOrders)
    socket.on('DELIVERED', refreshOrders)
    socket.on('CANCELLED', refreshOrders)

    return () => {
      socket.off('restaurant:order_updated', refreshOrders)
      socket.off('ORDER_PREPARING', refreshOrders)
      socket.off('ORDER_READY', refreshOrders)
      socket.off('ORDER_ASSIGNED', refreshOrders)
      socket.off('PICKED_UP', refreshOrders)
      socket.off('DELIVERED', refreshOrders)
      socket.off('CANCELLED', refreshOrders)
      releaseRealtimeSocket('restaurant', token)
    }
  }, [token])

  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    if (!token) return

    setUpdatingOrderId(orderId)

    try {
      const response = await restaurantPanelApi.updateOrderStatus(token, orderId, status)
      setOrders((current) =>
        current.map((order) => (order.id === orderId ? { ...order, ...response.order } : order))
      )
      toast.success(`Order ${status.toLowerCase().replaceAll('_', ' ')}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update order')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return orders.filter((order) => {
      if (statusFilter === 'ACCEPTED' && !['PLACED', 'ACCEPTED'].includes(order.status)) return false
      if (statusFilter !== 'ALL' && statusFilter !== 'ACCEPTED' && order.status !== statusFilter) return false
      if (paymentFilter === 'COD' && order.payment_method.toLowerCase() !== 'cod') return false
      if (paymentFilter === 'ONLINE' && order.payment_method.toLowerCase() === 'cod') return false
      if (!normalizedSearch) return true

      const searchable = [
        order.id,
        order.customer.name,
        order.customer.phone,
        order.rider?.name,
        order.items.map((item) => item.name).join(' '),
      ].join(' ').toLowerCase()

      return searchable.includes(normalizedSearch)
    })
  }, [orders, paymentFilter, searchTerm, statusFilter])

  const filterChips: Array<{ key: OrderStatus | 'ALL'; label: string; statuses?: OrderStatus[] }> = [
    { key: 'ACCEPTED', label: 'Incoming / Accepted', statuses: ['PLACED', 'ACCEPTED'] },
    { key: 'PREPARING', label: 'Preparing', statuses: ['PREPARING'] },
    { key: 'READY_FOR_PICKUP', label: 'Ready for Pickup', statuses: ['READY_FOR_PICKUP'] },
    { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', statuses: ['OUT_FOR_DELIVERY'] },
    { key: 'ALL', label: 'All Orders' },
  ]

  const getChipCount = (chip: typeof filterChips[number]) =>
    chip.key === 'ALL'
      ? orders.length
      : orders.filter((order) => (chip.statuses || [chip.key as OrderStatus]).includes(order.status)).length

  if (loading) {
    return (
      <RestaurantPanelShell
        title="Orders"
        description="Manage incoming orders. Focus on food preparation and handover to riders."
      >
        <PanelSkeleton />
      </RestaurantPanelShell>
    )
  }

  return (
    <RestaurantPanelShell
      title="Orders"
      description="Manage incoming orders. Focus on food preparation and handover to riders."
      actions={
        <div className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-900">
          <BellRing className="h-4 w-4" />
          Live order sync active
        </div>
      }
    >
      <div className="space-y-3">
        <div className="sticky top-2 z-20 -mx-3 border-y border-slate-200/70 bg-slate-50/95 px-3 py-2 backdrop-blur md:mx-0 md:rounded-xl md:border">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filterChips.map((chip) => {
              const active = statusFilter === chip.key
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setStatusFilter(chip.key)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200'
                  }`}
                >
                  {chip.label}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {getChipCount(chip)}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-[1fr_160px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search order, customer, rider, or item"
                className="h-10 w-full rounded-xl border-2 border-slate-200 bg-white pl-10 pr-3 text-sm font-medium outline-none transition focus:border-orange-400"
              />
            </label>
            <select
              value={paymentFilter}
              onChange={(event) => setPaymentFilter(event.target.value as 'ALL' | 'COD' | 'ONLINE')}
              className="h-10 rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-medium outline-none transition focus:border-orange-400"
            >
              <option value="ALL">All payments</option>
              <option value="COD">COD</option>
              <option value="ONLINE">Online</option>
            </select>
          </div>
        </div>

        {orders.length === 0 ? (
          <EmptyState
            title="No live orders yet"
            description="New incoming orders will appear here automatically."
          />
        ) : null}

        {orders.length > 0 && filteredOrders.length === 0 ? (
          <EmptyState
            title="No matching orders"
            description="Adjust filters or search to see more orders."
          />
        ) : null}

        {filteredOrders.map((order) => {
          const actions = workflowActions[order.status] || []
          const isHighlighted = highlightedIds.includes(order.id)
          const isTerminal = order.status === 'DELIVERED' || order.status === 'CANCELLED'

          return (
            <Card
              key={order.id}
              className={`border bg-white/90 transition-all ${
                isHighlighted
                  ? 'border-orange-300 shadow-[0_20px_60px_-30px_rgba(249,115,22,0.65)] ring-2 ring-orange-200'
                  : 'border-white/60'
              }`}
            >
                <CardContent className="p-4">
                  {/* Header */}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-slate-900">#{order.id.slice(0, 8)}</h2>
                    <StatusBadge status={order.status} />
                    {isHighlighted && (
                      <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                        New
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock3 className="h-4 w-4" />
                    {new Date(order.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[1fr_1fr_0.9fr]">
                  {/* Customer Info */}
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Customer</h3>
                      <span className="text-sm font-black text-slate-950">Rs. {Number(order.total || 0).toFixed(0)}</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" />
                        <span className="font-medium text-slate-900">{order.customer.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <a href={`tel:${order.customer.phone}`} className="text-sm text-slate-600 hover:text-orange-600 underline underline-offset-2">
                          {order.customer.phone}
                        </a>
                      </div>
                      {order.customer.phone && (
                        <a
                          href={`https://wa.me/${order.customer.phone.replace(/[^0-9]/g, '')}?text=Hi%20from%20Thinava%20about%20order%20${order.id.slice(0, 8).toUpperCase()}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700 mt-1"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp Customer
                        </a>
                      )}
                    </div>
                    <div className="mt-2 border-t border-slate-200 pt-2">
                      <PaymentBadge method={order.payment_method} status={order.payment_status} />
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="rounded-xl bg-slate-50 p-3 lg:col-span-1">
                    <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <PackageCheck className="h-4 w-4 text-orange-500" />
                      Items
                    </h3>
                    <div className="space-y-1.5">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="font-medium text-slate-900 text-sm">{item.name}</div>
                            <div className="text-xs text-slate-500">Qty: {item.quantity}</div>
                            {item.notes && (
                              <div className="text-xs text-orange-600 mt-1 italic">"{item.notes}"</div>
                            )}
                          </div>
                          <div className="text-sm font-bold text-slate-900">
                            Rs. {Number(item.price || 0).toFixed(0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rider & Actions */}
                  <div className="space-y-3">
                    {/* Rider Info */}
                    <div className="rounded-xl bg-slate-50 p-3">
                      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        <Truck className="h-4 w-4 text-slate-400" />
                        Rider
                      </h3>
                      {order.rider ? (
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">{order.rider.name}</div>
                          <a href={`tel:${order.rider.phone}`} className="text-sm text-slate-600 hover:text-orange-600 underline underline-offset-2">
                            {order.rider.phone}
                          </a>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">
                          {isTerminal ? '—' : 'Waiting for rider assignment'}
                        </div>
                      )}
                    </div>

                    {/* Workflow Actions */}
                    {!isTerminal && actions.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                        {actions.map((action) => (
                          <Button
                            key={action.status}
                            variant={action.variant === 'destructive' ? 'destructive' : action.variant === 'outline' ? 'outline' : 'default'}
                            size="sm"
                            className="w-full justify-center"
                            disabled={updatingOrderId === order.id}
                            onClick={() => handleStatusUpdate(order.id, action.status)}
                          >
                            {action.status === 'CANCELLED' ? <X className="mr-2 h-4 w-4" /> :
                             action.status === 'ACCEPTED' ? <Check className="mr-2 h-4 w-4" /> :
                             action.status === 'PREPARING' ? <RefreshCw className="mr-2 h-4 w-4" /> :
                             <PackageCheck className="mr-2 h-4 w-4" />}
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}

                    {isTerminal && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                        <p className="text-sm text-slate-500">
                          {order.status === 'DELIVERED' ? '✓ Order delivered successfully' : ' Order cancelled'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </RestaurantPanelShell>
  )
}

export default function RestaurantOrdersPage() {
  return (
    <RestaurantRouteGuard>
      <OrdersContent />
    </RestaurantRouteGuard>
  )
}
