'use client'

import { AlertTriangle, Loader } from 'lucide-react'
import { cn } from '@/lib/utils'

export function MapLoading({
  className,
  label = 'Loading map',
}: {
  className?: string
  label?: string
}) {
  return (
    <div className={cn('thinava-map-shell flex items-center justify-center bg-slate-950', className)}>
      <div className="text-center text-white">
        <Loader className="mx-auto h-6 w-6 animate-spin text-orange-300" />
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/60">{label}</p>
      </div>
    </div>
  )
}

export function MapFallback({
  className,
  message = 'Map tiles are unavailable right now. You can still choose a location manually.',
}: {
  className?: string
  message?: string
}) {
  return (
    <div className={cn('thinava-map-shell flex items-center justify-center bg-slate-950 px-5', className)}>
      <div className="max-w-sm text-center text-white">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-300/20 bg-orange-500/10 text-orange-200">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-semibold text-white">OpenStreetMap unavailable</p>
        <p className="mt-1 text-sm text-white/65">{message}</p>
      </div>
    </div>
  )
}

