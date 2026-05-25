'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Phone, User, Truck, Clock, Navigation } from 'lucide-react'
import { getOptimizedCloudinaryImageUrl } from '@/lib/cloudinary-image'

interface RiderLocation {
  latitude: number
  longitude: number
  accuracy?: number
  speed?: number
  timestamp: Date
}

interface RiderTrackingProps {
  orderId: string
  riderId: string
  riderName: string
  riderPhone: string
  riderImage?: string
  vehicleType: string
  vehicleNumber: string
  pickupLocation: { lat: number; lon: number }
  deliveryLocation: { lat: number; lon: number }
  estimatedETA: Date
  onLocationUpdate?: (location: RiderLocation) => void
}

export function RiderTrackingCard({
  orderId,
  riderId,
  riderName,
  riderPhone,
  riderImage,
  vehicleType,
  vehicleNumber,
  pickupLocation,
  deliveryLocation,
  estimatedETA,
  onLocationUpdate
}: RiderTrackingProps) {
  const [riderLocation, setRiderLocation] = useState<RiderLocation | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [eta, setEta] = useState<string>('')
  const riderImageUrl = getOptimizedCloudinaryImageUrl(riderImage || '', {
    width: 160,
    height: 160,
    crop: 'fill',
  })

  useEffect(() => {
    // Calculate distance between rider and delivery location
    if (riderLocation) {
      const dist = calculateDistance(
        riderLocation.latitude,
        riderLocation.longitude,
        deliveryLocation.lat,
        deliveryLocation.lon
      )
      setDistance(dist)

      // Estimate time (assuming 20 km/h average)
      const estimatedMinutes = Math.ceil((dist / 20) * 60)
      setEta(`${estimatedMinutes} mins away`)
    }
  }, [riderLocation, deliveryLocation])

  // Mock location update (in real app, this would come from Socket.IO)
  useEffect(() => {
    const interval = setInterval(() => {
      const mockLocation: RiderLocation = {
        latitude: deliveryLocation.lat + (Math.random() - 0.5) * 0.01,
        longitude: deliveryLocation.lon + (Math.random() - 0.5) * 0.01,
        speed: Math.random() * 30,
        timestamp: new Date()
      }
      setRiderLocation(mockLocation)
      onLocationUpdate?.(mockLocation)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-xl overflow-hidden"
    >
      {/* Header with delivery progress */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
        <h3 className="font-bold text-lg mb-2">Rider on the Way</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-100 text-sm">Estimated arrival</p>
            <p className="text-2xl font-bold">{eta || 'Calculating...'}</p>
          </div>
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Navigation className="w-12 h-12" />
          </motion.div>
        </div>
      </div>

      {/* Rider Details */}
      <div className="p-6 space-y-4">
        {/* Rider Info */}
        <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
          <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
            {riderImageUrl ? (
              <img src={riderImageUrl} alt={riderName} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-orange-100">
                <User className="w-6 h-6 text-orange-600" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-gray-800">{riderName}</h4>
            <p className="text-sm text-gray-600 flex items-center gap-1">
              <Truck className="w-4 h-4" />
              {vehicleType} • {vehicleNumber}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.href = `tel:${riderPhone}`}
            className="bg-orange-100 text-orange-600 p-3 rounded-full hover:bg-orange-200 transition"
          >
            <Phone className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Live Tracking Map Placeholder */}
        <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Live Map</p>
              <p className="text-xs text-gray-400 mt-1">
                {riderLocation ? `${distance?.toFixed(2)} km away` : 'Loading location...'}
              </p>
            </div>
          </div>

          {/* Animated rider marker */}
          {riderLocation && (
            <motion.div
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute w-6 h-6 bg-orange-500 rounded-full left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 shadow-lg"
            >
              <div className="absolute inset-0 bg-orange-500 rounded-full animate-pulse" />
            </motion.div>
          )}
        </div>

        {/* Tracking Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-xs text-blue-600 font-medium mb-1">Distance</p>
            <p className="text-lg font-bold text-blue-700">
              {distance?.toFixed(2) || '—'} km
            </p>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <p className="text-xs text-green-600 font-medium mb-1">Speed</p>
            <p className="text-lg font-bold text-green-700">
              {riderLocation?.speed?.toFixed(1) || '—'} km/h
            </p>
          </div>
        </div>

        {/* Live Status */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
          </motion.div>
          <span>Rider is live tracking enabled</span>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-lg font-medium hover:shadow-lg transition"
        >
          Open Live Map
        </motion.button>
      </div>
    </motion.div>
  )
}

// ============================================================
// Helper Functions
// ============================================================

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180)
}

// ============================================================
// Active Order Banner (for Rider App)
// ============================================================

interface ActiveOrderBannerProps {
  orderId: string
  restaurantName: string
  customerName: string
  eta: string
  distance: number
  payout: number
  onResume: () => void
}

export function RiderActiveOrderBanner({
  orderId,
  restaurantName,
  customerName,
  eta,
  distance,
  payout,
  onResume
}: ActiveOrderBannerProps) {
  return (
    <motion.div
      initial={{ x: -400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="fixed bottom-6 left-6 right-6 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl shadow-2xl p-4 md:max-w-md"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-orange-100 mb-1">
            Ongoing Delivery
          </p>
          <h4 className="font-bold text-lg">{restaurantName}</h4>
          <p className="text-xs text-orange-100 mt-1">
            {distance.toFixed(1)} km • {eta}
          </p>
        </div>

        <div className="text-right mr-4">
          <p className="text-xs text-orange-100">Payout</p>
          <p className="text-lg font-bold">₹{payout}</p>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onResume}
          className="bg-white text-orange-600 px-4 py-2 rounded-lg font-bold hover:bg-orange-50 transition"
        >
          Resume
        </motion.button>
      </div>
    </motion.div>
  )
}
