/**
 * DELIVERY STATE RECONCILIATION ENGINE
 * 
 * Ensures frontend state stays in sync with authoritative backend state.
 * 
 * Rules:
 * 1. On mount, page reconnect, or visibility change: fetch authoritative active order
 * 2. If backend says NO active delivery: clear ALL frontend state
 * 3. If backend says ACTIVE: sync frontend with backend state
 * 4. If socket ACK not received within 3 sec: fetch reconciliation
 * 5. Never trust local state as source of truth
 */

import { deliveryApi } from './delivery-api'
import { useDeliveryOrderStore } from '@/store/deliveryOrderStore'
import { useDeliveryAuthStore } from '@/store/deliveryAuthStore'

interface ReconciliationResult {
  hasActiveOrder: boolean
  order: any | null
  didClear: boolean
  timestamp: string
  source: string
}

let lastReconciliationTime = 0
const RECONCILIATION_COOLDOWN_MS = 5000

/**
 * Fetch authoritative rider delivery state from backend.
 * 
 * This is called when:
 * - Page mounts
 * - Socket reconnects
 * - Visibility returns
 * - Socket ACK timeout
 * 
 * Returns AUTHORITATIVE state — backend is always source of truth.
 */
export const reconcileRiderDeliveryState = async (
  token: string,
  source: string = 'manual'
): Promise<ReconciliationResult> => {
  const now = Date.now()
  
  // Prevent rapid-fire reconciliation (max once per 5 sec)
  if (now - lastReconciliationTime < RECONCILIATION_COOLDOWN_MS) {
    console.log('[STATE_RECONCILE_THROTTLED]', {
      source,
      lastReconciliationMs: now - lastReconciliationTime,
      timestamp: new Date().toISOString(),
    })
    return {
      hasActiveOrder: false,
      order: null,
      didClear: false,
      timestamp: new Date().toISOString(),
      source: 'throttled',
    }
  }

  lastReconciliationTime = now

  console.log('[STATE_RECONCILE_START]', {
    source,
    timestamp: new Date().toISOString(),
  })

  try {
    const result = await deliveryApi.getActiveOrder(token)

    console.log('[STATE_RECONCILE_API_RESPONSE]', {
      source,
      hasOrder: !!result.order,
      orderId: result.order?.id || null,
      deliveryStatus: result.order?.delivery_status || null,
      timestamp: new Date().toISOString(),
    })

    const orderStore = useDeliveryOrderStore.getState()

    if (!result.order) {
      // BACKEND AUTHORITATIVE: No active delivery
      console.log('[STATE_RECONCILE_CLEAR]', {
        source,
        reason: 'Backend returned no active order',
        hadActiveOrder: !!orderStore.activeOrder,
        orderId: orderStore.activeOrder?.id || null,
        timestamp: new Date().toISOString(),
      })

      // Clear ALL active delivery state
      orderStore.resetActiveDelivery()
      useDeliveryAuthStore.getState().clearActiveDeliverySession()

      return {
        hasActiveOrder: false,
        order: null,
        didClear: true,
        timestamp: new Date().toISOString(),
        source,
      }
    }

    // BACKEND AUTHORITATIVE: Sync frontend with backend state
    console.log('[STATE_RECONCILE_SYNC]', {
      source,
      orderId: result.order.id,
      status: result.order.delivery_status,
      timestamp: new Date().toISOString(),
    })

    orderStore.setActiveOrder(result.order)

    return {
      hasActiveOrder: true,
      order: result.order,
      didClear: false,
      timestamp: new Date().toISOString(),
      source,
    }
  } catch (error) {
    console.error('[STATE_RECONCILE_FAILED]', {
      source,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })

    // On error, don't assume anything — let next reconciliation attempt fix it
    return {
      hasActiveOrder: false,
      order: null,
      didClear: false,
      timestamp: new Date().toISOString(),
      source: 'error',
    }
  }
}

/**
 * Handle socket ACK timeout — force reconciliation if client doesn't ACK.
 * 
 * If backend emits ORDER_COMPLETED and client doesn't ACK within 3 seconds,
 * backend will call this to force reconciliation.
 */
export const handleSocketAckTimeout = async (
  token: string,
  orderId: string,
  event: string
): Promise<void> => {
  console.log('[SOCKET_ACK_TIMEOUT]', {
    orderId,
    event,
    timestamp: new Date().toISOString(),
  })

  // Force reconciliation with no cooldown
  lastReconciliationTime = 0
  await reconcileRiderDeliveryState(token, `ack_timeout_${event}`)
}

/**
 * Reset reconciliation timer (called on successful ACK).
 */
export const resetReconciliationTimer = (): void => {
  lastReconciliationTime = 0
}
