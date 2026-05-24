'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Star, Clock, MapPin, Percent } from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import MobileNav from '@/components/layout/MobileNav'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { categories } from '@/data/categories'
import { fetchRestaurants } from '@/lib/customer-api'
import { formatPrice } from '@/lib/utils'
import { Restaurant } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { HomeActiveOrderCard } from '@/components/customer/HomeActiveOrderCard'

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

        if (!isMounted) {
          return
        }

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

  const featuredRestaurants = allRestaurants.filter(r => r.featured)

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Header />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="container mx-auto px-4 py-16 md:py-24 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              Delicious Food Delivered to Your Doorstep
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-white/90">
              Order from the best restaurants in Tadepalligudem
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="#all-restaurants" className="inline-flex">
                <Button
                  size="lg"
                  className="border-0 bg-white px-8 text-base font-bold text-slate-900 shadow-xl shadow-black/15 hover:bg-orange-50"
                >
                  Order Now
                </Button>
              </Link>
              {!token ? (
                <Link href="/login" className="inline-flex">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/70 bg-white/10 px-8 text-base font-bold text-white hover:bg-white/20"
                  >
                    Login
                  </Button>
                </Link>
              ) : null}
            </div>
          </motion.div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-10 right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute bottom-10 left-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
      </section>

      <HomeActiveOrderCard />

      {/* Categories Section */}
      <section id="all-restaurants" className="container mx-auto px-4 py-12">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="text-3xl font-bold mb-8 text-gray-900"
        >
          What's on your mind?
        </motion.h2>
        <div className="overflow-x-auto pb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-4">
            {categories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                viewport={{ once: true }}
                className="w-[96px] shrink-0 md:w-[112px]"
              >
                <Link href={`/restaurants?category=${encodeURIComponent(category.name)}`}>
                  <div className="group flex flex-col items-center gap-3">
                    <div className="relative h-20 w-20 overflow-hidden rounded-full border border-orange-100 bg-white p-1 shadow-[0_18px_44px_-26px_rgba(249,115,22,0.45)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_26px_58px_-26px_rgba(249,115,22,0.55)] md:h-24 md:w-24">
                      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_top,rgba(251,146,60,0.28),transparent_60%)]" />
                      <Image
                        src={category.image}
                        alt={category.name}
                        width={96}
                        height={96}
                        className="h-full w-full rounded-full object-cover"
                      />
                    </div>
                    <span className="text-center text-xs font-semibold text-slate-700 md:text-sm">
                      {category.name}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Offers Section */}
      <section className="container mx-auto px-4 py-12">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="text-3xl font-bold mb-8 text-gray-900"
        >
          Best Offers For You
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-8 text-white"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-2">50% OFF</h3>
                <p className="text-white/90">On your first order</p>
                <Button variant="secondary" className="mt-4">
                  Order Now
                </Button>
              </div>
              <div className="text-6xl">🎉</div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-8 text-white"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-2">Free Delivery</h3>
                <p className="text-white/90">On orders above ₹300</p>
                <Button variant="secondary" className="mt-4">
                  Explore
                </Button>
              </div>
              <div className="text-6xl">🚀</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured Restaurants Section */}
      <section className="container mx-auto px-4 py-12">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="text-3xl font-bold mb-8 text-gray-900"
        >
          Featured Restaurants
        </motion.h2>
        {loadingRestaurants ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="overflow-hidden">
                <Skeleton className="h-48 w-full rounded-none" />
                <CardContent className="p-4">
                  <Skeleton className="mb-3 h-6 w-40" />
                  <Skeleton className="mb-3 h-4 w-52" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-14" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : featuredRestaurants.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            {loadError || 'No featured restaurants available at this time.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredRestaurants.map((restaurant, index) => (
              <motion.div
                key={restaurant.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Link href={`/restaurant/${restaurant.id}`}>
                  <Card className="overflow-hidden hover:shadow-2xl transition-all duration-300 cursor-pointer group">
                    <div className="relative h-48 overflow-hidden">
                      <Image
                        src={restaurant.image}
                        alt={restaurant.name}
                        width={400}
                        height={200}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      {restaurant.offer && (
                        <Badge variant="default" className="absolute top-4 left-4">
                          <Percent className="w-3 h-3 mr-1" />
                          {restaurant.offer}
                        </Badge>
                      )}
                      {!restaurant.isOpen && (
                        <Badge variant="secondary" className="absolute top-4 right-4">
                          Closed
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">
                        {restaurant.name}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-green-500 text-green-500" />
                          <span className="font-semibold">{restaurant.rating}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{restaurant.deliveryTime}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{formatPrice(restaurant.priceForOne)} for one</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {restaurant.cuisines.slice(0, 3).map((cuisine) => (
                          <Badge key={cuisine} variant="outline" className="text-xs">
                            {cuisine}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* All Restaurants Section */}
      <section className="container mx-auto px-4 py-12">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="text-3xl font-bold mb-8 text-gray-900"
        >
          All Restaurants
        </motion.h2>
        {loadingRestaurants ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="overflow-hidden">
                <Skeleton className="h-48 w-full rounded-none" />
                <CardContent className="p-4">
                  <Skeleton className="mb-3 h-6 w-40" />
                  <Skeleton className="mb-3 h-4 w-52" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-14" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : allRestaurants.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            {loadError || 'No restaurants found in your area.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allRestaurants.map((restaurant, index) => (
              <motion.div
                key={restaurant.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                viewport={{ once: true }}
              >
                <Link href={`/restaurant/${restaurant.id}`}>
                  <Card className="overflow-hidden hover:shadow-2xl transition-all duration-300 cursor-pointer group">
                    <div className="relative h-48 overflow-hidden">
                      <Image
                        src={restaurant.image}
                        alt={restaurant.name}
                        width={400}
                        height={200}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      {restaurant.offer && (
                        <Badge variant="default" className="absolute top-4 left-4">
                          <Percent className="w-3 h-3 mr-1" />
                          {restaurant.offer}
                        </Badge>
                      )}
                      {!restaurant.isOpen && (
                        <Badge variant="secondary" className="absolute top-4 right-4">
                          Closed
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">
                        {restaurant.name}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-green-500 text-green-500" />
                          <span className="font-semibold">{restaurant.rating}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{restaurant.deliveryTime}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{formatPrice(restaurant.priceForOne)} for one</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {restaurant.cuisines.slice(0, 3).map((cuisine) => (
                          <Badge key={cuisine} variant="outline" className="text-xs">
                            {cuisine}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <Footer />
      <MobileNav />
    </div>
  )
}
