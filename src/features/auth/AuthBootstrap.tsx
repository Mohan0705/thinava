'use client'

import { useEffect, useRef } from 'react'
import { ApiError } from '@/lib/api'
import { customerAuthApi } from '@/features/auth/api'
import { useAuthStore } from '@/store/authStore'

export function AuthBootstrap() {
  const token = useAuthStore((state) => state.token)
  const hydrated = useAuthStore((state) => state.hydrated)
  const setAuth = useAuthStore((state) => state.setAuth)
  const logout = useAuthStore((state) => state.logout)
  const fetchedTokenRef = useRef<string | null>(null)

  useEffect(() => {
    if (!hydrated) {
      return
    }

    if (!token) {
      fetchedTokenRef.current = null
      return
    }

    if (fetchedTokenRef.current === token) {
      return
    }

    let cancelled = false
    fetchedTokenRef.current = token

    const loadProfile = async () => {
      try {
        const profile = await customerAuthApi.getProfile(token)
        if (!cancelled) {
          setAuth(profile.user, token, profile.stats)
        }
      } catch (error) {
        if (!cancelled && error instanceof ApiError && error.status >= 400 && error.status < 500) {
          logout()
        }
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [hydrated, logout, setAuth, token])

  return null
}
