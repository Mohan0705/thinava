'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

export function CustomerRouteGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const hydrated = useAuthStore((state) => state.hydrated)

  useEffect(() => {
    if (!hydrated) {
      return
    }

    if (!token) {
      const currentQuery =
        typeof window !== 'undefined' ? window.location.search : ''
      const next = currentQuery ? `${pathname || ''}${currentQuery}` : (pathname || '')
      router.replace(`/login?next=${encodeURIComponent(next)}`)
    }
  }, [hydrated, pathname, router, token])

  if (!hydrated || !token || !user) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="rounded-[30px] border border-orange-100 bg-white px-6 py-8 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-pulse rounded-2xl bg-orange-200" />
          <p className="mt-4 text-sm font-medium text-slate-600">Checking your Thinava session...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
