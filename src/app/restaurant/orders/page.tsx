'use client'

import { useEffect, useRef, useState } from 'react'
import { BellRing, Check, Clock3, MessageCircle, PackageCheck, RefreshCw, X, User, Phone, Truck } from 'lucide-react'
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
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${config.bg} ${config.color}`}>
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
      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${isCod ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
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
        <div className="flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <BellRing className="h-4 w-4" />
          Live order sync active
        </div>
      }
    >
      <div className="space-y-4">
        {orders.length === 0 ? (
          <EmptyState
            title="No live orders yet"
            description="New incoming orders will appear here automatically."
          />
        ) : null}

        {orders.map((order) => {
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
              <CardContent className="p-6">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900">#{order.id.slice(0, 8)}</h2>
                    <StatusBadge status={order.status} />
                    {isHighlighted && (
                      <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                        New
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Clock3 className="h-4 w-4" />
                    {new Date(order.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  {/* Customer Info */}
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Customer</h3>
                    <div className="space-y-2">
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
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <PaymentBadge method={order.payment_method} status={order.payment_status} />
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="rounded-2xl bg-slate-50 p-4 lg:col-span-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                      <PackageCheck className="h-4 w-4 text-orange-500" />
                      Items
                    </h3>
                    <div className="space-y-2">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="font-medium text-slate-900 text-sm">{item.name}</div>
                            <div className="text-xs text-slate-500">Qty: {item.quantity}</div>
                            {item.notes && (
                              <div className="text-xs text-orange-600 mt-1 italic">"{item.notes}"</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rider & Actions */}
                  <div className="space-y-4">
                    {/* Rider Info */}
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
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
                      <div className="space-y-2">
                        {actions.map((action) => (
                          <Button
                            key={action.status}
                            variant={action.variant === 'destructive' ? 'destructive' : action.variant === 'outline' ? 'outline' : 'default'}
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
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
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
