'use client'

import { useEffect } from 'react'
import { adminApi } from '@/features/admin/api'
import { useAdminAuthStore } from '@/features/admin/auth-store'

export function AdminAuthBootstrap() {
  const hydrated = useAdminAuthStore((state) => state.hydrated)
  const token = useAdminAuthStore((state) => state.token)
  const admin = useAdminAuthStore((state) => state.admin)
  const setAdmin = useAdminAuthStore((state) => state.setAdmin)
  const logout = useAdminAuthStore((state) => state.logout)

  useEffect(() => {
    if (!hydrated || !token || admin) {
      return
    }

    let cancelled = false

    const restoreAdmin = async () => {
      try {
        const response = await adminApi.getProfile(token)
        if (!cancelled) {
          setAdmin(response.admin)
        }
      } catch {
        if (!cancelled) {
          logout()
        }
      }
    }

    void restoreAdmin()

    return () => {
      cancelled = true
    }
  }, [admin, hydrated, logout, setAdmin, token])

  return null
}
