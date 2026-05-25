'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AdminSession, AdminUser } from '@/features/admin/types'
import { isValidJwt, syncAuthCookie } from '@/lib/auth/session'
import { disconnectRealtimeSocket } from '@/lib/realtime'

interface AdminAuthState {
  token: string | null
  admin: AdminUser | null
  hydrated: boolean
  setSession: (session: AdminSession) => void
  setAdmin: (admin: AdminUser) => void
  setHydrated: (hydrated: boolean) => void
  logout: () => void
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      token: null,
      admin: null,
      hydrated: false,
      setSession: (session) => {
        syncAuthCookie('admin', session.token)
        set({ token: session.token, admin: session.admin })
      },
      setAdmin: (admin) => set({ admin }),
      setHydrated: (hydrated) => set({ hydrated }),
      logout: () => {
        syncAuthCookie('admin', null)
        disconnectRealtimeSocket()
        // SECURITY: Clear old global key for migration
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('thinava-admin-auth')
        }
        set({ token: null, admin: null })
      },
    }),
    {
      name: 'thinava-admin-auth',
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          if (!isValidJwt(state.token)) {
            state.logout()
            state.setHydrated(true)
            return
          }

          syncAuthCookie('admin', state.token)
        }
        state?.setHydrated(true)
      },
    }
  )
)
