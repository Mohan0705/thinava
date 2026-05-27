'use client'

import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { ActivityFeedItem } from '@/features/admin/types'

const severityClasses: Record<ActivityFeedItem['severity'], string> = {
  info: 'bg-sky-100 text-sky-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-rose-100 text-rose-700',
}

const severityIcons = {
  info: Activity,
  warning: AlertTriangle,
  critical: CheckCircle2,
}

export function RealtimeFeed({ items }: { items: ActivityFeedItem[] }) {
  return (
    <Card className="border border-white/70 bg-white/90">
      <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
        <CardTitle className="text-lg">Realtime Activity Feed</CardTitle>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Live
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        {items.map((item) => {
          const Icon = severityIcons[item.severity]
          return (
            <div key={item.id} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <div className={`mt-0.5 rounded-lg p-2 ${severityClasses[item.severity]}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{item.type}</p>
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {new Date(item.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{item.description}</p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
