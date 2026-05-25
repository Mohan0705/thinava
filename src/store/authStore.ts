import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@/types'
import type { Address } from '@/types'
import type { AuthProfileStats, AuthVerificationSession } from '@/features/auth/types'
import { isValidJwt, syncAuthCookie } from '@/lib/auth/session'
import { disconnectRealtimeSocket } from '@/lib/realtime'
import { useCartStore } from '@/store/cartStore'

interface AuthStore {
  user: User | null
  token: string | null
  stats: AuthProfileStats | null
  pendingVerification: AuthVerificationSession | null
  hydrated: boolean
  setAuth: (user: User, token: string, stats?: AuthProfileStats | null) => void
  setUser: (user: User) => void
  setStats: (stats: AuthProfileStats | null) => void
  setAddresses: (addresses: Address[]) => void
  upsertAddress: (address: Address) => void
  removeAddress: (addressId: string) => void
  setPendingVerification: (session: AuthVerificationSession | null) => void
  setHydrated: (hydrated: boolean) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      stats: null,
      pendingVerification: null,
      hydrated: false,

      setAuth: (user, token, stats = null) => {
        syncAuthCookie('customer', token)
        // SECURITY: Set cart owner to this user
        useCartStore.setState({ userId: user.id })
        set({ user, token, stats, pendingVerification: null })
      },
      setUser: (user) => {
        set({ user })
      },
      setStats: (stats) => {
        set({ stats })
      },
      setAddresses: (addresses) => {
        set((state) => ({
          user: state.user ? { ...state.user, addresses } : state.user,
        }))
      },
      upsertAddress: (address) => {
        set((state) => {
          if (!state.user) {
            return state
          }

          const nextAddresses = [
            address,
            ...state.user.addresses.filter((currentAddress) => currentAddress.id !== address.id),
          ].map((currentAddress) => (address.isDefault ? { ...currentAddress, isDefault: currentAddress.id === address.id } : currentAddress))

          return {
            user: {
              ...state.user,
              addresses: nextAddresses.sort((left, right) => Number(right.isDefault) - Number(left.isDefault)),
            },
          }
        })
      },
      removeAddress: (addressId) => {
        set((state) => {
          if (!state.user) {
            return state
          }

          return {
            user: {
              ...state.user,
              addresses: state.user.addresses.filter((address) => address.id !== addressId),
            },
          }
        })
      },
      setPendingVerification: (pendingVerification) => {
        set({ pendingVerification })
      },
      setHydrated: (hydrated) => {
        set({ hydrated })
      },
      logout: () => {
        const previousUserId = get().user?.id ?? null

        syncAuthCookie('customer', null)
        disconnectRealtimeSocket()
        useCartStore.setState({ items: [], userId: null })

        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('auth-storage')
          window.localStorage.removeItem('token')
          window.localStorage.removeItem('user')
          window.sessionStorage.clear()

          if (previousUserId) {
            window.localStorage.removeItem(`cart_${previousUserId}`)
          }
        }

        set({ user: null, token: null, stats: null, pendingVerification: null, hydrated: true })
      },

      isAuthenticated: () => {
        return !!get().token
      },
    }),
    {
      name: 'auth-storage', // NOTE: Storage key is GLOBAL during login. User-scoped during logout.
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        stats: state.stats,
        pendingVerification: state.pendingVerification,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          if (!isValidJwt(state.token)) {
            state.logout()
            state.setHydrated(true)
            return
          }

          syncAuthCookie('customer', state.token)
        }
        state?.setHydrated(true)
      },
    }
  )
)
