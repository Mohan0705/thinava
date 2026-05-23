'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { loadGoogleMaps } from '@/lib/google-maps'
import { MapPin } from 'lucide-react'

interface PlacesAutocompleteProps {
  apiKey: string
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
  apiKey,
  onSelect,
  placeholder = 'Enter address...',
  className = '',
  disabled = false,
  initialValue = '',
}: PlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(initialValue)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const autocompleteServiceRef = useRef<any>(null)
  const placesServiceRef = useRef<any>(null)

  useEffect(() => {
    if (!apiKey || apiKey.includes('your-google-maps-api-key')) {
      setError('Google Maps API key not configured')
      return
    }

    const initGooglePlaces = async () => {
      try {
        setIsLoading(true)
        const google = await loadGoogleMaps(apiKey)

        if (google?.maps?.places) {
          autocompleteServiceRef.current = new google.maps.places.AutocompleteService()
          placesServiceRef.current = new google.maps.places.PlacesService(
            document.createElement('div')
          )
          setError(null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Google Places')
      } finally {
        setIsLoading(false)
      }
    }

    initGooglePlaces()
  }, [apiKey])

  const handleInputChange = useCallback(
    async (inputValue: string) => {
      setValue(inputValue)

      if (!inputValue || inputValue.length < 3) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }

      if (!autocompleteServiceRef.current) {
        return
      }

      try {
        const predictions = await autocompleteServiceRef.current.getPlacePredictions({
          input: inputValue,
          componentRestrictions: { country: 'in' }, // Restrict to India
          types: ['address'],
        })

        setSuggestions(predictions.predictions || [])
        setShowSuggestions(true)
      } catch (err) {
        console.error('Error fetching predictions:', err)
        setSuggestions([])
      }
    },
    []
  )

  const handleSelectSuggestion = useCallback(
    async (prediction: any) => {
      if (!placesServiceRef.current) {
        return
      }

      try {
        const details = await new Promise((resolve, reject) => {
          placesServiceRef.current.getDetails(
            {
              placeId: prediction.place_id,
              fields: [
                'formatted_address',
                'geometry',
                'place_id',
                'address_components',
              ],
            },
            (place: any, status: string) => {
              if (status === 'OK') {
                resolve(place)
              } else {
                reject(new Error(`Failed to fetch place details: ${status}`))
              }
            }
          )
        })

        const place = details as any
        setValue(place.formatted_address || prediction.description)
        setSuggestions([])
        setShowSuggestions(false)

        onSelect({
          address: place.formatted_address || prediction.description,
          lat: place.geometry?.location?.lat?.() || 0,
          lng: place.geometry?.location?.lng?.() || 0,
          placeId: prediction.place_id,
          formatted: place.formatted_address || prediction.description,
        })
      } catch (err) {
        console.error('Error selecting place:', err)
        setError(err instanceof Error ? err.message : 'Failed to select place')
      }
    },
    [onSelect]
  )

  return (
    <div className="relative w-full">
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          <MapPin className="h-5 w-5" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => value && showSuggestions && setShowSuggestions(true)}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors ${className}`}
        />
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.place_id}
              onClick={() => handleSelectSuggestion(suggestion)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
              type="button"
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {suggestion.main_text}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {suggestion.secondary_text}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
