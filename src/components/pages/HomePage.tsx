'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Sparkles } from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import MobileNav from '@/components/layout/MobileNav'
import { Button } from '@/components/ui/Button'
import { categories } from '@/data/categories'
import { fetchRestaurants } from '@/lib/customer-api'
import { Restaurant } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { HomeActiveOrderCard } from '@/components/customer/HomeActiveOrderCard'
import { SectionHeading } from '@/components/customer/SectionHeading'
import { RestaurantCard, RestaurantCardSkeleton } from '@/components/customer/RestaurantCard'

const PROMO_BANNERS = [
  {
    eyebrow: 'Thinava Select',
    title: 'Warm meals for your evening cravings',
    subtitle: 'Curated local favorites with quick delivery windows and fresh kitchen offers.',
    cta: 'Browse top picks',
    href: '#restaurants',
    gradient: 'from-[#10203B] via-[#17315C] to-[#FF6B35]',
    image:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&q=80',
  },
  {
    eyebrow: 'Weekend Specials',
    title: 'Family combos that feel worth ordering in',
    subtitle: 'Big biryani bowls, grills, and desserts lined up for relaxed nights at home.',
    cta: 'See weekend deals',
    href: '/restaurants',
    gradient: 'from-[#7C2D12] via-[#C2410C] to-[#FDBA74]',
    image:
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&q=80',
  },
  {
    eyebrow: 'Fast Lane',
    title: 'Reliable delivery when you just want food now',
    subtitle: 'Quick-prep kitchens, comfort dishes, and smoother checkout from nearby partners.',
    cta: 'Open fast delivery',
    href: '/restaurants',
    gradient: 'from-[#111827] via-[#1F2937] to-[#374151]',
    image:
      'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=900&q=80',
  },
]

const FILTER_CHIPS = [
  'Rating 4.0+',
  'Previously ordered',
  'Pure Veg',
  'Fast Delivery',
  'Under Rs199',
  'Best Rated',
]

export default function HomePage() {
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([])
  const [loadingRestaurants, setLoadingRestaurants] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeFilterChip, setActiveFilterChip] = useState(FILTER_CHIPS[0])
  const token = useAuthStore((state) => state.token)

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

  return (
    <div className="thinava-page-mobile bg-[#FFF8F4]">
      <Header immersive />

      <main className="relative">
        <section className="px-4 pt-3 md:hidden">
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
            {PROMO_BANNERS.map((banner, index) => (
              <motion.article
                key={banner.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="snap-start"
              >
                <Link
                  href={banner.href}
                  className={`group relative flex h-[196px] w-[min(86vw,360px)] shrink-0 overflow-hidden rounded-[2rem] bg-gradient-to-br ${banner.gradient} p-5 text-white shadow-[0_20px_45px_-20px_rgba(17,24,39,0.45)]`}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_34%)]" />
                  <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
                  <div className="relative z-10 flex h-full max-w-[58%] flex-col justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/75">
                        {banner.eyebrow}
                      </p>
                      <h2 className="mt-3 text-[1.35rem] font-black leading-tight tracking-[-0.03em]">
                        {banner.title}
                      </h2>
                      <p className="mt-2 text-sm leading-5 text-white/78">{banner.subtitle}</p>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/14 px-4 py-2 text-sm font-semibold backdrop-blur-sm transition group-active:scale-[0.98]">
                      {banner.cta}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>

                  <div className="absolute bottom-0 right-0 h-full w-[48%] overflow-hidden">
                    <Image
                      src={banner.image}
                      alt={banner.title}
                      fill
                      sizes="220px"
                      className="object-cover object-center opacity-95 transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-black/35" />
                  </div>
                </Link>
              </motion.article>
            ))}
          </div>

          <div className="mt-3 flex justify-center gap-1.5">
            {PROMO_BANNERS.map((banner, index) => (
              <span
                key={banner.title}
                className={`h-1.5 rounded-full transition-all ${
                  index === 0 ? 'w-8 bg-[#FF6B35]' : 'w-1.5 bg-[#D6D3D1]'
                }`}
              />
            ))}
          </div>
        </section>

        <div className="hidden md:block">
          <section className="container mx-auto px-4 py-10">
            <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,248,244,0.96))] px-6 py-7 shadow-[0_24px_60px_-32px_rgba(17,24,39,0.28)] md:flex md:items-center md:justify-between md:gap-8">
              <div className="max-w-xl">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#FF6B35]">
                  Tadepalligudem
                </p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#111827]">
                  Premium local dining, ready when you are
                </h1>
                <p className="mt-3 max-w-lg text-[15px] leading-7 text-[#6B7280]">
                  Discover trusted kitchens, comfort dishes, and fast evening orders with a
                  polished Thinava experience.
                </p>
                <div className="mt-6 flex gap-2">
                  <Link href="#restaurants">
                    <Button size="lg" className="gap-2">
                      Order now <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  {!token ? (
                    <Link href="/login">
                      <Button size="lg" variant="outline">
                        Login
                      </Button>
                    </Link>
                  ) : null}
                </div>
              </div>
              <div className="relative mt-6 h-48 w-full max-w-md overflow-hidden rounded-[1.75rem] shadow-card md:mt-0">
                <Image
                  src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80"
                  alt="Food spread"
                  fill
                  className="object-cover"
                  sizes="400px"
                />
              </div>
            </div>
          </section>
        </div>

        <HomeActiveOrderCard />

        <section className="mt-6 px-4 md:container md:mx-auto md:py-2">
          <div className="rounded-[2rem] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,248,244,0.72))] p-4 shadow-[0_20px_45px_-28px_rgba(17,24,39,0.2)] md:p-5">
            <SectionHeading
              title="What are you craving?"
              subtitle="Smooth swipes through local comforts, desserts, grills, and more"
            />
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory">
              {categories.map((category, index) => (
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
                        src={category.image}
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
              ))}
            </div>
          </div>
        </section>

        <section className="mt-4 px-4 md:container md:mx-auto">
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
            {FILTER_CHIPS.map((chip) => {
              const isActive = chip === activeFilterChip

              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setActiveFilterChip(chip)}
                  className={`snap-start shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all ${
                    isActive
                      ? 'border-[#FF6B35]/30 bg-[#FFEEE6] text-[#C2410C] shadow-[0_10px_24px_-16px_rgba(255,107,53,0.55)]'
                      : 'border-white/80 bg-white/88 text-[#4B5563] shadow-[0_8px_20px_-18px_rgba(17,24,39,0.4)]'
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

        <section id="restaurants" className="mt-8 px-4 pb-6 md:container md:mx-auto md:pb-10">
          <SectionHeading
            title="Restaurants near you"
            subtitle={
              loadingRestaurants
                ? 'Loading partners...'
                : `${allRestaurants.length} places serving around Tadepalligudem`
            }
          />

          {loadingRestaurants ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <RestaurantCardSkeleton key={index} />
              ))}
            </div>
          ) : allRestaurants.length === 0 ? (
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center shadow-card">
              <Sparkles className="mx-auto h-10 w-10 text-[#FF6B35]/60" />
              <p className="mt-4 font-bold text-[#111827]">No restaurants available</p>
              <p className="mt-1 text-sm text-[#6B7280]">
                {loadError || 'Check back soon for new partners in your area.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {allRestaurants.map((restaurant, index) => (
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
