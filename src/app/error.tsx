'use client'

import { useEffect } from 'react'
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
    <div className="flex min-h-screen items-center justify-center bg-thinava-bg px-4">
      <div className="max-w-lg rounded-2xl border border-thinava-border bg-white p-8 text-center shadow-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-2xl">
          !
        </div>
        <h1 className="mt-4 text-xl font-bold text-thinava-text">Something went wrong</h1>
        <p className="mt-2 text-sm text-gray-600">
          Thinava hit an unexpected issue. Your session and data are safe. Try again or contact support.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-thinava-primary px-5 text-sm font-semibold text-white transition hover:brightness-105"
          >
            Try again
          </button>
          <a
            href={SUPPORT_TEL}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-thinava-border bg-white px-5 text-sm font-semibold text-thinava-text transition hover:bg-thinava-bg"
          >
            Call support
          </a>
        </div>
      </div>
    </div>
  )
}