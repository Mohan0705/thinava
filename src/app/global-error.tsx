'use client'

import { useEffect } from 'react'
import { SUPPORT_TEL } from '@/lib/support'

export default function GlobalError({
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
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-thinava-text px-4 font-sans text-white">
        <div className="max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-xl font-bold">Thinava needs a quick reset</h1>
          <p className="mt-2 text-sm text-white/70">
            A global application error interrupted this session. Refresh or try again.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-thinava-primary px-5 text-sm font-semibold text-white"
            >
              Try again
            </button>
            <a
              href={SUPPORT_TEL}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-thinava-text"
            >
              Call support
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}