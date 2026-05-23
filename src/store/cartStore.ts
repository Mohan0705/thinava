import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CartItem, MenuItem } from '@/types'

interface CartStore {
  items: CartItem[]
  userId: string | null // Track which user owns this cart
  addItem: (menuItem: MenuItem) => void
  removeItem: (menuItemId: string) => void
  updateQuantity: (menuItemId: string, quantity: number) => void
  clearCart: () => void
  setUserId: (userId: string | null) => void // Set when user logs in
  getSubtotal: () => number
  getItemCount: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      userId: null,
      
      setUserId: (userId) => {
        set({ userId })
        // When user changes, clear old cart if coming from different user
        if (userId === null) {
          // Logout: clear cart
          set({ items: [] })
        }
      },
      
      addItem: (menuItem) => {
        const items = get().items
        const existingItem = items.find((item) => item.menuItem.id === menuItem.id)
        
        if (existingItem) {
          set({
            items: items.map((item) =>
              item.menuItem.id === menuItem.id
                ? { ...item, quantity: item.quantity + 1 }
                : item
            ),
          })
        } else {
          set({ items: [...items, { menuItem, quantity: 1 }] })
        }
      },
      
      removeItem: (menuItemId) => {
        set({ items: get().items.filter((item) => item.menuItem.id !== menuItemId) })
      },
      
      updateQuantity: (menuItemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(menuItemId)
          return
        }
        
        set({
          items: get().items.map((item) =>
            item.menuItem.id === menuItemId
              ? { ...item, quantity }
              : item
          ),
        })
      },
      
      clearCart: () => {
        set({ items: [] })
      },
      
      getSubtotal: () => {
        return get().items.reduce(
          (total, item) => total + item.menuItem.price * item.quantity,
          0
        )
      },
      
      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0)
      },
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({
        items: state.items,
        userId: state.userId,
      }),
    }
  )
)
