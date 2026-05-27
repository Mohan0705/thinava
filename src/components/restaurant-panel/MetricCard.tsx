'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/Card'

export function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint: string
  icon: ReactNode
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border border-white/70 bg-white/95 shadow-[0_16px_44px_-30px_rgba(15,23,42,0.42)] backdrop-blur">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="rounded-xl bg-slate-950 p-2.5 text-white shadow-lg shadow-slate-900/20">
              {icon}
            </div>
            <div className="text-right text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
              Live
            </div>
          </div>
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{value}</div>
          <div className="mt-1 text-xs text-slate-500">{hint}</div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
