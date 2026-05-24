'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Search, SlidersHorizontal, Star, Sparkles, X, ShoppingBag } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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

export default function LiveSearchBar() {
  const router = useRouter()
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [restaurants, setRestaurants] = useState<RestaurantResult[]>([])
  const [menuItems, setMenuItems] = useState<MenuItemResult[]>([])
  const [loading, setLoading] = useState(false)

  // Filters
  const [vegOnly, setVegOnly] = useState<boolean | null>(null) // null = all, true = veg, false = non-veg
  const [minRating, setMinRating] = useState<number>(0)
  const [maxPrice, setMaxPrice] = useState<string>('')

  const searchRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Live Query trigger
  useEffect(() => {
    if (query.trim().length === 0) {
      setRestaurants([])
      setMenuItems([])
      return
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true)
      try {
        let url = `${API_BASE_URL}/search?q=${encodeURIComponent(query)}`
        if (vegOnly !== null) {
          url += `&veg=${vegOnly}`
        }
        if (minRating > 0) {
          url += `&rating=${minRating}`
        }
        if (maxPrice) {
          url += `&maxPrice=${maxPrice}`
        }

        const res = await fetch(url)
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

    return () => clearTimeout(delayDebounce)
  }, [query, vegOnly, minRating, maxPrice])

  const clearSearch = () => {
    setQuery('')
    setRestaurants([])
    setMenuItems([])
    setShowDropdown(false)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    const params = new URLSearchParams()
    params.set('query', query.trim())
    if (vegOnly !== null) params.set('veg', String(vegOnly))
    if (minRating > 0) params.set('rating', String(minRating))
    if (maxPrice) params.set('maxPrice', maxPrice)

    router.push(`/restaurants?${params.toString()}`)
    setShowDropdown(false)
  }

  return (
    <div ref={searchRef} className="relative flex-1 max-w-xl z-50">
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShowDropdown(true)
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-full border border-thinava-border bg-white py-3 pl-12 pr-10 text-sm font-medium text-thinava-text shadow-search placeholder:text-gray-400 transition-all focus:border-thinava-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-thinava-primary/15"
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`absolute right-4 top-1/2 -translate-y-1/2 ${
              showFilters || vegOnly !== null || minRating > 0 || maxPrice
                ? 'text-thinava-primary'
                : 'text-gray-400 hover:text-thinava-text'
            }`}
            title={t('searchFilters')}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Filter drawer */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-50 text-slate-700 dark:text-slate-200"
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                <SlidersHorizontal className="w-4 h-4 text-orange-500" />
                {t('searchFilters')}
              </span>
              <button
                onClick={() => {
                  setVegOnly(null)
                  setMinRating(0)
                  setMaxPrice('')
                }}
                className="text-xs text-orange-500 font-semibold hover:underline"
              >
                Reset
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs mb-3">
              {/* Veg Toggle */}
              <div>
                <span className="block font-medium mb-1.5 text-slate-500 dark:text-slate-400">{t('vegOnly')}</span>
                <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800 font-semibold">
                  <button
                    type="button"
                    onClick={() => setVegOnly(true)}
                    className={`flex-1 py-1.5 text-center transition ${
                      vegOnly === true ? 'bg-green-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    Veg
                  </button>
                  <button
                    type="button"
                    onClick={() => setVegOnly(false)}
                    className={`flex-1 py-1.5 text-center transition ${
                      vegOnly === false ? 'bg-red-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    Non-Veg
                  </button>
                </div>
              </div>

              {/* Min Rating */}
              <div>
                <span className="block font-medium mb-1.5 text-slate-500 dark:text-slate-400">{t('minRating')}</span>
                <select
                  value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                  className="w-full py-1.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  <option value={0}>All Ratings</option>
                  <option value={4}>4.0★ +</option>
                  <option value={4.5}>4.5★ +</option>
                </select>
              </div>

              {/* Max Price */}
              <div>
                <span className="block font-medium mb-1.5 text-slate-500 dark:text-slate-400">{t('maxPrice')}</span>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="₹ Max Price"
                  className="w-full py-1.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Dropdown */}
      <AnimatePresence>
        {showDropdown && query.trim() && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="absolute top-full left-0 right-0 mt-3 max-h-[450px] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-850"
          >
            {loading ? (
              <div className="p-6 text-center text-sm font-semibold text-slate-400 dark:text-slate-500 animate-pulse">
                {t('loading')}
              </div>
            ) : restaurants.length === 0 && menuItems.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('noResults')}</p>
                <p className="text-xs text-slate-400 mt-1">Try double checking your spelling!</p>
              </div>
            ) : (
              <>
                {/* Restaurants */}
                {restaurants.length > 0 && (
                  <div className="p-4">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                      {t('restaurants')}
                    </h3>
                    <div className="space-y-2.5">
                      {restaurants.map((rest) => (
                        <div
                          key={rest.id}
                          onClick={() => {
                            router.push(`/restaurant/${rest.id}`)
                            setShowDropdown(false)
                          }}
                          className="flex items-center gap-3 p-2 rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition duration-150"
                        >
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                            <Image
                              src={rest.image}
                              alt={rest.name}
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{rest.name}</h4>
                            <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{rest.cuisines.join(', ')}</p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              <span>{Number(rest.rating).toFixed(1)}</span>
                            </div>
                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 block mt-0.5">{rest.delivery_time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Menu Items */}
                {menuItems.length > 0 && (
                  <div className="p-4">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1">
                      <ShoppingBag className="w-3.5 h-3.5 text-orange-500" />
                      {t('dishes')}
                    </h3>
                    <div className="space-y-2.5">
                      {menuItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            router.push(`/restaurant/${item.restaurant_id}`)
                            setShowDropdown(false)
                          }}
                          className="flex items-center gap-3 p-2 rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition duration-150"
                        >
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                            {item.image ? (
                              <Image
                                src={item.image}
                                alt={item.name}
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-orange-50 text-orange-500 font-bold text-xs">
                                F
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {/* Veg indicator badge */}
                              <span
                                className={`inline-block w-2.5 h-2.5 rounded-full ${
                                  item.is_veg ? 'bg-green-500' : 'bg-red-500'
                                }`}
                                title={item.is_veg ? 'Vegetarian' : 'Non-vegetarian'}
                              />
                              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{item.name}</h4>
                            </div>
                            <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">from {item.restaurant_name}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-extrabold text-orange-500">₹{Number(item.price)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
