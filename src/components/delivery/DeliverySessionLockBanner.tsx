'use client'

import { useDeliveryAuthStore } from '@/store/deliveryAuthStore'
import { AlertTriangle, Navigation } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

export function DeliverySessionLockBanner() {
  const partner = useDeliveryAuthStore((state) => state.partner)
  
  // If the rider does not have an active order, don't show the banner
  if (!partner || !partner.current_order_id) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-50 bg-rose-600 shadow-[0_4px_20px_-4px_rgba(225,29,72,0.4)] backdrop-blur-md px-4 py-2 flex items-center justify-between"
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="bg-white/20 p-1.5 rounded-full shrink-0">
            <AlertTriangle className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-white">
            <span className="font-semibold tracking-wide">Active Order in Progress</span>
            <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-white/40" />
            <span className="opacity-90 text-xs sm:text-sm">Going offline or logging out is disabled until delivery completes.</span>
          </div>
        </div>

        <Link href="/delivery/active-order" className="shrink-0">
          <button className="bg-white text-rose-600 hover:bg-rose-50 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm transition-colors">
            <Navigation className="w-3 h-3" />
            <span>View Order</span>
          </button>
        </Link>
      </motion.div>
    </AnimatePresence>
  )
}
