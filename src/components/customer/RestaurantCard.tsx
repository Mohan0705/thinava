'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Clock, MapPin, Percent, Star } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { formatPrice } from '@/lib/utils'
import type { Restaurant } from '@/types'
import { cn } from '@/lib/utils'

export function RestaurantCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="thinava-shimmer h-44 w-full rounded-none md:h-48" />
      <CardContent className="space-y-3 p-4">
        <div className="thinava-shimmer h-5 w-3/5 rounded-lg" />
        <div className="thinava-shimmer h-4 w-2/5 rounded-lg" />
        <div className="flex gap-2">
          <div className="thinava-shimmer h-6 w-14 rounded-full" />
          <div className="thinava-shimmer h-6 w-16 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}

export function RestaurantCard({
  restaurant,
  index = 0,
  className,
}: {
  restaurant: Restaurant
  index?: number
  className?: string
}) {
  const isTemp = restaurant.status === 'TEMPORARILY_UNAVAILABLE'
  const isClosed = restaurant.status === 'CLOSED' || !restaurant.isOpen
  const isUnavailable = isTemp || isClosed

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      viewport={{ once: true }}
      className={className}
    >
      <Link href={`/restaurant/${restaurant.id}`} className="group block">
        <Card
          className={cn(
            'overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover',
            isUnavailable && 'opacity-70'
          )}
        >
          <div className="relative h-44 overflow-hidden md:h-48">
            <Image
              src={restaurant.image}
              alt={restaurant.name}
              width={480}
              height={280}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

            {restaurant.offer ? (
              <Badge className="absolute left-3 top-3 border-0 shadow-sm">
                <Percent className="mr-1 h-3 w-3" />
                {restaurant.offer}
              </Badge>
            ) : null}

            <div className="absolute right-3 top-3">
              {isTemp ? (
                <span className="rounded-full bg-amber-500/95 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                  Paused
                </span>
              ) : isClosed ? (
                <span className="rounded-full bg-gray-800/90 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                  Closed
                </span>
              ) : (
                <span className="rounded-full bg-thinava-success/95 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                  Open
                </span>
              )}
            </div>

            <div className="absolute bottom-3 left-3 right-3">
              <h3 className="line-clamp-1 text-lg font-bold text-white drop-shadow-sm">
                {restaurant.name}
              </h3>
            </div>
          </div>

          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 font-semibold text-thinava-rating">
                <Star className="h-3.5 w-3.5 fill-thinava-rating text-thinava-rating" />
                {restaurant.rating}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-gray-400" />
                {restaurant.deliveryTime}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                {formatPrice(restaurant.priceForOne)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {restaurant.cuisines.slice(0, 3).map((cuisine) => (
                <Badge key={cuisine} variant="outline" className="text-[11px] font-medium">
                  {cuisine}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}