'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SUPPORT_TEL } from '@/lib/support'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fffaf5] px-4">
      <div className="max-w-lg rounded-[32px] border border-orange-100 bg-white p-8 text-center shadow-[0_30px_80px_-40px_rgba(249,115,22,0.35)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-orange-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-3xl font-bold text-slate-950">Something went wrong</h1>
        <p className="mt-3 text-sm text-slate-600">
          Thinava hit an unexpected issue, but your session and data are safe. Try the page again or reach support if it keeps happening.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.location.href = SUPPORT_TEL
            }}
          >
            Call support
          </Button>
        </div>
      </div>
    </div>
  )
}
