'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, Search, X } from 'lucide-react'
import { searchPlaces } from '@/lib/maps/nominatim'
import type { GeocodeResult } from '@/lib/maps/types'
import { cn } from '@/lib/utils'

interface PlacesAutocompleteProps {
  apiKey?: string
  onSelect: (place: {
    address: string
    lat: number
    lng: number
    placeId: string
    formatted: string
  }) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  initialValue?: string
}

export function PlacesAutocomplete({
  onSelect,
  placeholder = 'Enter address...',
  className = '',
  disabled = false,
  initialValue = '',
}: PlacesAutocompleteProps) {
  const [value, setValue] = useState(initialValue)
  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<number | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
    }

    const query = value.trim()
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    if (query.length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    debounceRef.current = window.setTimeout(() => {
      setIsLoading(true)
      setError(null)
      searchPlaces(query, controller.signal)
        .then((results) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) {
            return
          }

          setSuggestions(results)
          setShowSuggestions(results.length > 0)
        })
        .catch((caught) => {
          if ((caught as Error).name === 'AbortError' || requestId !== requestIdRef.current) {
            return
          }

          setSuggestions([])
          setError('Address suggestions are unavailable right now.')
        })
        .finally(() => {
          if (requestId === requestIdRef.current) {
            setIsLoading(false)
          }
        })
    }, 450)

    return () => {
      controller.abort()
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
      }
    }
  }, [value])

  const handleSelectSuggestion = (suggestion: GeocodeResult) => {
    setValue(suggestion.displayName)
    setSuggestions([])
    setShowSuggestions(false)
    setError(null)

    onSelect({
      address: suggestion.displayName,
      lat: suggestion.lat,
      lng: suggestion.lng,
      placeId: suggestion.placeId,
      formatted: suggestion.displayName,
    })
  }

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'w-full rounded-lg border border-gray-300 py-2 pl-10 pr-10 transition-colors focus:border-transparent focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:bg-gray-100',
            className
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
          ) : value ? (
            <button
              type="button"
              onClick={() => {
                setValue('')
                setSuggestions([])
                setShowSuggestions(false)
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Clear address"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      {showSuggestions && suggestions.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.placeId}
              onClick={() => handleSelectSuggestion(suggestion)}
              className="w-full border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-gray-50"
              type="button"
            >
              <div className="flex items-start gap-2">
                <MapPin className="mt-1 h-4 w-4 flex-shrink-0 text-orange-500" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{suggestion.shortName}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">{suggestion.displayName}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
