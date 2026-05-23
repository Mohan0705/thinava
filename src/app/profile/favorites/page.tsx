'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Heart, Star } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { fetchRestaurants } from '@/lib/customer-api'
import { Restaurant } from '@/types'

export default function ProfileFavoritesPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadRestaurants = async () => {
      try {
        const liveRestaurants = await fetchRestaurants()

        if (isMounted) {
          setRestaurants(
            liveRestaurants.filter((restaurant) => restaurant.featured || restaurant.rating >= 4.2)
          )
        }
      } catch (error) {
        if (isMounted) {
          setRestaurants([])
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadRestaurants()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Favorites</CardTitle>
        <p className="text-sm text-gray-600">
          Quick access to popular picks so repeat orders take fewer taps.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border p-4 text-sm text-gray-600">Loading favourites...</div>
        ) : restaurants.length === 0 ? (
          <div className="rounded-2xl border p-4 text-sm text-gray-600">
            No favourite restaurants are available right now.
          </div>
        ) : (
          restaurants.map((restaurant) => (
            <div
              key={restaurant.id}
              className="flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center"
            >
              <div className="relative h-20 w-full overflow-hidden rounded-2xl sm:w-24">
                <Image
                  src={restaurant.image}
                  alt={restaurant.name}
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-500" />
                  <h3 className="font-semibold text-gray-900">{restaurant.name}</h3>
                </div>
                <p className="mt-1 text-sm text-gray-600">{restaurant.cuisines.join(', ')}</p>
                <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-4 w-4 fill-current text-orange-500" />
                    {Number(restaurant.rating || 0).toFixed(1)}
                  </span>
                  <span>{restaurant.deliveryTime}</span>
                </div>
              </div>
              <Link href={`/restaurant/${restaurant.id}`} className="inline-flex">
                <Button variant="outline">View Restaurant</Button>
              </Link>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
