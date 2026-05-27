import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DeliveryPartner, DeliveryAuthSession } from '@/types/delivery'
import { isValidJwt, syncAuthCookie, syncLegacyDeliveryToken } from '@/lib/auth/session'
import { disconnectRealtimeSocket } from '@/lib/realtime'

interface DeliveryAuthStore {
  token: string | null
  partner: DeliveryPartner | null
  isLoggedIn: boolean
  hydrated: boolean
  loading: boolean
  error: string | null
  
  // Realtime-updated stats (separate from partner object)
  realtimeStats: {
    todayEarnings: number
    todayDeliveries: number
    floatingCash: number
    rating: number
    isOnline: boolean
  }

  setSession: (session: DeliveryAuthSession) => void
  setPartner: (partner: DeliveryPartner) => void
  setToken: (token: string) => void
  setHydrated: (hydrated: boolean) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  logout: () => void
  clearError: () => void
  
  // Realtime stats update methods
  updateTodayEarnings: (amount: number) => void
  updateTodayDeliveries: (count: number) => void
  updateFloatingCash: (amount: number) => void
  updateRating: (rating: number) => void
  updateOnlineStatus: (isOnline: boolean) => void
  syncPartnerStats: (stats: Partial<DeliveryPartner>) => void
  clearActiveDeliverySession: () => void
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
      realtimeStats: {
        todayEarnings: 0,
        todayDeliveries: 0,
        floatingCash: 0,
        rating: 0,
        isOnline: false,
      },

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
        disconnectRealtimeSocket()
        // SECURITY: Clear old global key for migration
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('delivery-auth-storage')
        }
        set({
          token: null,
          partner: null,
          isLoggedIn: false,
          error: null,
          realtimeStats: {
            todayEarnings: 0,
            todayDeliveries: 0,
            floatingCash: 0,
            rating: 0,
            isOnline: false,
          },
        })
      },

      clearError: () => {
        set({ error: null })
      },

      // Realtime stats update methods
      updateTodayEarnings: (amount: number) => {
        set((state) => ({
          realtimeStats: {
            ...state.realtimeStats,
            todayEarnings: amount,
          },
        }))
      },

      updateTodayDeliveries: (count: number) => {
        set((state) => ({
          realtimeStats: {
            ...state.realtimeStats,
            todayDeliveries: count,
          },
        }))
      },

      updateFloatingCash: (amount: number) => {
        set((state) => ({
          realtimeStats: {
            ...state.realtimeStats,
            floatingCash: amount,
          },
        }))
      },

      updateRating: (rating: number) => {
        set((state) => ({
          realtimeStats: {
            ...state.realtimeStats,
            rating: rating,
          },
        }))
      },

      updateOnlineStatus: (isOnline: boolean) => {
        set((state) => ({
          realtimeStats: {
            ...state.realtimeStats,
            isOnline: isOnline,
          },
        }))
      },

      syncPartnerStats: (stats: Partial<DeliveryPartner>) => {
        set((state) => {
          const updates: any = {}
          
          // Update realtimeStats if relevant fields are in the incoming stats
          if ('total_deliveries' in stats) {
            updates.realtimeStats = {
              ...state.realtimeStats,
              todayDeliveries: stats.total_deliveries,
            }
          }
          
          if ('average_rating' in stats) {
            updates.realtimeStats = {
              ...updates.realtimeStats || state.realtimeStats,
              rating: stats.average_rating,
            }
          }
          
          if ('cash_in_hand' in stats) {
            updates.realtimeStats = {
              ...updates.realtimeStats || state.realtimeStats,
              floatingCash: stats.cash_in_hand,
            }
          }
          
          if ('is_online' in stats) {
            updates.realtimeStats = {
              ...updates.realtimeStats || state.realtimeStats,
              isOnline: stats.is_online,
            }
          }
          
          // Update partner if it exists
          if (state.partner) {
            updates.partner = {
              ...state.partner,
              ...stats,
            }
          }
          
          return updates
        })
      },

      clearActiveDeliverySession: () => {
        console.log('[RIDER_STATE_RESET]', {
          source: 'deliveryAuthStore',
          timestamp: new Date().toISOString(),
        })
        set((state) => ({
          partner: state.partner
            ? {
              ...state.partner,
                current_order_id: undefined,
                current_status: state.partner.is_online ? 'AVAILABLE' : 'OFFLINE',
              }
            : null,
          realtimeStats: {
            ...state.realtimeStats,
            isOnline: Boolean(state.partner?.is_online ?? state.realtimeStats.isOnline),
          },
        }))
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
          if (!isValidJwt(resolvedToken)) {
            state?.logout()
            state?.setHydrated(true)
            return
          }

          syncAuthCookie('delivery', resolvedToken)
          syncLegacyDeliveryToken(resolvedToken)
          state?.setToken(resolvedToken)
        }
        state?.setHydrated(true)
      },
    }
  )
)
