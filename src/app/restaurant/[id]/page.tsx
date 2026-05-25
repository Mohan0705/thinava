'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Star, Clock, ImageIcon, MapPin, Plus, Minus, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { fetchRestaurant, fetchRestaurantMenu } from '@/lib/customer-api'
import { useCartStore } from '@/store/cartStore'
import { getRealtimeSocket } from '@/lib/realtime'
import { useAuthStore } from '@/store/authStore'
import { formatPrice } from '@/lib/utils'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import MobileNav from '@/components/layout/MobileNav'
import { MenuItem, Restaurant } from '@/types'
import { cn } from '@/lib/utils'
import { getOptimizedCloudinaryImageUrl } from '@/lib/cloudinary-image'

function MenuQuantityControl({
  quantity,
  disabled,
  onDecrease,
  onIncrease,
}: {
  quantity: number
  disabled?: boolean
  onDecrease: () => void
  onIncrease: () => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-thinava-border bg-thinava-bg p-0.5">
      <button
        type="button"
        onClick={onDecrease}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-thinava-primary thinava-touch"
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-[1.75rem] text-center text-sm font-bold text-thinava-text">{quantity}</span>
      <button
        type="button"
        onClick={onIncrease}
        disabled={disabled}
        className="flex h-9 w-9 items-center justify-center rounded-full thinava-gradient-bg text-white disabled:opacity-50 thinava-touch"
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function RestaurantPage() {
  const params = useParams()
  const restaurantId = typeof params?.id === 'string' ? params.id : ''
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [restaurantMenu, setRestaurantMenu] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('')

  const token = useAuthStore((state) => state.token)
  const { items, addItem, updateQuantity, getItemCount } = useCartStore()

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
      } catch {
        if (isMounted) {
          setRestaurant(null)
          setRestaurantMenu([])
          setLoadError('Restaurant not found or still loading from the server.')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    if (restaurantId) loadRestaurantData()

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
    if (!accumulator[item.category]) accumulator[item.category] = []
    accumulator[item.category].push(item)
    return accumulator
  }, {})

  const categories = useMemo(() => Object.keys(groupedMenu), [groupedMenu])

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0])
    }
  }, [categories, activeCategory])

  const cartCount = getItemCount()

  if (loading) {
    return (
      <div className="thinava-page-mobile">
        <Header />
        <Skeleton className="h-48 w-full rounded-none" />
        <div className="container mx-auto space-y-3 px-4 py-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <Footer />
        <MobileNav />
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="thinava-page-mobile">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <Card>
            <CardContent className="p-8 text-center">
              <h1 className="text-xl font-bold text-thinava-text">Restaurant unavailable</h1>
              <p className="mt-2 text-sm text-gray-600">
                {loadError || 'This restaurant could not be loaded right now.'}
              </p>
              <Link href="/" className="mt-6 inline-flex">
                <Button>Back to restaurants</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        <Footer />
        <MobileNav />
      </div>
    )
  }

  const isRestaurantAvailable = restaurant.isOpen && (!restaurant.status || restaurant.status === 'OPEN')
  const restaurantStatusLabel = restaurant.status === 'TEMPORARILY_UNAVAILABLE'
    ? 'Currently Unavailable'
    : 'Currently Closed'
  const heroImage = getOptimizedCloudinaryImageUrl(
    restaurant.bannerImage?.trim() || restaurant.image?.trim() || '',
    { width: 1600, crop: 'fill', quality: 'auto:good' }
  )

  return (
    <div className="thinava-page-mobile">
      <Header />

      <div className="relative h-44 md:h-52">
        {heroImage ? (
          <Image src={heroImage} alt={restaurant.name} fill className="object-cover" priority sizes="100vw" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-orange-50 text-orange-500">
            <ImageIcon className="h-12 w-12" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-bold text-white md:text-3xl">{restaurant.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/90">
              <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 backdrop-blur-sm">
                <Star className="h-3.5 w-3.5 fill-thinava-rating text-thinava-rating" />
                <span className="font-semibold">
                  {Number(restaurant.rating || 0).toFixed(1)} ({restaurant.ratingCount ?? 0})
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {restaurant.deliveryTime}
              </span>
              {restaurant.formattedAddress ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {restaurant.formattedAddress}
                </span>
              ) : null}
              {!isRestaurantAvailable ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-bold text-slate-900">
                <MapPin className="h-3.5 w-3.5" />
                  {restaurantStatusLabel}
                </span>
              ) : null}
            </div>
          </motion.div>
        </div>
      </div>

      {categories.length > 1 ? (
        <div className="sticky top-[73px] z-30 border-b border-thinava-border bg-white/95 backdrop-blur-md">
          <div className="container mx-auto px-4">
            <div className="flex gap-2 overflow-x-auto py-3 scrollbar-hide">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    setActiveCategory(category)
                    document.getElementById(`menu-${category}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className={cn(
                    'shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                    activeCategory === category
                      ? 'bg-thinava-primary text-white'
                      : 'bg-thinava-bg text-thinava-text hover:bg-orange-100'
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="container mx-auto px-4 py-5 pb-24">
        {!isRestaurantAvailable && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-800 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.35)]">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-slate-700" />
            </span>
            {restaurantStatusLabel}. This restaurant is not accepting orders right now.
          </div>
        )}

        <div className="space-y-8">
          {categories.length === 0 ? (
            <Card>
              <CardContent className="p-5 text-sm text-gray-600">
                This restaurant does not have menu items published yet.
              </CardContent>
            </Card>
          ) : (
            categories.map((category, categoryIndex) => (
              <motion.section
                key={category}
                id={`menu-${category}`}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: categoryIndex * 0.05 }}
                viewport={{ once: true }}
                className="scroll-mt-36"
              >
                <h2 className="mb-3 text-lg font-bold text-thinava-text">{category}</h2>
                <div className="space-y-3">
                  {groupedMenu[category].map((item) => {
                    const quantity = getItemQuantity(item.id)
                    const itemImage = getOptimizedCloudinaryImageUrl(item.image?.trim() || '', {
                      width: 240,
                      height: 240,
                      crop: 'fill',
                    })

                    return (
                      <Card key={item.id} className="overflow-hidden transition-shadow hover:shadow-card-hover">
                        <CardContent className="flex gap-3 p-3 sm:gap-4 sm:p-4">
                          <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl sm:h-24 sm:w-24">
                            {itemImage ? (
                              <Image src={itemImage} alt={item.name} fill sizes="96px" className="object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-orange-50 text-orange-500">
                                <ImageIcon className="h-6 w-6" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start gap-1.5">
                              <h3 className="font-semibold text-thinava-text">{item.name}</h3>
                              {item.isVeg ? (
                                <span
                                  className="flex h-4 w-4 shrink-0 items-center justify-center border-2 border-thinava-success"
                                  title="Vegetarian"
                                >
                                  <span className="h-2 w-2 rounded-full bg-thinava-success" />
                                </span>
                              ) : null}
                              {item.isBestseller ? (
                                <Badge variant="secondary" className="text-[10px]">Bestseller</Badge>
                              ) : null}
                              {item.inStock === false ? (
                                <Badge variant="destructive" className="text-[10px]">Out of stock</Badge>
                              ) : null}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-gray-500 sm:text-sm">{item.description}</p>
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <span className="font-bold text-thinava-text">{formatPrice(item.price)}</span>
                              {quantity === 0 ? (
                                <Button
                                  size="sm"
                                  onClick={() => addItem(item)}
                                  disabled={item.inStock === false || !isRestaurantAvailable}
                                  className="min-w-[5.5rem]"
                                >
                                  <Plus className="mr-1 h-3.5 w-3.5" />
                                  {item.inStock === false
                                    ? 'Unavailable'
                                    : !isRestaurantAvailable
                                      ? 'Closed'
                                      : 'Add'}
                                </Button>
                              ) : (
                                <MenuQuantityControl
                                  quantity={quantity}
                                  disabled={item.inStock === false || !isRestaurantAvailable}
                                  onDecrease={() => updateQuantity(item.id, quantity - 1)}
                                  onIncrease={() => updateQuantity(item.id, quantity + 1)}
                                />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </motion.section>
            ))
          )}
        </div>
      </div>

      {cartCount > 0 ? (
        <div className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-4 right-4 z-40 md:bottom-6 md:left-auto md:right-6 md:w-80">
          <Link href="/cart">
            <div className="flex items-center justify-between gap-3 rounded-2xl thinava-gradient-bg px-5 py-3.5 text-white shadow-lg">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                <span className="text-sm font-semibold">{cartCount} in cart</span>
              </div>
              <span className="text-sm font-bold">View cart →</span>
            </div>
          </Link>
        </div>
      ) : null}

      <Footer />
      <MobileNav />
    </div>
  )
}
