'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function SectionHeading({
  title,
  subtitle,
  action,
  className,
  light,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
  light?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className={cn('mb-4 flex items-end justify-between gap-4', className)}
    >
      <div>
        <h2
          className={cn(
            'text-lg font-bold tracking-tight md:text-xl',
            light ? 'text-white' : 'text-[#111827]'
          )}
        >
          {title}
        </h2>
        {subtitle ? (
          <p className={cn('mt-0.5 text-sm', light ? 'text-white/70' : 'text-[#6B7280]')}>{subtitle}</p>
        ) : null}
      </div>
      {action}
    </motion.div>
  )
}