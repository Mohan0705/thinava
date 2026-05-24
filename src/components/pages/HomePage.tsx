'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, MapPin, Sparkles, Tag } from 'lucide-react'
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

const QUICK_FILTERS = ['Biryani', 'South Indian', 'Snacks', 'Desserts', 'Fast Food']

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
          console.error('Failed to load restaurants:', error)
        }
      } finally {
        if (isMounted) {
          setLoadingRestaurants(false)
        }
      }
    }

    loadRestaurants()

    return () => {
      isMounted = false
    }
  }, [])

  const featuredRestaurants = allRestaurants.filter((r) => r.featured)

  return (
    <div className="thinava-page-mobile">
      <Header />

      {/* Compact hero */}
      <section className="relative overflow-hidden border-b border-thinava-border bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,107,53,0.08),transparent_50%)]" />
        <div className="container relative mx-auto px-4 py-8 md:py-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between"
          >
            <div className="max-w-xl">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-xs font-semibold text-thinava-primary">
                <MapPin className="h-3.5 w-3.5" />
                Tadepalligudem
              </div>
              <h1 className="text-balance text-2xl font-bold leading-tight tracking-tight text-thinava-text md:text-3xl">
                Delicious food delivered across Tadepalligudem
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 md:text-base">
                Order from trusted local restaurants. Fresh, fast, and made for your neighbourhood.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="#restaurants">
                  <Button size="lg" className="gap-2">
                    Order now
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                {!token ? (
                  <Link href="/login">
                    <Button size="lg" variant="outline">
                      Sign in
                    </Button>
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="relative hidden h-36 w-full max-w-sm overflow-hidden rounded-2xl md:block">
              <Image
                src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80"
                alt="Indian food spread"
                fill
                className="object-cover"
                sizes="400px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-white/20" />
            </div>
          </motion.div>
        </div>
      </section>

      <HomeActiveOrderCard />

      {/* Quick filters */}
      <section className="container mx-auto px-4 pt-6">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {QUICK_FILTERS.map((filter) => (
            <Link
              key={filter}
              href={`/restaurants?category=${encodeURIComponent(filter)}`}
              className="shrink-0 rounded-full border border-thinava-border bg-white px-4 py-2 text-sm font-medium text-thinava-text shadow-sm transition-colors hover:border-thinava-primary hover:text-thinava-primary"
            >
              {filter}
            </Link>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="container mx-auto px-4 py-8">
        <SectionHeading
          title="What are you craving?"
          subtitle="Browse by cuisine"
        />
        <div className="overflow-x-auto pb-1 scrollbar-hide">
          <div className="flex min-w-max gap-4">
            {categories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                viewport={{ once: true }}
                className="w-[88px] shrink-0"
              >
                <Link
                  href={`/restaurants?category=${encodeURIComponent(category.name)}`}
                  className="group flex flex-col items-center gap-2"
                >
                  <div className="relative h-[72px] w-[72px] overflow-hidden rounded-2xl border border-thinava-border bg-white p-0.5 shadow-card transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-card-hover">
                    <Image
                      src={category.image}
                      alt={category.name}
                      width={72}
                      height={72}
                      className="h-full w-full rounded-[14px] object-cover"
                    />
                  </div>
                  <span className="text-center text-xs font-semibold text-thinava-text">
                    {category.name}
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Offer banner - single, restrained gradient */}
      <section className="container mx-auto px-4 pb-2">
        <div className="overflow-hidden rounded-2xl thinava-gradient-bg p-5 text-white shadow-md md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/90">
                <Tag className="h-3.5 w-3.5" />
                Welcome offer
              </div>
              <h3 className="text-lg font-bold md:text-xl">Free delivery on orders above ₹300</h3>
              <p className="mt-1 text-sm text-white/85">Valid at participating restaurants in Tadepalligudem</p>
            </div>
            <Link href="#restaurants" className="shrink-0">
              <Button
                variant="secondary"
                size="sm"
                className="border-0 bg-white text-thinava-primary hover:bg-orange-50"
              >
                Explore
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured */}
      {featuredRestaurants.length > 0 || loadingRestaurants ? (
        <section className="container mx-auto px-4 py-8">
          <SectionHeading
            title="Featured picks"
            subtitle="Top-rated restaurants near you"
            action={
              <Link href="/restaurants" className="text-sm font-semibold text-thinava-primary">
                See all
              </Link>
            }
          />
          {loadingRestaurants ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <RestaurantCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredRestaurants.map((restaurant, index) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} index={index} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* All restaurants */}
      <section id="restaurants" className="container mx-auto px-4 py-8">
        <SectionHeading
          title="Restaurants near you"
          subtitle={
            loadingRestaurants
              ? 'Loading partners...'
              : `${allRestaurants.length} places delivering in Tadepalligudem`
          }
        />

        {loadingRestaurants ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <RestaurantCardSkeleton key={i} />
            ))}
          </div>
        ) : allRestaurants.length === 0 ? (
          <div className="rounded-2xl border border-thinava-border bg-white p-10 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-thinava-primary/60" />
            <p className="mt-4 font-semibold text-thinava-text">No restaurants available</p>
            <p className="mt-1 text-sm text-gray-500">
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

      <Footer />
      <MobileNav />
    </div>
  )
}
