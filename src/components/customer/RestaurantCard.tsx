'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Clock, Percent, Star, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { formatPrice } from '@/lib/utils'
import type { Restaurant } from '@/types'
import { cn } from '@/lib/utils'

export function RestaurantCardSkeleton({ layout = 'grid' }: { layout?: 'grid' | 'carousel' }) {
  const shell = (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_8px_30px_-12px_rgba(17,24,39,0.15)]',
        layout === 'carousel' && 'w-[min(82vw,300px)] shrink-0 snap-start'
      )}
    >
      <div className="thinava-shimmer aspect-[16/10] w-full" />
      <div className="space-y-2.5 p-3.5">
        <div className="thinava-shimmer h-5 w-3/5 rounded-lg" />
        <div className="thinava-shimmer h-4 w-2/5 rounded-lg" />
      </div>
    </div>
  )
  return shell
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

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      viewport={{ once: true }}
      className={cn(layout === 'carousel' && 'w-[min(82vw,300px)] shrink-0 snap-start', className)}
    >
      <Link href={`/restaurant/${restaurant.id}`} className="group block thinava-touch">
        <div
          className={cn(
            'overflow-hidden rounded-2xl border border-[#E5E7EB]/80 bg-white shadow-[0_10px_40px_-14px_rgba(17,24,39,0.18)] transition-all duration-300',
            'hover:-translate-y-1 hover:shadow-[0_20px_50px_-16px_rgba(255,107,53,0.28)]',
            isUnavailable && 'opacity-75'
          )}
        >
          <div className="relative aspect-[16/10] overflow-hidden">
            <Image
              src={restaurant.image}
              alt={restaurant.name}
              fill
              sizes={layout === 'carousel' ? '300px' : '(max-width:768px) 100vw, 33vw'}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

            <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
              {restaurant.offer ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-[#FF6B35] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
                  <Percent className="h-3 w-3" />
                  {restaurant.offer}
                </span>
              ) : null}
              {!isClosed && !isTemp ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/95 px-2 py-1 text-[10px] font-bold text-[#111827] shadow-sm backdrop-blur-sm">
                  <Zap className="h-3 w-3 text-[#FF6B35]" />
                  {restaurant.deliveryTime}
                </span>
              ) : null}
            </div>

            <div className="absolute right-3 top-3">
              {isTemp ? (
                <span className="rounded-lg bg-amber-500 px-2 py-1 text-[10px] font-bold text-white">Paused</span>
              ) : isClosed ? (
                <span className="rounded-lg bg-[#1F2937]/90 px-2 py-1 text-[10px] font-bold text-white">Closed</span>
              ) : (
                <span className="rounded-lg bg-[#22C55E] px-2 py-1 text-[10px] font-bold text-white">Open</span>
              )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-3.5 pt-8">
              <h3 className="line-clamp-1 text-lg font-bold leading-tight text-white drop-shadow-sm">
                {restaurant.name}
              </h3>
              <p className="mt-0.5 line-clamp-1 text-xs text-white/80">{restaurant.cuisines.join(' · ')}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-[#B45309]">
                <Star className="h-3.5 w-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                {restaurant.rating}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#6B7280]">
                <Clock className="h-3.5 w-3.5" />
                {restaurant.deliveryTime}
              </span>
            </div>
            <span className="text-xs font-semibold text-[#111827]">{formatPrice(restaurant.priceForOne)}</span>
          </div>
        </div>
      </Link>
    </motion.article>
  )
}