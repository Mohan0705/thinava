'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { SUPPORT_TEL } from '@/lib/support'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="max-w-lg rounded-[32px] border border-white/10 bg-white/5 p-8 text-center shadow-[0_35px_80px_-40px_rgba(15,23,42,0.8)] backdrop-blur">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/15 text-orange-200">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-3xl font-bold">Thinava needs a quick reset</h1>
          <p className="mt-3 text-sm text-white/70">
            A global application error interrupted this session. Refresh the page, then call support if the issue keeps repeating.
          </p>
          <a
            href={SUPPORT_TEL}
            className="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950"
          >
            Call support
          </a>
        </div>
      </body>
    </html>
  )
}
