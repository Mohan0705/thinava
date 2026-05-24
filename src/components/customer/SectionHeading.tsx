'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function SectionHeading({
  title,
  subtitle,
  action,
  className,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className={cn('mb-5 flex items-end justify-between gap-4', className)}
    >
      <div>
        <h2 className="thinava-section-title">{title}</h2>
        {subtitle ? <p className="thinava-section-subtitle">{subtitle}</p> : null}
      </div>
      {action}
    </motion.div>
  )
}