'use client'

import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle, Clock, ImageIcon } from 'lucide-react'
import { getOptimizedCloudinaryImageUrl } from '@/lib/cloudinary-image'

type RestaurantStatus = 'OPEN' | 'TEMPORARILY_UNAVAILABLE' | 'CLOSED'

interface RestaurantStatusBadgeProps {
  status: RestaurantStatus
  animated?: boolean
}

export function RestaurantStatusBadge({ status, animated = true }: RestaurantStatusBadgeProps) {
  const statusConfig = {
    OPEN: {
      bg: 'bg-green-100',
      border: 'border-green-200',
      text: 'text-green-700',
      icon: CheckCircle,
      label: 'Open',
      dotColor: 'bg-green-500'
    },
    TEMPORARILY_UNAVAILABLE: {
      bg: 'bg-amber-100',
      border: 'border-amber-200',
      text: 'text-amber-700',
      icon: Clock,
      label: 'Temporarily Unavailable',
      dotColor: 'bg-amber-500'
    },
    CLOSED: {
      bg: 'bg-red-100',
      border: 'border-red-200',
      text: 'text-red-700',
      icon: AlertCircle,
      label: 'Closed',
      dotColor: 'bg-red-500'
    }
  }

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <motion.div
      initial={animated ? { opacity: 0, scale: 0.95 } : undefined}
      animate={animated ? { opacity: 1, scale: 1 } : undefined}
      transition={{ duration: 0.3 }}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${config.bg} ${config.border}`}
    >
      <motion.div
        animate={status === 'OPEN' ? { scale: [1, 1.2, 1] } : undefined}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`} />
      </motion.div>
      <div className="flex items-center gap-1.5">
        <Icon className={`w-4 h-4 ${config.text}`} />
        <span className={`text-sm font-medium ${config.text}`}>{config.label}</span>
      </div>
    </motion.div>
  )
}

// ============================================================
// Restaurant Card with Real-time Status
// ============================================================

interface RestaurantCardProps {
  id: string
  name: string
  image: string
  status: RestaurantStatus
  rating: number
  deliveryTime: string
  cuisines: string[]
  onStatusChange?: (status: RestaurantStatus) => void
}

export function RestaurantCardWithStatus({
  id,
  name,
  image,
  status,
  rating,
  deliveryTime,
  cuisines,
  onStatusChange
}: RestaurantCardProps) {
  const imageUrl = getOptimizedCloudinaryImageUrl(image, { width: 640, height: 360, crop: 'fill' })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: status === 'CLOSED' ? 0.5 : 1, y: 0 }}
      className={`relative rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition ${
        status === 'CLOSED' ? 'opacity-50 grayscale' : ''
      }`}
    >
      {/* Image */}
      <div className="relative h-40 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-orange-50 text-orange-500">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}

        {/* Status Overlay */}
        {status !== 'OPEN' && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <RestaurantStatusBadge status={status} animated={true} />
          </div>
        )}

        {/* Rating Badge */}
        <div className="absolute top-3 right-3 bg-white rounded-lg px-2.5 py-1.5 shadow-lg flex items-center gap-1">
          <span className="text-sm font-bold text-gray-800">⭐ {rating}</span>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-bold text-gray-800">{name}</h3>
            <p className="text-xs text-gray-500 mt-1">{cuisines.join(', ')}</p>
          </div>
        </div>

        {/* Status Badge - if not open */}
        {status !== 'OPEN' && (
          <div className="mb-3">
            <RestaurantStatusBadge status={status} animated={true} />
          </div>
        )}

        {/* Delivery Info */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">⏱ {deliveryTime}</span>
          {status === 'OPEN' ? (
            <span className="text-green-600 font-medium">View Menu</span>
          ) : (
            <span className="text-gray-400 font-medium">Unavailable</span>
          )}
        </div>

        {/* Disabled State - if not open */}
        {status !== 'OPEN' && (
          <button
            disabled
            className="w-full mt-3 bg-gray-200 text-gray-500 py-2 rounded-lg font-medium cursor-not-allowed"
          >
            Cannot Order
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ============================================================
// Real-time Status Display for Admin/Restaurant
// ============================================================

export function RestaurantStatusControl({
  currentStatus,
  onStatusChange,
  isLoading
}: {
  currentStatus: RestaurantStatus
  onStatusChange: (status: RestaurantStatus) => Promise<void>
  isLoading: boolean
}) {
  const statusOptions: RestaurantStatus[] = ['OPEN', 'TEMPORARILY_UNAVAILABLE', 'CLOSED']

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg">
      <h3 className="font-bold text-lg mb-4">Restaurant Status</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {statusOptions.map((status) => (
          <motion.button
            key={status}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onStatusChange(status)}
            disabled={isLoading}
            className={`p-4 rounded-lg font-medium transition ${
              currentStatus === status
                ? 'bg-orange-500 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } disabled:opacity-50`}
          >
            <RestaurantStatusBadge status={status} animated={false} />
          </motion.button>
        ))}
      </div>

      {isLoading && (
        <p className="text-sm text-gray-500 mt-3 animate-pulse">
          Updating status...
        </p>
      )}
    </div>
  )
}
