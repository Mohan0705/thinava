'use client'

import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { SlidersHorizontal, Sparkles } from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import MobileNav from '@/components/layout/MobileNav'
import { categories } from '@/data/categories'
import { fetchRestaurants } from '@/lib/customer-api'
import { getOptimizedCloudinaryImageUrl } from '@/lib/cloudinary-image'
import { Restaurant } from '@/types'
import { useFilterStore } from '@/store/filterStore'
import { HomeActiveOrderCard } from '@/components/customer/HomeActiveOrderCard'
import { HeroBanner } from '@/components/customer/HeroBanner'
import { SectionHeading } from '@/components/customer/SectionHeading'
import { RestaurantCard, RestaurantCardSkeleton } from '@/components/customer/RestaurantCard'

const RATING_FILTERS = [3.5, 4.0, 4.5]

const FILTER_CHIPS = [
  'Previously Ordered',
  'Pure Veg',
  'Non Veg',
  'Fast Delivery',
  'Under Rs99',
  'Under Rs199',
  'Best Rated',
] as const

type FilterChip = (typeof FILTER_CHIPS)[number]

const isLikelyVegRestaurant = (restaurant: Restaurant) => {
  const content = [restaurant.name, restaurant.description || '', ...restaurant.cuisines]
    .join(' ')
    .toLowerCase()

  return /\b(pure veg|veg|vegetarian)\b/.test(content) && !/\b(non veg|non-veg|chicken|mutton|fish|egg)\b/.test(content)
}

const isLikelyNonVegRestaurant = (restaurant: Restaurant) => {
  const content = [restaurant.name, restaurant.description || '', ...restaurant.cuisines]
    .join(' ')
    .toLowerCase()

  return /\b(non veg|non-veg|chicken|mutton|fish|egg|meat|biryani)\b/.test(content)
}

const parseDeliveryMinutes = (value: string) => {
  const numbers = value.match(/\d+/g)?.map(Number) || []
  return numbers.length > 0 ? Math.min(...numbers) : Number.POSITIVE_INFINITY
}

export default function HomePage() {
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([])
  const [loadingRestaurants, setLoadingRestaurants] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { activeRatingFilter, activeFilterChips, setRatingFilter, toggleFilterChip } = useFilterStore()

  useEffect(() => {
    let isMounted = true

    const loadRestaurants = async () => {
      try {
        const liveRestaurants = await fetchRestaurants()
        if (!isMounted) return
        setAllRestaurants(liveRestaurants)
        setLoadError(null)
      } catch (error) {
        if (isMounted) {
          setAllRestaurants([])
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Unable to load restaurants. Please check your connection.'
          )
        }
      } finally {
        if (isMounted) setLoadingRestaurants(false)
      }
    }

    loadRestaurants()
    return () => {
      isMounted = false
    }
  }, [])

  const featuredRestaurants = allRestaurants.filter((restaurant) => restaurant.featured)
  const visibleRestaurants = useMemo(() => {
    let nextRestaurants = [...allRestaurants]

    if (activeRatingFilter !== null) {
      nextRestaurants = nextRestaurants.filter((restaurant) => Number(restaurant.rating || 0) >= activeRatingFilter)
    }

    if (activeFilterChips.includes('Pure Veg')) {
      nextRestaurants = nextRestaurants.filter(isLikelyVegRestaurant)
    }

    if (activeFilterChips.includes('Non Veg')) {
      nextRestaurants = nextRestaurants.filter(isLikelyNonVegRestaurant)
    }

    if (activeFilterChips.includes('Fast Delivery')) {
      nextRestaurants = nextRestaurants.filter((restaurant) => parseDeliveryMinutes(restaurant.deliveryTime) <= 30)
    }

    if (activeFilterChips.includes('Under Rs99')) {
      nextRestaurants = nextRestaurants.filter((restaurant) => restaurant.priceForOne > 0 && restaurant.priceForOne <= 99)
    } else if (activeFilterChips.includes('Under Rs199')) {
      nextRestaurants = nextRestaurants.filter((restaurant) => restaurant.priceForOne > 0 && restaurant.priceForOne <= 199)
    }

    if (activeFilterChips.includes('Best Rated')) {
      nextRestaurants.sort((left, right) => Number(right.rating || 0) - Number(left.rating || 0))
    }

    return nextRestaurants
  }, [activeFilterChips, activeRatingFilter, allRestaurants])

  const handleRatingFilterToggle = (rating: number) => {
    setRatingFilter(activeRatingFilter === rating ? null : rating)
  }

  return (
    <div className="thinava-page-mobile bg-[#FFF8F4]">
      <Header immersive />

      <main className="relative">
        <HeroBanner />

        <HomeActiveOrderCard />

        <section className="mt-6 px-4 md:container md:mx-auto md:py-2">
          <div className="rounded-[2rem] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,248,244,0.72))] p-4 shadow-[0_20px_45px_-28px_rgba(17,24,39,0.2)] md:p-5">
            <SectionHeading
              title="What are you craving?"
              subtitle="Smooth swipes through local comforts, desserts, grills, and more"
            />
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory">
              {categories.map((category, index) => (
                (() => {
                  const categoryImage = getOptimizedCloudinaryImageUrl(category.image, {
                    width: 180,
                    height: 180,
                    crop: 'fill',
                  })
                  return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.03 }}
                  viewport={{ once: true }}
                  className="snap-start"
                >
                  <Link
                    href={`/restaurants?category=${encodeURIComponent(category.name)}`}
                    className="group flex w-[92px] shrink-0 flex-col items-center gap-2.5"
                  >
                    <div className="relative h-[84px] w-[84px] overflow-hidden rounded-[1.4rem] border border-white/90 bg-white p-1 shadow-[0_14px_28px_-18px_rgba(17,24,39,0.28)] transition duration-300 group-active:scale-95">
                      <Image
                        src={categoryImage}
                        alt={category.name}
                        width={84}
                        height={84}
                        className="h-full w-full rounded-[1.15rem] object-cover"
                      />
                      <div className="absolute inset-0 rounded-[1.15rem] bg-gradient-to-t from-black/25 to-transparent opacity-0 transition group-hover:opacity-100" />
                    </div>
                    <span className="text-center text-xs font-bold tracking-tight text-[#111827]">
                      {category.name}
                    </span>
                  </Link>
                </motion.div>
                  )
                })()
              ))}
            </div>
          </div>
        </section>

        <section className="mt-4 px-4 md:container md:mx-auto">
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
            <button
              type="button"
              className="snap-start inline-flex shrink-0 items-center gap-2 rounded-full border border-[#E8DED8] bg-white px-4 py-2.5 text-sm font-black text-[#111827] shadow-[0_10px_24px_-18px_rgba(17,24,39,0.38)] transition-all active:scale-[0.97]"
              aria-label="Open filters"
            >
              <SlidersHorizontal className="h-4 w-4 text-[#FF6B35]" />
              Filters
            </button>

            {RATING_FILTERS.map((rating) => {
              const isActive = activeRatingFilter === rating

              return (
                <button
                  key={rating}
                  type="button"
                  onClick={() => handleRatingFilterToggle(rating)}
                  className={`snap-start shrink-0 rounded-full border px-4 py-2.5 text-sm font-bold transition-all active:scale-[0.97] ${
                    isActive
                      ? 'border-[#FF6B35] bg-[#FF6B35] text-white shadow-[0_12px_26px_-16px_rgba(255,107,53,0.72)]'
                      : 'border-[#E8DED8] bg-white text-[#111827] shadow-[0_10px_24px_-20px_rgba(17,24,39,0.36)] hover:border-[#FFD0BC]'
                  }`}
                >
                  Rating {rating.toFixed(1)}+
                </button>
              )
            })}

            {FILTER_CHIPS.map((chip) => {
              const isActive = activeFilterChips.includes(chip)

              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => toggleFilterChip(chip)}
                  className={`snap-start shrink-0 rounded-full border px-4 py-2.5 text-sm font-bold transition-all active:scale-[0.97] ${
                    isActive
                      ? 'border-[#FF6B35] bg-[#FF6B35] text-white shadow-[0_12px_26px_-16px_rgba(255,107,53,0.72)]'
                      : 'border-[#E8DED8] bg-white text-[#111827] shadow-[0_10px_24px_-20px_rgba(17,24,39,0.36)] hover:border-[#FFD0BC]'
                  }`}
                >
                  {chip}
                </button>
              )
            })}
          </div>
        </section>

        {(featuredRestaurants.length > 0 || loadingRestaurants) && (
          <section className="mt-8 px-4 md:container md:mx-auto">
            <SectionHeading
              title="Top picks near you"
              subtitle="Handpicked local favourites with strong ratings and reliable prep times"
              action={
                <Link href="/restaurants" className="text-sm font-bold text-[#FF6B35]">
                  See all
                </Link>
              }
            />
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory md:grid md:grid-cols-2 md:overflow-visible md:snap-none lg:grid-cols-3">
              {loadingRestaurants
                ? Array.from({ length: 3 }).map((_, index) => (
                    <RestaurantCardSkeleton key={index} layout="carousel" />
                  ))
                : featuredRestaurants.map((restaurant, index) => (
                    <RestaurantCard
                      key={restaurant.id}
                      restaurant={restaurant}
                      index={index}
                      layout="carousel"
                    />
                  ))}
            </div>
          </section>
        )}

        <section id="restaurants-section" className="mt-8 scroll-mt-24 px-4 pb-6 md:container md:mx-auto md:pb-10">
          <SectionHeading
            title="Restaurants near you"
            subtitle={
              loadingRestaurants
                ? 'Loading partners...'
                : `${visibleRestaurants.length} places serving around Tadepalligudem`
            }
          />

          {loadingRestaurants ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <RestaurantCardSkeleton key={index} />
              ))}
            </div>
          ) : visibleRestaurants.length === 0 ? (
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center shadow-card">
              <Sparkles className="mx-auto h-10 w-10 text-[#FF6B35]/60" />
              <p className="mt-4 font-bold text-[#111827]">
                {allRestaurants.length === 0 ? 'No restaurants available' : 'No restaurants match these filters'}
              </p>
              <p className="mt-1 text-sm text-[#6B7280]">
                {loadError || (allRestaurants.length === 0
                  ? 'Check back soon for new partners in your area.'
                  : 'Try removing a filter to see more local kitchens.')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleRestaurants.map((restaurant, index) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} index={index} />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
      <MobileNav />
    </div>
  )
}
