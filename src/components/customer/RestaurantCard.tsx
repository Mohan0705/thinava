'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Clock, ImageIcon, Percent, Star, Zap } from 'lucide-react'
import type { Restaurant } from '@/types'
import { cn } from '@/lib/utils'
import { getOptimizedCloudinaryImageUrl } from '@/lib/cloudinary-image'

export function RestaurantCardSkeleton({ layout = 'grid' }: { layout?: 'grid' | 'carousel' }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[1.4rem] border border-[#E5E7EB] bg-white shadow-[0_14px_34px_-24px_rgba(17,24,39,0.2)]',
        layout === 'carousel' && 'w-[min(82vw,300px)] shrink-0 snap-start'
      )}
    >
      <div className="thinava-shimmer aspect-[16/10] w-full" />
      <div className="space-y-3 p-4">
        <div className="thinava-shimmer h-5 w-3/5 rounded-lg" />
        <div className="thinava-shimmer h-4 w-2/5 rounded-lg" />
        <div className="thinava-shimmer h-9 w-full rounded-2xl" />
      </div>
    </div>
  )
}

export function RestaurantCard({
  restaurant,
  index = 0,
  className,
  layout = 'grid',
}: {
  restaurant: Restaurant
  index?: number
  className?: string
  layout?: 'grid' | 'carousel'
}) {
  const isTemp = restaurant.status === 'TEMPORARILY_UNAVAILABLE'
  const isClosed = restaurant.status === 'CLOSED' || !restaurant.isOpen
  const isUnavailable = isTemp || isClosed
  const ratingText = Number(restaurant.rating || 0).toFixed(1)
  const reviewCount = restaurant.ratingCount ?? 0
  const unavailableLabel = isClosed ? 'Currently Closed' : 'Currently Unavailable'
  const imageUrl = getOptimizedCloudinaryImageUrl(restaurant.image, {
    width: layout === 'carousel' ? 640 : 900,
    crop: 'fill',
  })

  const card = (
    <div
      className={cn(
        'overflow-hidden rounded-[1.4rem] border border-white/80 bg-white shadow-[0_14px_34px_-24px_rgba(17,24,39,0.2)] transition-all duration-300',
        !isUnavailable && 'group-hover:-translate-y-1 group-hover:shadow-[0_22px_48px_-24px_rgba(255,107,53,0.25)]'
      )}
    >
      <div className="relative aspect-[16/10.5] overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={restaurant.name}
            fill
            sizes={layout === 'carousel' ? '300px' : '(max-width:768px) 100vw, 33vw'}
            className={cn(
              'object-cover transition-transform duration-500',
              !isUnavailable && 'group-hover:scale-105',
              isUnavailable && 'scale-[1.02] grayscale-[35%]'
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-orange-50 text-orange-500">
            <ImageIcon className="h-9 w-9" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/48 via-black/8 to-transparent" />

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {restaurant.offer && !isUnavailable ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FF6B35] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
              <Percent className="h-3 w-3" />
              {restaurant.offer}
            </span>
          ) : null}
          {!isUnavailable ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-bold text-[#111827] shadow-sm backdrop-blur-sm">
              <Zap className="h-3 w-3 text-[#FF6B35]" />
              {restaurant.deliveryTime}
            </span>
          ) : null}
        </div>

        <div className="absolute right-3 top-3">
          {!isUnavailable ? (
            <span className="rounded-full bg-[#22C55E] px-2.5 py-1 text-[10px] font-bold text-white">
              Open
            </span>
          ) : null}
        </div>

        {isUnavailable ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/48 backdrop-blur-[1.5px]">
            <span className="rounded-full border border-white/25 bg-white/92 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-900 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.55)]">
              {unavailableLabel}
            </span>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 px-4 pb-4 pt-3">
        <div>
          <h3 className="line-clamp-1 text-lg font-black leading-tight tracking-tight text-[#111827]">
            {restaurant.name}
          </h3>
          {restaurant.cuisines.length > 0 ? (
            <p className="mt-1 line-clamp-1 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              {restaurant.cuisines.join(' / ')}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-[#92400E]">
            <Star className="h-3.5 w-3.5 fill-[#F59E0B] text-[#F59E0B]" />
            {ratingText} ({reviewCount})
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-[#667085]">
            <Clock className="h-3.5 w-3.5" />
            {restaurant.deliveryTime}
          </span>
        </div>

        <div className="rounded-2xl bg-[#FFF8F4] px-3 py-2.5">
          <p className="line-clamp-2 text-sm font-medium leading-6 text-[#4B5563]">
            {restaurant.description ||
              'Fresh delivery from a trusted local kitchen with dependable prep and handoff.'}
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      viewport={{ once: true }}
      className={cn(layout === 'carousel' && 'w-[min(82vw,300px)] shrink-0 snap-start', className)}
    >
      {isUnavailable ? (
        <div className="group cursor-not-allowed" aria-disabled="true">
          {card}
        </div>
      ) : (
        <Link href={`/restaurant/${restaurant.id}`} className="group block thinava-touch">
          {card}
        </Link>
      )}
    </motion.article>
  )
}
