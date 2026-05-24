'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Search, ShoppingBag, Sparkles, Star, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from '@/lib/i18n'
import { API_BASE_URL } from '@/lib/api'

interface RestaurantResult {
  id: string
  name: string
  image: string
  cuisines: string[]
  rating: number
  delivery_time: string
}

interface MenuItemResult {
  id: string
  restaurant_id: string
  restaurant_name: string
  name: string
  description: string
  price: number
  image: string
  is_veg: boolean
}

export default function LiveSearchBar({ elevated = false }: { elevated?: boolean }) {
  const router = useRouter()
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [restaurants, setRestaurants] = useState<RestaurantResult[]>([])
  const [menuItems, setMenuItems] = useState<MenuItemResult[]>([])
  const [loading, setLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (query.trim().length === 0) {
      setRestaurants([])
      setMenuItems([])
      return
    }

    const delayDebounce = window.setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        if (data.success) {
          setRestaurants(data.restaurants || [])
          setMenuItems(data.menuItems || [])
        }
      } catch (err) {
        console.error('Search failed', err)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => window.clearTimeout(delayDebounce)
  }, [query])

  const clearSearch = () => {
    setQuery('')
    setRestaurants([])
    setMenuItems([])
    setShowDropdown(false)
  }

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!query.trim()) return

    const params = new URLSearchParams()
    params.set('query', query.trim())
    router.push(`/restaurants?${params.toString()}`)
    setShowDropdown(false)
  }

  const inputClassName = elevated
    ? 'h-14 w-full rounded-[1.75rem] border border-white/70 bg-white/95 py-3.5 pl-12 pr-11 text-base font-medium text-[#111827] shadow-[0_18px_40px_-18px_rgba(15,23,42,0.5)] backdrop-blur-md placeholder:text-[#8B95A7] transition-all focus:border-[#FF6B35]/20 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/20'
    : 'w-full rounded-full border border-thinava-border bg-white py-3 pl-12 pr-10 text-sm font-medium text-thinava-text shadow-search placeholder:text-gray-400 transition-all focus:border-thinava-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-thinava-primary/15'
  const placeholderText = elevated ? 'Search "biryani"' : t('searchPlaceholder')

  return (
    <div ref={searchRef} className="relative z-50 max-w-xl flex-1">
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className={`absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 ${elevated ? 'text-[#FF6B35]' : 'text-gray-400'}`}
          />
          <input
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setShowDropdown(true)
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder={placeholderText}
            className={inputClassName}
          />
          {query ? (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </form>

      <AnimatePresence>
        {showDropdown && query.trim() ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="absolute left-0 right-0 top-full z-50 mt-3 max-h-[450px] overflow-hidden overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl divide-y divide-slate-100"
          >
            {loading ? (
              <div className="p-6 text-center text-sm font-semibold text-slate-400 animate-pulse">
                {t('loading')}
              </div>
            ) : restaurants.length === 0 && menuItems.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-bold text-slate-700">{t('noResults')}</p>
                <p className="mt-1 text-xs text-slate-400">Try double checking your spelling.</p>
              </div>
            ) : (
              <>
                {restaurants.length > 0 ? (
                  <div className="p-4">
                    <h3 className="mb-3 flex items-center gap-1 text-xs font-extrabold uppercase tracking-widest text-slate-400">
                      <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                      {t('restaurants')}
                    </h3>
                    <div className="space-y-2.5">
                      {restaurants.map((restaurant) => (
                        <button
                          key={restaurant.id}
                          type="button"
                          onClick={() => {
                            router.push(`/restaurant/${restaurant.id}`)
                            setShowDropdown(false)
                          }}
                          className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-slate-50"
                        >
                          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                            <Image
                              src={restaurant.image}
                              alt={restaurant.name}
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="truncate text-sm font-bold text-slate-800">{restaurant.name}</h4>
                            <p className="truncate text-xs text-slate-400">{restaurant.cuisines.join(', ')}</p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-xs font-bold text-slate-800">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                              <span>{Number(restaurant.rating).toFixed(1)}</span>
                            </div>
                            <span className="mt-0.5 block text-[10px] font-semibold text-slate-400">
                              {restaurant.delivery_time}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {menuItems.length > 0 ? (
                  <div className="p-4">
                    <h3 className="mb-3 flex items-center gap-1 text-xs font-extrabold uppercase tracking-widest text-slate-400">
                      <ShoppingBag className="h-3.5 w-3.5 text-orange-500" />
                      {t('dishes')}
                    </h3>
                    <div className="space-y-2.5">
                      {menuItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            router.push(`/restaurant/${item.restaurant_id}`)
                            setShowDropdown(false)
                          }}
                          className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-slate-50"
                        >
                          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                            {item.image ? (
                              <Image
                                src={item.image}
                                alt={item.name}
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-orange-50 text-xs font-bold text-orange-500">
                                F
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-block h-2.5 w-2.5 rounded-full ${
                                  item.is_veg ? 'bg-green-500' : 'bg-red-500'
                                }`}
                              />
                              <h4 className="truncate text-sm font-bold text-slate-800">{item.name}</h4>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-slate-400">from {item.restaurant_name}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-extrabold text-orange-500">Rs{Number(item.price)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
