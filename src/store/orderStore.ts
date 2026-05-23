import { create } from 'zustand'
import { Order } from '@/types'

interface OrderStore {
  orders: Order[]
  currentOrder: Order | null
  setOrders: (orders: Order[]) => void
  setCurrentOrder: (order: Order) => void
  addOrder: (order: Order) => void
  updateOrderStatus: (orderId: string, status: Order['status']) => void
}

export const useOrderStore = create<OrderStore>()((set) => ({
  orders: [],
  currentOrder: null,
  
  setOrders: (orders) => {
    set({ orders })
  },
  
  setCurrentOrder: (order) => {
    set({ currentOrder: order })
  },
  
  addOrder: (order) => {
    set((state) => ({ orders: [order, ...state.orders] }))
  },
  
  updateOrderStatus: (orderId, status) => {
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId ? { ...order, status } : order
      ),
      currentOrder:
        state.currentOrder?.id === orderId
          ? { ...state.currentOrder, status }
          : state.currentOrder,
    }))
  },
}))
