'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

type SessionExpiredDetail = {
  scope?: string
  message?: string
}

export function AuthSessionEvents() {
  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      const payload = (event as CustomEvent<SessionExpiredDetail>).detail
      toast.error(payload?.message || 'Your session expired. Please sign in again.')
    }

    window.addEventListener('thinava:session-expired', handleSessionExpired)
    return () => {
      window.removeEventListener('thinava:session-expired', handleSessionExpired)
    }
  }, [])

  return null
}
