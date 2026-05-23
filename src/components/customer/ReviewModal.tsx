'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, MessageSquare, X, CheckCircle2, UtensilsCrossed, Bike } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { API_BASE_URL } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'

interface ReviewModalProps {
  isOpen: boolean
  onClose: () => void
  orderId: string
  restaurantId: string
  restaurantName: string
  riderId?: string
  riderName?: string
  onSuccess?: () => void
}

type RatingTab = 'restaurant' | 'rider' | 'review'

export default function ReviewModal({
  isOpen,
  onClose,
  orderId,
  restaurantId,
  restaurantName,
  riderId,
  riderName,
  onSuccess,
}: ReviewModalProps) {
  const token = useAuthStore((state) => state.token)
  const [activeTab, setActiveTab] = useState<RatingTab>('restaurant')
  const [restRating, setRestRating] = useState<number>(0)
  const [restComment, setRestComment] = useState<string>('')
  const [foodQuality, setFoodQuality] = useState<number>(0)
  const [riderRating, setRiderRating] = useState<number>(0)
  const [riderComment, setRiderComment] = useState<string>('')
  const [deliverySpeed, setDeliverySpeed] = useState<number>(0)
  const [overallRating, setOverallRating] = useState<number>(0)

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const [hoveredRestStar, setHoveredRestStar] = useState<number>(0)
  const [hoveredFoodStar, setHoveredFoodStar] = useState<number>(0)
  const [hoveredRiderStar, setHoveredRiderStar] = useState<number>(0)
  const [hoveredSpeedStar, setHoveredSpeedStar] = useState<number>(0)
  const [hoveredOverallStar, setHoveredOverallStar] = useState<number>(0)

  const handleSubmit = async () => {
    if (restRating === 0 && riderRating === 0 && overallRating === 0) {
      toast.error('Please provide at least one rating')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${API_BASE_URL}/ratings/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId,
          restaurant_rating: restRating || null,
          rider_rating: riderId ? riderRating : null,
          food_quality: foodQuality || null,
          delivery_speed: riderId ? deliverySpeed : null,
          overall_rating: overallRating || null,
          review_text: restComment || riderComment || null,
          is_anonymous: false,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit review')
      }

      setSuccess(true)
      toast.success('Thank you for your feedback!')
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 1500)
    } catch (err: any) {
      toast.error(err.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const StarRating = ({ value, onChange, hovered, setHovered, size = 'w-7 h-7' }: {
    value: number
    onChange: (v: number) => void
    hovered: number
    setHovered: (v: number) => void
    size?: string
  }) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="p-0.5 hover:scale-110 transition duration-100"
        >
          <Star
            className={`${size} transition-colors ${
              star <= (hovered || value)
                ? 'fill-amber-400 text-amber-400'
                : 'text-slate-200 dark:text-slate-600'
            }`}
          />
        </button>
      ))}
    </div>
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            onClick={onClose}
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl z-10 text-slate-800 dark:text-slate-100"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>

            {success ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center justify-center py-10 text-center"
              >
                <CheckCircle2 className="w-16 h-16 text-green-500 animate-bounce mb-4" />
                <h3 className="text-xl font-bold">Review Submitted!</h3>
                <p className="text-sm text-slate-500 mt-2">Your feedback helps improve Thinava service for Tadepalligudem.</p>
                <p className="text-xs text-slate-400 mt-2">Ratings are now updated across the platform.</p>
              </motion.div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                    Rate Your Experience
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Order ID: {orderId.slice(0, 8)}...</p>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1">
                  <button
                    onClick={() => setActiveTab('restaurant')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'restaurant'
                        ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5" />
                    Food
                  </button>
                  {riderName && (
                    <button
                      onClick={() => setActiveTab('rider')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'rider'
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Bike className="w-3.5 h-3.5" />
                      Rider
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('review')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'review'
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Review
                  </button>
                </div>

                {/* Restaurant Tab */}
                {activeTab === 'restaurant' && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-4"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                        Rate <span className="text-orange-500">{restaurantName}</span>
                      </p>
                      <StarRating
                        value={restRating}
                        onChange={setRestRating}
                        hovered={hoveredRestStar}
                        setHovered={setHoveredRestStar}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                        Food Quality
                      </p>
                      <StarRating
                        value={foodQuality}
                        onChange={setFoodQuality}
                        hovered={hoveredFoodStar}
                        setHovered={setHoveredFoodStar}
                      />
                    </div>
                  </motion.div>
                )}

                {/* Rider Tab */}
                {activeTab === 'rider' && riderName && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-4"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                        Rate Rider: <span className="text-indigo-500">{riderName}</span>
                      </p>
                      <StarRating
                        value={riderRating}
                        onChange={setRiderRating}
                        hovered={hoveredRiderStar}
                        setHovered={setHoveredRiderStar}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                        Delivery Speed
                      </p>
                      <StarRating
                        value={deliverySpeed}
                        onChange={setDeliverySpeed}
                        hovered={hoveredSpeedStar}
                        setHovered={setHoveredSpeedStar}
                      />
                    </div>
                  </motion.div>
                )}

                {/* Review Tab */}
                {activeTab === 'review' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                        Overall Experience
                      </p>
                      <StarRating
                        value={overallRating}
                        onChange={setOverallRating}
                        hovered={hoveredOverallStar}
                        setHovered={setHoveredOverallStar}
                        size="w-8 h-8"
                      />
                    </div>
                    <div className="relative">
                      <MessageSquare className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <Textarea
                        value={restComment}
                        onChange={(e) => setRestComment(e.target.value)}
                        placeholder="Tell us about your experience — food taste, delivery, packaging..."
                        className="pl-10 text-sm bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 rounded-2xl h-24"
                      />
                    </div>
                  </motion.div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-full text-slate-500 hover:text-slate-700"
                    onClick={onClose}
                    disabled={submitting}
                  >
                    Skip
                  </Button>
                  <Button
                    className="flex-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold rounded-full py-2.5 shadow-lg shadow-orange-500/10 disabled:opacity-50"
                    onClick={handleSubmit}
                    disabled={submitting || (restRating === 0 && riderRating === 0 && overallRating === 0)}
                  >
                    {submitting ? 'Submitting...' : 'Submit Review'}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
