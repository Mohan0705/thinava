import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DeliveryPartner, DeliveryAuthSession } from '@/types/delivery'
import { syncAuthCookie, syncLegacyDeliveryToken } from '@/lib/auth/session'

interface DeliveryAuthStore {
  token: string | null
  partner: DeliveryPartner | null
  isLoggedIn: boolean
  hydrated: boolean
  loading: boolean
  error: string | null

  setSession: (session: DeliveryAuthSession) => void
  setPartner: (partner: DeliveryPartner) => void
  setToken: (token: string) => void
  setHydrated: (hydrated: boolean) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  logout: () => void
  clearError: () => void
}

export const useDeliveryAuthStore = create<DeliveryAuthStore>()(
  persist(
    (set) => ({
      token: typeof window !== 'undefined' ? window.localStorage.getItem('delivery_token') : null,
      partner: null,
      isLoggedIn: typeof window !== 'undefined' ? Boolean(window.localStorage.getItem('delivery_token')) : false,
      hydrated: false,
      loading: false,
      error: null,

      setSession: (session) => {
        syncAuthCookie('delivery', session.token)
        syncLegacyDeliveryToken(session.token)
        set({
          token: session.token,
          partner: session.partner,
          isLoggedIn: true,
          error: null,
        })
      },

      setPartner: (partner) => {
        set({ partner })
      },

      setToken: (token) => {
        syncAuthCookie('delivery', token || null)
        syncLegacyDeliveryToken(token || null)
        set({ token, isLoggedIn: !!token })
      },

      setHydrated: (hydrated) => {
        set({ hydrated })
      },

      setLoading: (loading) => {
        set({ loading })
      },

      setError: (error) => {
        set({ error })
      },

      logout: () => {
        syncAuthCookie('delivery', null)
        syncLegacyDeliveryToken(null)
        set({
          token: null,
          partner: null,
          isLoggedIn: false,
          error: null,
        })
      },

      clearError: () => {
        set({ error: null })
      },
    }),
    {
      name: 'delivery-auth-storage',
      partialize: (state) => ({
        token: state.token,
        partner: state.partner,
        isLoggedIn: state.isLoggedIn,
      }),
      onRehydrateStorage: () => (state) => {
        const legacyToken =
          typeof window !== 'undefined' ? window.localStorage.getItem('delivery_token') : null
        const resolvedToken = state?.token || legacyToken

        if (resolvedToken) {
          syncAuthCookie('delivery', resolvedToken)
          syncLegacyDeliveryToken(resolvedToken)
          state?.setToken(resolvedToken)
        }
        state?.setHydrated(true)
      },
    }
  )
)
