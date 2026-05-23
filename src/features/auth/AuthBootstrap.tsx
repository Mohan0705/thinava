'use client'

import { useEffect } from 'react'
import { customerAuthApi } from '@/features/auth/api'
import { useAuthStore } from '@/store/authStore'

export function AuthBootstrap() {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const stats = useAuthStore((state) => state.stats)
  const hydrated = useAuthStore((state) => state.hydrated)
  const setAuth = useAuthStore((state) => state.setAuth)
  const logout = useAuthStore((state) => state.logout)

  useEffect(() => {
    if (!hydrated || !token) {
      return
    }

    if (user && user.addresses.length > 0 && stats) {
      return
    }

    let cancelled = false

    const loadProfile = async () => {
      try {
        const profile = await customerAuthApi.getProfile(token)
        if (!cancelled) {
          setAuth(profile.user, token, profile.stats)
        }
      } catch {
        if (!cancelled) {
          logout()
        }
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [hydrated, logout, setAuth, stats, token, user])

  return null
}
