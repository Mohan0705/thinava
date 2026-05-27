import { useEffect, useRef, useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import { getRealtimeSocket, releaseRealtimeSocket, type RealtimeRole } from '@/lib/realtime'
import { isValidJwt } from '@/lib/auth/session'
import { useDeliveryOrderStore } from '@/store/deliveryOrderStore'
import { useDeliveryAuthStore } from '@/store/deliveryAuthStore'
import { useOrderStore } from '@/store/orderStore'
import type { ActiveOrder, AvailableOrder, DeliveryRealtimeEvent } from '@/types/delivery'

type EventHandler = (...args: any[]) => void

interface SubscriptionEntry {
  event: string
  handler: EventHandler
}

interface RealtimeManagerOptions {
  role: RealtimeRole
  token: string | null
  enabled?: boolean
}

const HANDLER_META = Symbol('realtimeManager')

const safeCallback = (fn: EventHandler) => {
  const wrapped = (...args: any[]) => {
    try {
      fn(...args)
    } catch (err) {
      console.error('Realtime event handler error:', err)
    }
  }
  ;(wrapped as any)[HANDLER_META] = true
  return wrapped
}

export function useRealtimeManager({ role, token, enabled = true }: RealtimeManagerOptions) {
  const subscriptionsRef = useRef<SubscriptionEntry[]>([])
  const socketRef = useRef<Socket | null>(null)
  const tokenRef = useRef(token)
  tokenRef.current = token

  const subscribe = useCallback((event: string, handler: EventHandler) => {
    subscriptionsRef.current.push({ event, handler: safeCallback(handler) })
    // STEP 4: Log listener registration
    console.log(`[LISTENER] Registered for ${event}`)
  }, [])

  useEffect(() => {
    if (!token || !enabled || !isValidJwt(token)) return

    const socket = getRealtimeSocket(role, token)
    if (!socket) return

    socketRef.current = socket
    const subs = subscriptionsRef.current

    // STEP 4: Log listener attachment
    console.log('[LISTENER] Attaching', { event_count: subs.length, role })

    for (const { event, handler } of subs) {
      // Remove any existing listeners first (prevent duplicates)
      socket.off(event)
      socket.on(event, handler)
      console.log(`[LISTENER] Attached ${event} handler`)
    }

    return () => {
      console.log('[LISTENER] Cleaning up', { event_count: subs.length, role })
      for (const { event, handler } of subs) {
        socket.off(event, handler)
      }
      releaseRealtimeSocket(role, token)
      subscriptionsRef.current = []
      socketRef.current = null
    }
  }, [role, token, enabled])

  return { subscribe }
}

type StoreSyncConfig = {
  role: RealtimeRole
  token: string | null
  deliveryStore?: boolean
  orderStore?: boolean
  onEvent?: (event: string, payload: any) => void
}

export function useRealtimeStoreSync(config: StoreSyncConfig) {
  const { role, token, deliveryStore, orderStore, onEvent } = config
  const mgr = useRealtimeManager({ role, token })

  useEffect(() => {
    if (!token) return

    const deliveryOrderActions = useDeliveryOrderStore.getState()

    if (deliveryStore) {
      mgr.subscribe('delivery:active_order_updated', (payload: DeliveryRealtimeEvent) => {
        if (payload?.order) {
          const { order } = payload
          if (
            order.delivery_status === 'READY_FOR_ASSIGNMENT' ||
            order.rider_assignment_status === 'REQUESTED' ||
            order.rider_assignment_status === 'ASSIGNED'
          ) {
            onEvent?.('delivery:active_order_updated', payload)
            return
          }
          const activeOrder: ActiveOrder = {
            id: order.id,
            restaurant_id: order.restaurant_id,
            restaurant_name: order.restaurant_name || '',
            restaurant_image: '',
            customer_id: order.user_id,
            customer_name: order.customer_name || '',
            customer_phone: '',
            customer_address: order.customer_address || '',
            subtotal: order.total,
            delivery_fee: 0,
            tax: 0,
            total: order.total,
            payment_method: order.payment_method || 'cod',
            payment_status: order.payment_status,
            cash_collected: order.cash_collected,
            collected_cash_amount: order.collected_cash_amount,
            amount_to_collect: String(order.payment_type || order.payment_method || '').toLowerCase() === 'cod' ? order.total : 0,
            delivery_status: order.delivery_status,
            route_distance_km: order.route_distance_km ?? undefined,
            estimated_total_eta_minutes: order.estimated_total_eta_minutes ?? undefined,
            restaurant_latitude: order.restaurant_latitude ?? undefined,
            restaurant_longitude: order.restaurant_longitude ?? undefined,
            customer_latitude: order.customer_latitude ?? undefined,
            customer_longitude: order.customer_longitude ?? undefined,
            items: [],
            created_at: order.created_at,
          }
          deliveryOrderActions.setActiveOrder(activeOrder)
        }
        onEvent?.('delivery:active_order_updated', payload)
      })

      mgr.subscribe('delivery:assignment_request', (payload: DeliveryRealtimeEvent) => {
        if (payload?.order) {
          const { order } = payload
          deliveryOrderActions.setAssignmentRequest({
            id: order.id,
            restaurant_id: order.restaurant_id,
            restaurant_name: order.restaurant_name || '',
            restaurant_image: '',
            customer_id: order.user_id,
            customer_name: order.customer_name || '',
            customer_phone: '',
            customer_address: order.customer_address || '',
            subtotal: order.total,
            delivery_fee: 0,
            tax: 0,
            total: order.total,
            payment_method: order.payment_method || 'cod',
            payment_type: String(order.payment_type || order.payment_method || '').toLowerCase() === 'cod' ? 'COD' : 'PREPAID',
            payment_status: order.payment_status,
            cash_collected: order.cash_collected,
            collected_cash_amount: order.collected_cash_amount,
            amount_to_collect: String(order.payment_type || order.payment_method || '').toLowerCase() === 'cod' ? order.total : 0,
            delivery_status: order.delivery_status,
            assignment_status: order.rider_assignment_status,
            assignment_expires_at: order.assignment_expires_at || undefined,
            route_distance_km: order.route_distance_km ?? undefined,
            estimated_total_eta_minutes: order.estimated_total_eta_minutes ?? undefined,
            restaurant_latitude: order.restaurant_latitude ?? undefined,
            restaurant_longitude: order.restaurant_longitude ?? undefined,
            customer_latitude: order.customer_latitude ?? undefined,
            customer_longitude: order.customer_longitude ?? undefined,
            items: [],
            created_at: order.created_at,
          })
        }
        onEvent?.('delivery:assignment_request', payload)
      })

      mgr.subscribe('delivery:offer_available', (payload: any) => {
        const availableOrder: AvailableOrder = {
          id: payload.order?.id || payload.order_id,
          restaurant_id: payload.order?.restaurant_id || '',
          restaurant_name: payload.order?.restaurant_name || '',
          restaurant_image: '',
          customer_name: payload.order?.customer_name || '',
          customer_phone: '',
          customer_address: payload.order?.customer_address || '',
          total: payload.order?.total || 0,
          subtotal: 0,
          delivery_fee: 0,
          tax: 0,
          item_count: 0,
          delivery_time: '',
          created_at: payload.changed_at || new Date().toISOString(),
          restaurant_latitude: payload.order?.restaurant_latitude ?? undefined,
          restaurant_longitude: payload.order?.restaurant_longitude ?? undefined,
          customer_latitude: payload.order?.customer_latitude ?? undefined,
          customer_longitude: payload.order?.customer_longitude ?? undefined,
          route_distance_km: payload.order?.route_distance_km ?? undefined,
          estimated_total_eta_minutes: payload.order?.estimated_total_eta_minutes ?? undefined,
        }
        deliveryOrderActions.upsertAvailableOrder(availableOrder)
        onEvent?.('delivery:offer_available', payload)
      })

      mgr.subscribe('delivery:offer_removed', (payload: any) => {
        const orderId = payload.order_id || payload.order?.id
        if (orderId) {
          deliveryOrderActions.removeAvailableOrder(orderId)
          if (useDeliveryOrderStore.getState().assignmentRequest?.id === orderId) {
            useDeliveryOrderStore.getState().setAssignmentRequest(null)
          }
        }
        onEvent?.('delivery:offer_removed', payload)
      })

      mgr.subscribe('delivery:status_updated', (payload: DeliveryRealtimeEvent) => {
        if (payload?.order?.delivery_status) {
          deliveryOrderActions.updateActiveOrderStatus(payload.order.delivery_status)
        }
        onEvent?.('delivery:status_updated', payload)
      })
    }

    if (orderStore) {
      mgr.subscribe('customer:order_updated', (payload: any) => {
        const orderState = useOrderStore.getState()
        if (payload?.order) {
          const serverOrder = payload.order
          orderState.updateOrderStatus(serverOrder.id, serverOrder.status?.toLowerCase() || 'placed')
          if (orderState.currentOrder?.id === serverOrder.id && orderState.currentOrder) {
            orderState.setCurrentOrder({
              ...orderState.currentOrder,
              status: serverOrder.status?.toLowerCase() as any,
            })
          }
        }
        onEvent?.('customer:order_updated', payload)
      })
    }
  }, [token, deliveryStore, orderStore, mgr, onEvent])
}

export function useAdminRealtimeSync(token: string | null, onDashboardUpdate?: (data: any) => void) {
  const mgr = useRealtimeManager({ role: 'admin', token })

  useEffect(() => {
    if (!token) return

    mgr.subscribe('admin:order_updated', (payload: any) => {
      onDashboardUpdate?.(payload)
    })

    ;[
      'ORDER_CREATED',
      'ORDER_CONFIRMED',
      'ORDER_ASSIGNED',
      'RIDER_ASSIGNED',
      'RIDER_ASSIGNMENT_REQUEST',
      'ORDER_PREPARING',
      'ORDER_READY',
      'RIDER_ACCEPTED',
      'RIDER_ARRIVED',
      'PICKED_UP',
      'ARRIVING',
      'DELIVERED',
      'CANCELLED',
      'ORDER_MOVED_TO_HISTORY',
    ].forEach((eventName) => {
      mgr.subscribe(eventName, (payload: any) => {
        onDashboardUpdate?.(payload)
      })
    })

    mgr.subscribe('restaurantStatusChanged', (payload: any) => {
      onDashboardUpdate?.(payload)
    })

    mgr.subscribe('riderStatusChanged', (payload: any) => {
      onDashboardUpdate?.(payload)
    })
  }, [token, mgr, onDashboardUpdate])
}

/**
 * Hook for Rider Dashboard Real-time Synchronization
 * Listens to delivery events and updates Zustand store
 */
export function useRiderDashboardSync(token: string | null, onStatsUpdate?: (event: { type: string; data: any }) => void) {
  const mgr = useRealtimeManager({ role: 'delivery_partner', token })
  const deliveryStore = useDeliveryAuthStore

  useEffect(() => {
    if (!token) return

    // STEP 4: Listen to delivery earnings updates
    mgr.subscribe('delivery:earnings_updated', (payload: any) => {
      console.log('[EVENT_RX] delivery:earnings_updated', payload)
      
      if (payload?.earnings) {
        const { total_amount, deliveries } = payload.earnings
        console.log('[STORE_MUTATE] Setting earnings', { total_amount, deliveries })
        
        // STEP 5: Verify store mutation
        if (total_amount !== undefined) {
          deliveryStore.getState().updateTodayEarnings(total_amount)
          const newState = deliveryStore.getState().realtimeStats
          console.log('[STORE_VERIFY] After updateTodayEarnings:', newState.todayEarnings)
        }
        if (deliveries !== undefined) {
          deliveryStore.getState().updateTodayDeliveries(deliveries)
          const newState = deliveryStore.getState().realtimeStats
          console.log('[STORE_VERIFY] After updateTodayDeliveries:', newState.todayDeliveries)
        }
      }
      
      onStatsUpdate?.({ type: 'earnings_updated', data: payload })
    })

    // Listen to wallet updates
    mgr.subscribe('delivery:wallet_updated', (payload: any) => {
      console.log('[EVENT_RX] delivery:wallet_updated', payload)
      if (payload?.wallet?.floating_cash !== undefined) {
        const floatingCash = payload.wallet.floating_cash
        console.log('[STORE_MUTATE] Setting floating cash', { floatingCash })
        deliveryStore.getState().updateFloatingCash(floatingCash)
        const newState = deliveryStore.getState().realtimeStats
        console.log('[STORE_VERIFY] After updateFloatingCash:', newState.floatingCash)
      }
      onStatsUpdate?.({ type: 'wallet_updated', data: payload })
    })

    // Listen to stats updates
    mgr.subscribe('delivery:stats_updated', (payload: any) => {
      console.log('[EVENT_RX] delivery:stats_updated', payload)
      if (payload?.stats) {
        const stats = payload.stats
        console.log('[STORE_MUTATE] Syncing partner stats', stats)
        deliveryStore.getState().syncPartnerStats(stats)
        const newState = deliveryStore.getState().realtimeStats
        console.log('[STORE_VERIFY] After syncPartnerStats:', {
          deliveries: newState.todayDeliveries,
          rating: newState.rating,
          earnings: newState.todayEarnings,
        })
      }
      onStatsUpdate?.({ type: 'stats_updated', data: payload })
    })

    // Listen to rating updates
    mgr.subscribe('delivery:rating_updated', (payload: any) => {
      console.log('[EVENT_RX] delivery:rating_updated', payload)
      if (payload?.rating !== undefined) {
        console.log('[STORE_MUTATE] Setting rating', { rating: payload.rating })
        deliveryStore.getState().updateRating(payload.rating)
        const newState = deliveryStore.getState().realtimeStats
        console.log('[STORE_VERIFY] After updateRating:', newState.rating)
      }
      onStatsUpdate?.({ type: 'rating_updated', data: payload })
    })

    // Listen to generic delivery completion
    mgr.subscribe('delivery_completed', (payload: any) => {
      console.log('[EVENT_RX] delivery_completed', payload)
      onStatsUpdate?.({ type: 'delivery_completed', data: payload })
    })
  }, [token, mgr, onStatsUpdate])
}
