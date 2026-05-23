'use client'

import { useEffect } from 'react'
import { Shield, RefreshCw, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'
import { useAdminAuthStore } from '@/features/admin/auth-store'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const logout = useAdminAuthStore((state) => state.logout)

  useEffect(() => {
    console.error('[ADMIN_PAGE_ERROR]', error.message, error.stack)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#121212] px-4">
      <div className="max-w-lg rounded-[2rem] border border-white/10 bg-zinc-900 p-8 text-center shadow-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-400">
          <Shield className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-white">Admin panel error</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Thinava admin encountered an unexpected issue. Your session is safe. Try again or re-authenticate.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={reset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              logout()
              router.replace('/admin/login')
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Back to login
          </Button>
        </div>
        <p className="mt-6 text-xs text-zinc-600">
          Reference: {error.digest || 'N/A'}
        </p>
      </div>
    </div>
  )
}
