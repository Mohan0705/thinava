'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AdminSession, AdminUser } from '@/features/admin/types'
import { syncAuthCookie } from '@/lib/auth/session'

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
        set({ token: null, admin: null })
      },
    }),
    {
      name: 'thinava-admin-auth',
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          syncAuthCookie('admin', state.token)
        }
        state?.setHydrated(true)
      },
    }
  )
)
