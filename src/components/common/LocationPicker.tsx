'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { loadGoogleMaps } from '@/lib/google-maps'
import { MapPin, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface LocationPickerProps {
  apiKey: string
  onSelect: (location: {
    address: string
    lat: number
    lng: number
  }) => void
  initialLocation?: { lat: number; lng: number }
  disabled?: boolean
}

export function LocationPicker({
  apiKey,
  onSelect,
  initialLocation,
  disabled = false,
}: LocationPickerProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    initialLocation || null
  )
  const [address, setAddress] = useState<string | null>(null)
  const geocoderRef = useRef<any>(null)

  useEffect(() => {
    if (!apiKey || apiKey.includes('your-google-maps-api-key')) {
      setError('Google Maps API key not configured')
      return
    }

    const initGeocoder = async () => {
      try {
        const google = await loadGoogleMaps(apiKey)
        if (google?.maps) {
          geocoderRef.current = new google.maps.Geocoder()
          setError(null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Google Maps')
      }
    }

    initGeocoder()
  }, [apiKey])

  const getCurrentLocation = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const position = await new Promise<GeolocationCoordinates>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos.coords),
          (err) => reject(err)
        )
      })

      const newLocation = {
        lat: position.latitude,
        lng: position.longitude,
      }

      setLocation(newLocation)

      // Reverse geocode to get address
      if (geocoderRef.current) {
        const results = await new Promise<any[]>((resolve, reject) => {
          geocoderRef.current.geocode(
            { location: newLocation },
            (results: any[], status: string) => {
              if (status === 'OK' && results[0]) {
                resolve(results)
              } else {
                reject(new Error(`Geocoding failed: ${status}`))
              }
            }
          )
        })

        if (results[0]) {
          const formattedAddress = results[0].formatted_address
          setAddress(formattedAddress)
          onSelect({
            address: formattedAddress,
            lat: newLocation.lat,
            lng: newLocation.lng,
          })
        }
      } else {
        onSelect({
          address: `${newLocation.lat}, ${newLocation.lng}`,
          lat: newLocation.lat,
          lng: newLocation.lng,
        })
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to get current location'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [onSelect])

  return (
    <div className="space-y-3">
      <Button
        onClick={getCurrentLocation}
        disabled={disabled || loading}
        variant="outline"
        className="w-full gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Getting location...
          </>
        ) : (
          <>
            <MapPin className="h-4 w-4" />
            Use Current Location
          </>
        )}
      </Button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {location && address && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs font-medium text-green-800">Location Selected</p>
          <p className="text-sm text-green-700 mt-1">{address}</p>
          <p className="text-xs text-green-600 mt-1">
            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </p>
        </div>
      )}
    </div>
  )
}
