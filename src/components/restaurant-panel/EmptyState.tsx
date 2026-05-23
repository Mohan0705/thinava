import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/Card'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <Card className="border border-dashed border-slate-300 bg-white/80">
      <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="rounded-full bg-orange-100 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-orange-700">
          Ready for setup
        </div>
        <h3 className="text-2xl font-semibold text-slate-950">{title}</h3>
        <p className="max-w-md text-sm text-slate-500">{description}</p>
        {action}
      </CardContent>
    </Card>
  )
}
