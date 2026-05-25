'use client'

import { motion } from 'framer-motion'
import { BackButton } from '@/components/layout/BackButton'

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
    <div className="min-h-screen bg-thinava-bg">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-4 pb-8 pt-5">
        <div className="mb-6 flex items-center justify-between">
          <BackButton className="rounded-xl" />
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg thinava-gradient-bg">
              <span className="text-sm font-bold text-white">T</span>
            </div>
            <span className="text-sm font-bold text-thinava-text">Thinava</span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-thinava-primary">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-thinava-text">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{description}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-thinava-border bg-white p-5 shadow-card"
        >
          {children}
        </motion.div>

        {footer ? <div className="mt-5 text-center text-sm text-gray-500">{footer}</div> : null}
      </div>
    </div>
  )
}
