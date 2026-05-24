'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Sparkles, Flame, Timer, Star, Tag } from 'lucide-react'
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

const QUICK_ACTIONS = [
  {
    title: 'Free Delivery',
    subtitle: 'On ₹300+',
    href: '#restaurants',
    gradient: 'from-[#FF6B35] to-[#FF8A5B]',
    icon: Tag,
  },
  {
    title: 'Under ₹99',
    subtitle: 'Budget picks',
    href: '/restaurants?category=Snacks',
    gradient: 'from-[#F97316] to-[#FB923C]',
    icon: Flame,
  },
  {
    title: 'Fast Delivery',
    subtitle: '30 mins avg',
    href: '#restaurants',
    gradient: 'from-[#1F2937] to-[#374151]',
    icon: Timer,
  },
  {
    title: 'Best Rated',
    subtitle: '4.0★ & above',
    href: '/restaurants',
    gradient: 'from-[#B45309] to-[#F59E0B]',
    icon: Star,
  },
  {
    title: 'Biryani',
    subtitle: 'Local favourites',
    href: '/restaurants?category=Biryani',
    gradient: 'from-[#DC2626] to-[#F97316]',
    icon: Sparkles,
  },
]

export default function HomePage() {
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([])
  const [loadingRestaurants, setLoadingRestaurants] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
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

  const featuredRestaurants = allRestaurants.filter((r) => r.featured)

  return (
    <div className="thinava-page-mobile bg-[#FFF8F4]">
      <Header immersive />

      <main className="md:-mt-0">
        <div className="hidden md:block">
          <section className="container mx-auto px-4 py-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <p className="text-sm font-semibold uppercase tracking-wider text-[#FF6B35]">Tadepalligudem</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#111827]">
                  Delicious food, delivered with care
                </h1>
                <p className="mt-2 text-[#6B7280]">
                  Discover trusted local restaurants and order your next favourite meal.
                </p>
                <div className="mt-5 flex gap-2">
                  <Link href="#restaurants">
                    <Button size="lg" className="gap-2">
                      Order now <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  {!token ? (
                    <Link href="/login">
                      <Button size="lg" variant="outline">Sign in</Button>
                    </Link>
                  ) : null}
                </div>
              </div>
              <div className="relative h-44 w-full max-w-md overflow-hidden rounded-2xl shadow-card">
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

        <section className="px-4 pt-2 md:container md:mx-auto md:pt-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl shadow-[0_20px_50px_-20px_rgba(255,107,53,0.45)]"
          >
            <div className="relative aspect-[2.2/1] min-h-[148px] sm:aspect-[2.5/1]">
              <Image
                src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=900&q=80"
                alt="Fresh meals from local kitchens"
                fill
                className="object-cover"
                sizes="100vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#1F2937]/90 via-[#1F2937]/55 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-end p-5">
                <span className="mb-2 inline-flex w-fit rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                  Tadepalligudem specials
                </span>
                <h2 className="max-w-[16rem] text-xl font-bold leading-tight text-white sm:text-2xl">
                  Local flavours, delivered hot to your door
                </h2>
                <p className="mt-1 max-w-xs text-sm text-white/75">Free delivery on orders above ₹300</p>
                <Link href="#restaurants" className="mt-3 inline-flex w-fit">
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF6B35] px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:brightness-105">
                    Explore restaurants <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="mt-5 px-4 md:container md:mx-auto">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
            {QUICK_ACTIONS.map((action, index) => {
              const Icon = action.icon
              return (
                <motion.div
                  key={action.title}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="snap-start"
                >
                  <Link
                    href={action.href}
                    className={`flex h-[88px] w-[132px] shrink-0 flex-col justify-between rounded-2xl bg-gradient-to-br ${action.gradient} p-3.5 text-white shadow-[0_10px_28px_-12px_rgba(17,24,39,0.35)] transition-transform active:scale-[0.98]`}
                  >
                    <Icon className="h-5 w-5 opacity-90" />
                    <div>
                      <p className="text-sm font-bold leading-tight">{action.title}</p>
                      <p className="text-[11px] text-white/80">{action.subtitle}</p>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </section>

        <section className="mt-6 px-4 md:container md:mx-auto md:py-2">
          <SectionHeading title="What are you craving?" subtitle="Swipe to explore cuisines" />
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
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
                  <div className="relative h-[84px] w-[84px] overflow-hidden rounded-2xl border-2 border-white bg-white p-0.5 shadow-[0_8px_24px_-10px_rgba(17,24,39,0.2)] transition duration-300 group-active:scale-95">
                    <Image
                      src={category.image}
                      alt={category.name}
                      width={84}
                      height={84}
                      className="h-full w-full rounded-[14px] object-cover"
                    />
                    <div className="absolute inset-0 rounded-[14px] bg-gradient-to-t from-black/25 to-transparent opacity-0 transition group-hover:opacity-100" />
                  </div>
                  <span className="text-center text-xs font-bold text-[#111827]">{category.name}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {(featuredRestaurants.length > 0 || loadingRestaurants) && (
          <section className="mt-8 px-4 md:container md:mx-auto">
            <SectionHeading
              title="Top picks near you"
              subtitle="Handpicked local favourites"
              action={
                <Link href="/restaurants" className="text-sm font-bold text-[#FF6B35]">
                  See all
                </Link>
              }
            />
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory md:grid md:grid-cols-2 md:overflow-visible md:snap-none lg:grid-cols-3">
              {loadingRestaurants
                ? Array.from({ length: 3 }).map((_, i) => (
                    <RestaurantCardSkeleton key={i} layout="carousel" />
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
                : `${allRestaurants.length} places in Tadepalligudem`
            }
          />

          {loadingRestaurants ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <RestaurantCardSkeleton key={i} />
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