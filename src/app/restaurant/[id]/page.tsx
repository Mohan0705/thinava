'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Star, Clock, MapPin, Plus, Minus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { fetchRestaurant, fetchRestaurantMenu } from '@/lib/customer-api'
import { useCartStore } from '@/store/cartStore'
import { getRealtimeSocket } from '@/lib/realtime'
import { useAuthStore } from '@/store/authStore'
import { formatPrice } from '@/lib/utils'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import MobileNav from '@/components/layout/MobileNav'
import { MenuItem, Restaurant } from '@/types'

const FALLBACK_RESTAURANT_IMAGE =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80'
const FALLBACK_MENU_ITEM_IMAGE =
  'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80'

export default function RestaurantPage() {
  const params = useParams()
  const restaurantId = typeof params?.id === 'string' ? params.id : ''
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [restaurantMenu, setRestaurantMenu] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const token = useAuthStore((state) => state.token)
  const { items, addItem, updateQuantity } = useCartStore()

  useEffect(() => {
    let isMounted = true

    const loadRestaurantData = async () => {
      setLoading(true)
      setLoadError(null)

      try {
        const [liveRestaurant, liveMenu] = await Promise.all([
          fetchRestaurant(restaurantId),
          fetchRestaurantMenu(restaurantId),
        ])

        if (isMounted) {
          setRestaurant(liveRestaurant)
          setRestaurantMenu(liveMenu)
        }
      } catch (error) {
        if (isMounted) {
          setRestaurant(null)
          setRestaurantMenu([])
          setLoadError('Restaurant not found or still loading from the server.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    if (restaurantId) {
      loadRestaurantData()
    }

    return () => {
      isMounted = false
    }
  }, [restaurantId])

  useEffect(() => {
    if (!restaurantId) return

    const socketToken = token || 'guest-token'
    const socket = getRealtimeSocket('customer', socketToken)

    const handleRestaurantStatusUpdated = (data: { restaurantId: string; status: string }) => {
      if (data.restaurantId === restaurantId) {
        setRestaurant((prev) =>
          prev ? { ...prev, status: data.status, isOpen: data.status === 'OPEN' } : null
        )
      }
    }

    socket.on('restaurantStatusUpdated', handleRestaurantStatusUpdated)

    return () => {
      socket.off('restaurantStatusUpdated', handleRestaurantStatusUpdated)
    }
  }, [token, restaurantId])

  const getItemQuantity = (menuItemId: string) => {
    const item = items.find((entry) => entry.menuItem.id === menuItemId)
    return item ? item.quantity : 0
  }

  const groupedMenu = restaurantMenu.reduce<Record<string, MenuItem[]>>((accumulator, item) => {
    if (!accumulator[item.category]) {
      accumulator[item.category] = []
    }

    accumulator[item.category].push(item)
    return accumulator
  }, {})

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-6">
              <div className="h-8 w-56 animate-pulse rounded bg-gray-200" />
              <div className="mt-4 h-4 w-72 animate-pulse rounded bg-gray-200" />
              <div className="mt-8 space-y-3">
                <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />
                <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />
                <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
        <MobileNav />
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <Card>
            <CardContent className="p-8 text-center">
              <h1 className="text-2xl font-bold text-gray-900">Restaurant unavailable</h1>
              <p className="mt-2 text-gray-600">
                {loadError || 'This restaurant could not be loaded right now.'}
              </p>
              <Link href="/" className="mt-6 inline-flex">
                <Button>Back to Restaurants</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        <Footer />
        <MobileNav />
      </div>
    )
  }

  const isRestaurantAvailable = restaurant?.status === 'OPEN'
  const heroImage = restaurant.image?.trim() || restaurant.bannerImage?.trim() || FALLBACK_RESTAURANT_IMAGE

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Header />

      <div className="relative h-64 md:h-80">
        <Image
          src={heroImage}
          alt={restaurant.name}
          width={1200}
          height={400}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="mb-2 text-3xl font-bold text-white md:text-4xl">{restaurant.name}</h1>
            <div className="flex items-center gap-4 text-white/90">
              <div className="flex items-center gap-1">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{restaurant.rating}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-5 w-5" />
                <span>{restaurant.deliveryTime}</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-5 w-5" />
                <span>{formatPrice(restaurant.priceForOne)} for one</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Real-time Locked Ordering Warning Banner */}
        {restaurant.status && restaurant.status !== 'OPEN' && (
          <div className="mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-amber-700 font-semibold flex items-center gap-3 backdrop-blur-md">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
            </span>
            <span>This restaurant is currently not accepting orders. Add-to-cart has been disabled.</span>
          </div>
        )}

        <div className="space-y-8">
          {Object.keys(groupedMenu).length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-gray-600">
                This restaurant does not have menu items published yet.
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedMenu).map(([category, categoryItems], categoryIndex) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: categoryIndex * 0.1 }}
                viewport={{ once: true }}
              >
                <h2 className="mb-4 text-2xl font-bold text-gray-900">{category}</h2>
                <div className="space-y-4">
                  {categoryItems.map((item) => {
                    const quantity = getItemQuantity(item.id)
                    const itemImage = item.image?.trim() || FALLBACK_MENU_ITEM_IMAGE

                    return (
                      <Card key={item.id} className="overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex gap-4">
                            <div className="flex-1">
                              <div className="mb-2 flex items-start gap-2">
                                <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                                {item.isVeg ? (
                                  <span className="flex h-4 w-4 items-center justify-center border-2 border-green-500">
                                    <span className="h-2 w-2 rounded-full bg-green-500" />
                                  </span>
                                ) : null}
                                {item.isBestseller ? (
                                  <Badge variant="secondary" className="text-xs">
                                    Bestseller
                                  </Badge>
                                ) : null}
                                {item.inStock === false ? (
                                  <Badge variant="destructive" className="text-xs">
                                    Out of Stock
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mb-2 line-clamp-2 text-sm text-gray-600">{item.description}</p>
                              <div className="flex items-center justify-between">
                                <span className="text-lg font-bold text-gray-900">
                                  {formatPrice(item.price)}
                                </span>
                                <div className="flex items-center gap-2">
                                    {quantity === 0 ? (
                                    <Button
                                      size="sm"
                                      onClick={() => addItem(item)}
                                      disabled={item.inStock === false || !isRestaurantAvailable}
                                      className="min-w-[112px] border-0 bg-gradient-to-r from-orange-500 to-red-500 font-semibold text-white shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-red-600 disabled:bg-gray-300 disabled:text-white"
                                    >
                                      <Plus className="mr-1 h-4 w-4" />
                                      {item.inStock === false ? 'Unavailable' : !isRestaurantAvailable ? 'Closed' : 'Add'}
                                    </Button>
                                  ) : (
                                    <div className="flex items-center gap-1 rounded-full bg-orange-50 dark:bg-slate-800 px-1 py-1">
                                      <Button
                                        size="sm"
                                        className="h-10 w-10 rounded-full border border-orange-200 bg-white p-0 text-xl font-black leading-none text-orange-700 shadow-none hover:bg-orange-100 active:scale-90 transition-transform"
                                        onClick={() => updateQuantity(item.id, quantity - 1)}
                                      >
                                        <span aria-hidden="true">-</span>
                                        <span className="sr-only">Decrease quantity</span>
                                      </Button>
                                      <span className="min-w-[2.5rem] text-center text-lg font-black text-orange-700 dark:text-orange-400 bg-white dark:bg-slate-900 rounded-lg py-1 px-2">
                                        {quantity}
                                      </span>
                                      <Button
                                        size="sm"
                                        className="h-10 w-10 rounded-full bg-gradient-to-r from-orange-500 to-red-500 p-0 text-xl font-black leading-none text-white shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-red-600 active:scale-90 transition-transform"
                                        disabled={item.inStock === false || !isRestaurantAvailable}
                                        onClick={() => updateQuantity(item.id, quantity + 1)}
                                      >
                                        <span aria-hidden="true">+</span>
                                        <span className="sr-only">Increase quantity</span>
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="relative h-24 w-24 flex-shrink-0">
                              <Image
                                src={itemImage}
                                alt={item.name}
                                width={100}
                                height={100}
                                className="h-full w-full rounded-xl object-cover"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <Footer />
      <MobileNav />
    </div>
  )
}
