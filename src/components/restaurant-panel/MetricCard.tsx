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
      <Card className="border border-white/60 bg-white/90 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.45)] backdrop-blur">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="rounded-2xl bg-slate-950 p-3 text-white shadow-lg shadow-slate-900/20">
              {icon}
            </div>
            <div className="text-right text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
              Live
            </div>
          </div>
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</div>
          <div className="mt-2 text-sm text-slate-500">{hint}</div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
