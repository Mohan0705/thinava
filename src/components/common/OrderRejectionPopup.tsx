'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, RefreshCw, Home, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface OrderRejectionPopupProps {
  isOpen: boolean
  orderId: string
  reason: string
  refundMessage: string
  onClose: () => void
  onRetry: () => void
}

export function OrderRejectionPopup({
  isOpen,
  orderId,
  reason,
  refundMessage,
  onClose,
  onRetry
}: OrderRejectionPopupProps) {
  const router = useRouter()
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true)
      // Auto-dismiss after 10 seconds
      const timer = setTimeout(() => {
        handleClose()
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleClose = () => {
    setIsAnimating(false)
    onClose()
  }

  const handleRetry = () => {
    handleClose()
    onRetry()
    router.push('/restaurants')
  }

  const handleGoHome = () => {
    handleClose()
    router.push('/')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={handleClose}
          />

          {/* Popup */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            {/* Card */}
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
              {/* Header - Red accent */}
              <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: [0, -10, 10, -10, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
                  >
                    <AlertCircle className="w-6 h-6 text-white" />
                  </motion.div>
                  <h2 className="text-white font-bold text-lg">Order Cancelled</h2>
                </div>
                <button
                  onClick={handleClose}
                  className="text-white hover:bg-red-700 p-1 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-6 space-y-4">
                {/* Message */}
                <div>
                  <p className="text-lg font-semibold text-gray-800">
                    Sorry! Your order was cancelled by the restaurant.
                  </p>
                </div>

                {/* Reason */}
                {reason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800 font-medium mb-1">Reason:</p>
                    <p className="text-sm text-red-700">{reason}</p>
                  </div>
                )}

                {/* Refund Info */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800">
                    ✓ <span className="font-medium">{refundMessage}</span>
                  </p>
                </div>

                {/* Order ID */}
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Order ID</p>
                  <p className="text-sm font-mono text-gray-600 bg-gray-100 p-2 rounded">
                    {orderId?.substring(0, 8).toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 space-y-3">
                <button
                  onClick={handleRetry}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Try Another Restaurant
                </button>

                <button
                  onClick={handleGoHome}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Home className="w-5 h-5" />
                  Go to Home
                </button>

                <p className="text-xs text-gray-500 text-center">
                  This message will close automatically in 10 seconds
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
