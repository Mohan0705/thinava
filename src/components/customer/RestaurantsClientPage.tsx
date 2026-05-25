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
import { fetchRestaurants, mapRestaurant } from '@/lib/customer-api'
import { getRealtimeSocket, releaseRealtimeSocket } from '@/lib/realtime'
import { isValidJwt } from '@/lib/auth/session'
import { useAuthStore } from '@/store/authStore'
import { useFilterStore } from '@/store/filterStore'
import { API_BASE_URL } from '@/lib/api'
import { sortRestaurantsForDisplay } from '@/lib/restaurant-availability'
import type { Restaurant } from '@/types'

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

interface ApiResponse {
  success?: boolean
  restaurants?: Array<Record<string, any>>
  error?: string
  message?: string
  count?: number
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
  const [emptyMessage, setEmptyMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const token = useAuthStore((state) => state.token)
  const { resetHomepageFilters, setCategory, setSearchQuery } = useFilterStore()

  // CRITICAL: Reset homepage filters when navigating to category/search
  useEffect(() => {
    resetHomepageFilters()
    
    if (initialCategory && initialCategory.trim()) {
      setCategory(initialCategory)
    } else if (initialQuery && initialQuery.trim()) {
      setSearchQuery(initialQuery)
    }

    return () => {
      // Cleanup: clear category context when unmounting
      setCategory(null)
      setSearchQuery(null)
    }
  }, [initialCategory, initialQuery, resetHomepageFilters, setCategory, setSearchQuery])

  // Load restaurants based on category or query
  useEffect(() => {
    let mounted = true

    const loadRestaurants = async () => {
      setLoading(true)
      setEmptyMessage('')
      setError(null)
      
      try {
        if (initialCategory && initialCategory.trim()) {
          // Fetch by category - this is isolated from homepage filters
          const response = await fetch(
            `${API_BASE_URL}/search/by-category/${encodeURIComponent(initialCategory)}`
          )
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }

          const data: ApiResponse = await response.json()

          if (mounted) {
            // Safe parsing with defaults - prevent undefined errors
            const fetchedRestaurants = Array.isArray(data.restaurants) ? data.restaurants : []
            const validRestaurants = fetchedRestaurants
              .filter((r): r is Record<string, any> => !!r && typeof r === 'object')
              .map(mapRestaurant)
            
            setRestaurants(validRestaurants)
            
            if (validRestaurants.length === 0) {
              setEmptyMessage(
                data.message || `No restaurants serving ${initialCategory} nearby`
              )
            }
            
            if (!data.success && data.error) {
              setError(data.error)
            }
          }
        } else if (initialQuery && initialQuery.trim()) {
          // Search by query
          const response = await fetch(
            `${API_BASE_URL}/search?q=${encodeURIComponent(initialQuery)}`
          )
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }

          const data: ApiResponse = await response.json()

          if (mounted) {
            const fetchedRestaurants = Array.isArray(data.restaurants) ? data.restaurants : []
            const validRestaurants = fetchedRestaurants
              .filter((r): r is Record<string, any> => !!r && typeof r === 'object')
              .map(mapRestaurant)
            
            setRestaurants(validRestaurants)
            
            if (validRestaurants.length === 0) {
              setEmptyMessage('No restaurants or dishes match your search. Try different keywords.')
            }
            
            if (!data.success && data.error) {
              setError(data.error)
            }
          }
        } else {
          // Load all restaurants - homepage state does NOT affect this
          const response = await fetchRestaurants()
          if (mounted) {
            const validResponse = Array.isArray(response) ? response.filter((r): r is Restaurant => !!r && typeof r === 'object') : []
            setRestaurants(validResponse)
          }
        }
      } catch (err) {
        if (mounted) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to load restaurants'
          setError(errorMsg)
          setRestaurants([])
          setEmptyMessage(
            initialCategory
              ? `No restaurants serving ${initialCategory} nearby`
              : initialQuery
              ? 'Failed to load search results'
              : 'Failed to load restaurants'
          )
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadRestaurants()

    return () => {
      mounted = false
    }
  }, [initialCategory, initialQuery])

  // Real-time restaurant status updates
  useEffect(() => {
    if (!token || !isValidJwt(token)) {
      return
    }

    const socket = getRealtimeSocket('customer', token)
    if (!socket) {
      return
    }

    const handleRestaurantStatusUpdated = (data: {
      restaurantId: string
      status: string
      displayStatus?: string
      isOpenNow?: boolean
      nextOpeningTime?: string | null
      closesAt?: string | null
      isOvernightSchedule?: boolean
      isManuallyClosed?: boolean
    }) => {
      setRestaurants((prevRestaurants) =>
        prevRestaurants.map((r) =>
          r.id === data.restaurantId
            ? {
                ...r,
                status: data.status,
                displayStatus: data.displayStatus || data.status,
                isOpen: Boolean(data.isOpenNow),
                isOpenNow: Boolean(data.isOpenNow),
                nextOpeningTime: data.nextOpeningTime ?? r.nextOpeningTime,
                closesAt: data.closesAt ?? r.closesAt,
                isOvernightSchedule: data.isOvernightSchedule ?? r.isOvernightSchedule,
                isManuallyClosed: data.isManuallyClosed ?? r.isManuallyClosed,
              }
            : r
        )
      )
    }

    socket.on('restaurantStatusUpdated', handleRestaurantStatusUpdated)

    return () => {
      socket.off('restaurantStatusUpdated', handleRestaurantStatusUpdated)
      releaseRealtimeSocket('customer', token)
    }
  }, [token])

  // Sync query state with URL params
  useEffect(() => {
    setQuery(initialQuery || '')
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

  // Filter restaurants by search query ONLY (not by homepage filters)
  const filteredRestaurants = useMemo(() => {
    if (!query.trim()) {
      return restaurants
    }

    const textQuery = normalize(query)
    return restaurants.filter((restaurant) => {
      const restaurantText = [
        restaurant.name,
        restaurant.description || '',
        restaurant.cuisines?.join(' ') || ''
      ]
        .map(normalize)
        .join(' ')

      return restaurantText.includes(textQuery)
    })
  }, [query, restaurants])
  const sortedRestaurants = useMemo(() => sortRestaurantsForDisplay(filteredRestaurants), [filteredRestaurants])

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
          title={`${sortedRestaurants.length} restaurants`}
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
        ) : sortedRestaurants.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <h3 className="text-lg font-bold text-thinava-text">
                {emptyMessage || 'No matching restaurants'}
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                {initialCategory 
                  ? `Try a different category or browse all restaurants.`
                  : 'Try another search term or browse all partners.'}
              </p>
              {error && (
                <p className="mt-2 text-sm text-red-600">
                  Error: {error}
                </p>
              )}
              <Link href="/" className="mt-5 inline-flex">
                <Button variant="outline">Back to homepage</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedRestaurants.map((restaurant, index) => (
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
