'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Compass, Search } from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import MobileNav from '@/components/layout/MobileNav'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { RestaurantCard, RestaurantCardSkeleton } from '@/components/customer/RestaurantCard'
import { SectionHeading } from '@/components/customer/SectionHeading'
import { fetchRestaurants } from '@/lib/customer-api'
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
        if (mounted) setRestaurants(response)
      } catch {
        if (mounted) setRestaurants([])
      } finally {
        if (mounted) setLoading(false)
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

    if (initialCategory) params.set('category', initialCategory)
    if (trimmedQuery) params.set('query', trimmedQuery)

    const nextUrl = params.toString() ? `/restaurants?${params.toString()}` : '/restaurants'
    router.push(nextUrl)
  }

  const filteredRestaurants = useMemo(() => {
    const textQuery = normalize(query)

    return restaurants.filter((restaurant) => {
      const categoryMatch = initialCategory ? matchesCategory(restaurant, initialCategory) : true
      if (!categoryMatch) return false
      if (!textQuery) return true
      return matchesCategory(restaurant, textQuery)
    })
  }, [initialCategory, query, restaurants])

  return (
    <div className="thinava-page-mobile">
      <Header />

      <section className="border-b border-thinava-border bg-white">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-xs font-semibold text-thinava-primary">
              <Compass className="h-3.5 w-3.5" />
              Discover
            </div>
            <h1 className="mt-3 text-2xl font-bold text-thinava-text md:text-3xl">
              {initialCategory ? `${initialCategory} in Tadepalligudem` : 'Explore restaurants'}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Find your next meal from trusted local kitchens.
            </p>
          </div>

          <form className="mt-6 max-w-xl" onSubmit={handleSearchSubmit}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Search ${initialCategory || 'restaurants, cuisines, dishes'}...`}
                  className="h-12 rounded-full pl-11 shadow-search"
                />
              </div>
              <Button type="submit" size="lg" className="shrink-0 rounded-full px-6">
                Search
              </Button>
            </div>
          </form>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8">
        <SectionHeading
          title={`${filteredRestaurants.length} restaurants`}
          subtitle={initialCategory ? `Filtered by ${initialCategory}` : 'All partners in your area'}
          action={
            initialCategory ? (
              <Badge variant="secondary">{initialCategory}</Badge>
            ) : null
          }
        />

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <RestaurantCardSkeleton key={index} />
            ))}
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <h3 className="text-lg font-bold text-thinava-text">No matching restaurants</h3>
              <p className="mt-2 text-sm text-gray-500">Try another category or browse all partners.</p>
              <Link href="/" className="mt-5 inline-flex">
                <Button variant="outline">Back to homepage</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRestaurants.map((restaurant, index) => (
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
