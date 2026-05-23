'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Compass, MapPin, Search, Star } from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import MobileNav from '@/components/layout/MobileNav'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { fetchRestaurants } from '@/lib/customer-api'
import { formatPrice } from '@/lib/utils'
import { getRealtimeSocket } from '@/lib/realtime'
import { useAuthStore } from '@/store/authStore'
import type { Restaurant } from '@/types'

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const matchesCategory = (restaurant: Restaurant, category: string) => {
  const needle = normalize(category)
  const haystack = [restaurant.name, restaurant.description || '', restaurant.cuisines.join(' ')]
    .map(normalize)
    .join(' ')

  return haystack.includes(needle)
}

export function RestaurantsClientPage({
  initialCategory,
  initialQuery,
}: {
  initialCategory: string
  initialQuery: string
}) {
  const router = useRouter()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState(initialQuery)

  const token = useAuthStore((state) => state.token)

  useEffect(() => {
    let mounted = true

    const loadRestaurants = async () => {
      try {
        const response = await fetchRestaurants()
        if (mounted) {
          setRestaurants(response)
        }
      } catch {
        if (mounted) {
          setRestaurants([])
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadRestaurants()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const socketToken = token || 'guest-token'
    const socket = getRealtimeSocket('customer', socketToken)

    const handleRestaurantStatusUpdated = (data: { restaurantId: string; status: string }) => {
      setRestaurants((prevRestaurants) =>
        prevRestaurants.map((r) =>
          r.id === data.restaurantId
            ? { ...r, status: data.status, isOpen: data.status === 'OPEN' }
            : r
        )
      )
    }

    socket.on('restaurantStatusUpdated', handleRestaurantStatusUpdated)

    return () => {
      socket.off('restaurantStatusUpdated', handleRestaurantStatusUpdated)
    }
  }, [token])

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const params = new URLSearchParams()
    const trimmedQuery = query.trim()

    if (initialCategory) {
      params.set('category', initialCategory)
    }

    if (trimmedQuery) {
      params.set('query', trimmedQuery)
    }

    const nextUrl = params.toString() ? `/restaurants?${params.toString()}` : '/restaurants'
    router.push(nextUrl)
  }

  const filteredRestaurants = useMemo(() => {
    const textQuery = normalize(query)

    return restaurants.filter((restaurant) => {
      const categoryMatch = initialCategory ? matchesCategory(restaurant, initialCategory) : true
      if (!categoryMatch) {
        return false
      }

      if (!textQuery) {
        return true
      }

      return matchesCategory(restaurant, textQuery)
    })
  }, [initialCategory, query, restaurants])

  return (
    <div className="min-h-screen bg-[#fffaf5] pb-20 md:pb-0">
      <Header />

      <section className="border-b border-orange-100 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.18),transparent_28%),linear-gradient(135deg,#fff7ed_0%,#ffffff_55%,#fff1f2_100%)]">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-orange-700 shadow-sm">
              <Compass className="h-4 w-4" />
              Discover
            </div>
            <h1 className="mt-5 text-4xl font-bold text-slate-950 md:text-5xl">
              {initialCategory ? `${initialCategory} picks around you` : 'Explore restaurants across Thinava'}
            </h1>
            <p className="mt-4 text-base text-slate-600">
              Premium category browsing, cleaner discovery, and faster paths from craving to checkout.
            </p>
          </div>

          <form className="mt-8 max-w-xl" onSubmit={handleSearchSubmit}>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Search ${initialCategory || 'restaurants, cuisines, dishes'}...`}
                  className="h-14 rounded-full border-orange-100 bg-white pl-12 shadow-sm"
                />
              </div>
              <Button type="submit" size="lg" className="rounded-full px-6">
                Search
              </Button>
            </div>
          </form>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">Matching restaurants</p>
            <h2 className="text-2xl font-bold text-slate-950">{filteredRestaurants.length} results</h2>
          </div>
          {initialCategory ? <Badge className="border-0 bg-orange-100 text-orange-700">{initialCategory}</Badge> : null}
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="overflow-hidden">
                <Skeleton className="h-52 w-full rounded-none" />
                <CardContent className="p-5">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="mt-3 h-4 w-52" />
                  <Skeleton className="mt-4 h-4 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <Card className="border border-orange-100 bg-white">
            <CardContent className="p-10 text-center">
              <h3 className="text-2xl font-bold text-slate-950">No matching restaurants yet</h3>
              <p className="mt-3 text-sm text-slate-500">
                Try another category or browse all Thinava restaurant partners.
              </p>
              <Link
                href="/"
                className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
              >
                Back to homepage
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredRestaurants.map((restaurant) => {
              const isTemp = restaurant.status === 'TEMPORARILY_UNAVAILABLE'
              const isClosed = restaurant.status === 'CLOSED'
              const isUnavailable = isTemp || isClosed

              return (
                <Link key={restaurant.id} href={`/restaurant/${restaurant.id}`}>
                  <Card className={`overflow-hidden border border-orange-100 bg-white transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_-35px_rgba(249,115,22,0.45)] ${
                    isUnavailable ? 'opacity-65 grayscale-[20%]' : ''
                  }`}>
                    <div className="relative h-52 overflow-hidden">
                      <Image
                        src={restaurant.image}
                        alt={restaurant.name}
                        width={500}
                        height={260}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                      
                      {/* Floating Real-time Status Badge */}
                      <div className="absolute top-4 left-4 z-10">
                        {isTemp ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/90 backdrop-blur-md px-3 py-1 text-xs font-bold text-white shadow-md animate-pulse">
                            <span className="h-2 w-2 rounded-full bg-white" />
                            Temporarily Unavailable
                          </span>
                        ) : isClosed ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600/90 backdrop-blur-md px-3 py-1 text-xs font-bold text-white shadow-md">
                            <span className="h-2 w-2 rounded-full bg-white" />
                            Closed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/95 backdrop-blur-md px-3 py-1 text-xs font-bold text-white shadow-md">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                            </span>
                            Open
                          </span>
                        )}
                      </div>

                      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xl font-bold text-white">{restaurant.name}</p>
                          <p className="mt-1 text-sm text-white/75">{restaurant.cuisines.join(', ')}</p>
                        </div>
                        <div className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-950">
                          {restaurant.deliveryTime}
                        </div>
                      </div>
                    </div>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-4 w-4 fill-orange-400 text-orange-400" />
                          {restaurant.rating.toFixed(1)}
                        </span>
                        <span>{formatPrice(restaurant.priceForOne)} for one</span>
                      </div>
                      <div className="mt-4 flex items-start gap-2 text-sm text-slate-500">
                        <MapPin className="mt-0.5 h-4 w-4 text-orange-500" />
                        <span>{restaurant.formattedAddress || 'Tadepalligudem delivery zone'}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <Footer />
      <MobileNav />
    </div>
  )
}
