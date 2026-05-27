import { create } from 'zustand'
import { AvailableOrder, ActiveOrder, DeliveryLocation } from '@/types/delivery'

interface DeliveryOrderStore {
  availableOrders: AvailableOrder[]
  assignmentRequest: ActiveOrder | null
  activeOrder: ActiveOrder | null
  currentLocation: DeliveryLocation | null
  refreshing: boolean

  setAvailableOrders: (orders: AvailableOrder[]) => void
  setAssignmentRequest: (order: ActiveOrder | null) => void
  upsertAvailableOrder: (order: AvailableOrder) => void
  removeAvailableOrder: (orderId: string) => void
  setActiveOrder: (order: ActiveOrder | null) => void
  setCurrentLocation: (location: DeliveryLocation | null) => void
  setRefreshing: (refreshing: boolean) => void
  updateActiveOrderStatus: (status: string) => void
  resetActiveDelivery: (orderId?: string | null) => void
}

export const useDeliveryOrderStore = create<DeliveryOrderStore>()((set) => ({
  availableOrders: [],
  assignmentRequest: null,
  activeOrder: null,
  currentLocation: null,
  refreshing: false,

  setAvailableOrders: (orders) => {
    set({ availableOrders: orders })
  },

  setAssignmentRequest: (order) => {
    set({ assignmentRequest: order })
  },

  upsertAvailableOrder: (order) => {
    set((state) => {
      const existingIndex = state.availableOrders.findIndex((item) => item.id === order.id)

      if (existingIndex === -1) {
        return {
          availableOrders: [order, ...state.availableOrders],
        }
      }

      const nextOrders = [...state.availableOrders]
      nextOrders[existingIndex] = {
        ...nextOrders[existingIndex],
        ...order,
      }

      return {
        availableOrders: nextOrders,
      }
    })
  },

  removeAvailableOrder: (orderId) => {
    set((state) => ({
      availableOrders: state.availableOrders.filter((order) => order.id !== orderId),
    }))
  },

  setActiveOrder: (order) => {
    set({ activeOrder: order })
  },

  setCurrentLocation: (location) => {
    set({ currentLocation: location })
  },

  setRefreshing: (refreshing) => {
    set({ refreshing })
  },

  updateActiveOrderStatus: (status) => {
    set((state) => ({
      activeOrder: state.activeOrder ? { ...state.activeOrder, delivery_status: status } : null,
    }))
  },

  resetActiveDelivery: (orderId = null) => {
    console.log('[RIDER_STATE_RESET]', {
      orderId,
      source: 'deliveryOrderStore',
      timestamp: new Date().toISOString(),
    })
    set((state) => ({
      activeOrder:
        orderId && state.activeOrder?.id && state.activeOrder.id !== orderId
          ? state.activeOrder
          : null,
      assignmentRequest:
        orderId && state.assignmentRequest?.id && state.assignmentRequest.id !== orderId
          ? state.assignmentRequest
          : null,
      availableOrders: orderId
        ? state.availableOrders.filter((order) => order.id !== orderId)
        : state.availableOrders,
      refreshing: false,
    }))
  },
}))
