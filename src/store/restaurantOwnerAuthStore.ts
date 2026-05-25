import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { RestaurantOwner } from '@/types/restaurant-panel'
import { isValidJwt, syncAuthCookie } from '@/lib/auth/session'
import { disconnectRealtimeSocket } from '@/lib/realtime'

interface RestaurantOwnerAuthStore {
  token: string | null
  owner: RestaurantOwner | null
  hydrated: boolean
  setSession: (owner: RestaurantOwner, token: string) => void
  setOwner: (owner: RestaurantOwner) => void
  setHydrated: (hydrated: boolean) => void
  logout: () => void
}

export const useRestaurantOwnerAuthStore = create<RestaurantOwnerAuthStore>()(
  persist(
    (set) => ({
      token: null,
      owner: null,
      hydrated: false,
      setSession: (owner, token) => {
        syncAuthCookie('restaurant', token)
        set({ owner, token })
      },
      setOwner: (owner) => set({ owner }),
      setHydrated: (hydrated) => set({ hydrated }),
      logout: () => {
        syncAuthCookie('restaurant', null)
        disconnectRealtimeSocket()
        // SECURITY: Clear old global key for migration
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('restaurant-owner-auth')
        }
        set({ token: null, owner: null })
      },
    }),
    {
      name: 'restaurant-owner-auth',
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          if (!isValidJwt(state.token)) {
            state.logout()
            state.setHydrated(true)
            return
          }

          syncAuthCookie('restaurant', state.token)
        }
        state?.setHydrated(true)
      },
    }
  )
)
