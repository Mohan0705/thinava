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
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <Card className="overflow-hidden border border-white/70 bg-white/90 shadow-[0_24px_80px_-45px_rgba(234,88,12,0.55)]">
        <CardContent className="relative p-6">
          <div className={`absolute inset-x-0 top-0 h-1.5 ${accent}`} />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <p className="mt-3 text-3xl font-bold text-slate-950">{value}</p>
              <p className="mt-2 text-sm text-slate-500">{delta}</p>
            </div>
            <div className={`rounded-2xl p-3 text-white shadow-lg ${accent}`}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
