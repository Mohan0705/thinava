'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ChevronLeft, Sparkles } from 'lucide-react'

export function AuthScreenShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string
  title: string
  description: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff7ed_0%,#fff4f0_38%,#fff_100%)]">
      <div className="absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.28),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(239,68,68,0.15),_transparent_32%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-5 pb-8 pt-6">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-orange-100 bg-white shadow-sm"
          >
            <ChevronLeft className="h-5 w-5 text-slate-700" />
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-orange-700 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Thinava
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-600">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-auto rounded-[34px] border border-white/80 bg-white/95 p-6 shadow-[0_35px_100px_-60px_rgba(234,88,12,0.75)]"
        >
          {children}
        </motion.div>

        {footer ? <div className="mt-6 text-center text-sm text-slate-500">{footer}</div> : null}
      </div>
    </div>
  )
}
