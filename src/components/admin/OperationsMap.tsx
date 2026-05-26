'use client'

import { useMemo } from 'react'
import { AdminZoneMap } from '@/components/maps/AdminZoneMap'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { LiveMapPayload } from '@/features/admin/types'

export function OperationsMap({
  data,
  title = 'Live Operations Map',
  compact = false,
}: {
  data: LiveMapPayload
  title?: string
  compact?: boolean
}) {
  const stats = useMemo(
    () => ({
      riders: data.riders.length,
      deliveries: data.deliveries.length,
      hotspots: data.hotspots.length,
    }),
    [data]
  )

  return (
    <Card className="border border-white/70 bg-white/90">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Dispatch-style live view for rider positions, route flow, restaurant clusters, and hotspot intensity.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          Tadepalligudem
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative overflow-hidden rounded-[28px] border border-orange-100">
          <AdminZoneMap data={data} className={compact ? 'h-[360px]' : 'h-[520px]'} />

          <div className="pointer-events-none absolute bottom-4 left-4 right-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Riders</div>
              <div className="mt-1 text-2xl font-bold text-slate-950">{stats.riders}</div>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Active Routes</div>
              <div className="mt-1 text-2xl font-bold text-slate-950">{stats.deliveries}</div>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Busy Zones</div>
              <div className="mt-1 text-2xl font-bold text-slate-950">{stats.hotspots}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

