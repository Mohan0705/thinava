'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Clock, Percent, Star, Zap } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import type { Restaurant } from '@/types'
import { cn } from '@/lib/utils'

export function RestaurantCardSkeleton({ layout = 'grid' }: { layout?: 'grid' | 'carousel' }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[1.75rem] border border-[#E5E7EB] bg-white shadow-[0_16px_40px_-24px_rgba(17,24,39,0.2)]',
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
            'overflow-hidden rounded-[1.75rem] border border-white/80 bg-white shadow-[0_18px_42px_-22px_rgba(17,24,39,0.24)] transition-all duration-300',
            'hover:-translate-y-1 hover:shadow-[0_24px_58px_-24px_rgba(255,107,53,0.28)]',
            isUnavailable && 'opacity-80'
          )}
        >
          <div className="relative aspect-[16/10.5] overflow-hidden">
            <Image
              src={restaurant.image}
              alt={restaurant.name}
              fill
              sizes={layout === 'carousel' ? '300px' : '(max-width:768px) 100vw, 33vw'}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/18 to-transparent" />

            <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
              {restaurant.offer ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FF6B35] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
                  <Percent className="h-3 w-3" />
                  {restaurant.offer}
                </span>
              ) : null}
              {!isClosed && !isTemp ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-bold text-[#111827] shadow-sm backdrop-blur-sm">
                  <Zap className="h-3 w-3 text-[#FF6B35]" />
                  {restaurant.deliveryTime}
                </span>
              ) : null}
            </div>

            <div className="absolute right-3 top-3">
              {isTemp ? (
                <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold text-white">
                  Paused
                </span>
              ) : isClosed ? (
                <span className="rounded-full bg-[#1F2937]/90 px-2.5 py-1 text-[10px] font-bold text-white">
                  Closed
                </span>
              ) : (
                <span className="rounded-full bg-[#22C55E] px-2.5 py-1 text-[10px] font-bold text-white">
                  Open
                </span>
              )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 pt-10">
              <div className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/78 backdrop-blur-sm">
                Thinava pick
              </div>
              <h3 className="mt-3 line-clamp-1 text-xl font-black leading-tight tracking-tight text-white drop-shadow-sm">
                {restaurant.name}
              </h3>
              <p className="mt-1 line-clamp-1 text-xs text-white/82">
                {restaurant.cuisines.join(' • ')}
              </p>
            </div>
          </div>

          <div className="space-y-3 px-4 pb-4 pt-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-[#B45309]">
                  <Star className="h-3.5 w-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                  {restaurant.rating}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#6B7280]">
                  <Clock className="h-3.5 w-3.5" />
                  {restaurant.deliveryTime}
                </span>
              </div>
              <span className="text-sm font-bold text-[#111827]">
                {formatPrice(restaurant.priceForOne)}
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
      </Link>
    </motion.article>
  )
}
