'use client'

import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/Card'

export function AdminMetricCard({
  label,
  value,
  delta,
  accent,
  icon: Icon,
}: {
  label: string
  value: string
  delta: string
  accent: string
  icon: LucideIcon
}) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      <Card className="overflow-hidden border border-white/70 bg-white/95 shadow-[0_16px_56px_-42px_rgba(234,88,12,0.52)]">
        <CardContent className="relative p-4">
          <div className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <p className="mt-1.5 text-2xl font-bold text-slate-950">{value}</p>
              <p className="mt-1 text-xs text-slate-500">{delta}</p>
            </div>
            <div className={`rounded-xl p-2.5 text-white shadow-lg ${accent}`}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
