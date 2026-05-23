import { create } from 'zustand'
import { AvailableOrder, ActiveOrder, DeliveryLocation } from '@/types/delivery'

interface DeliveryOrderStore {
  availableOrders: AvailableOrder[]
  activeOrder: ActiveOrder | null
  currentLocation: DeliveryLocation | null
  refreshing: boolean

  setAvailableOrders: (orders: AvailableOrder[]) => void
  upsertAvailableOrder: (order: AvailableOrder) => void
  removeAvailableOrder: (orderId: string) => void
  setActiveOrder: (order: ActiveOrder | null) => void
  setCurrentLocation: (location: DeliveryLocation | null) => void
  setRefreshing: (refreshing: boolean) => void
  updateActiveOrderStatus: (status: string) => void
}

export const useDeliveryOrderStore = create<DeliveryOrderStore>()((set) => ({
  availableOrders: [],
  activeOrder: null,
  currentLocation: null,
  refreshing: false,

  setAvailableOrders: (orders) => {
    set({ availableOrders: orders })
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
}))
