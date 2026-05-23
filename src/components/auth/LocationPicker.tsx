'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { loadGoogleMaps } from '@/lib/google-maps'
import { Button } from '@/components/ui/Button'

interface LocationPickerProps {
  latitude: number | string
  longitude: number | string
  onChange: (lat: number, lng: number) => void
  defaultLocation?: { lat: number; lng: number }
}

export function LocationPicker({ latitude, longitude, onChange, defaultLocation = { lat: 17.3850, lng: 78.4867 } /* Default: Hyderabad */ }: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any | null>(null)
  const [marker, setMarker] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

    loadGoogleMaps(apiKey)
      .then((google) => {
        if (!mounted || !mapRef.current) return

        const initialLat = latitude ? Number(latitude) : defaultLocation.lat
        const initialLng = longitude ? Number(longitude) : defaultLocation.lng

        const newMap = new google.maps.Map(mapRef.current, {
          center: { lat: initialLat, lng: initialLng },
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        })

        const newMarker = new google.maps.Marker({
          map: newMap,
          position: { lat: initialLat, lng: initialLng },
          draggable: true,
          animation: google.maps.Animation.DROP,
        })

        // Handle marker drag
        newMarker.addListener('dragend', () => {
          const position = newMarker.getPosition()
          if (position) {
            onChange(position.lat(), position.lng())
          }
        })

        // Handle map click
        newMap.addListener('click', (e: any) => {
          const latLng = e.latLng
          if (latLng) {
            newMarker.setPosition(latLng)
            onChange(latLng.lat(), latLng.lng())
          }
        })

        setMap(newMap)
        setMarker(newMarker)
        setIsLoading(false)
      })
      .catch((err) => {
        if (mounted) {
          setError('Failed to load Google Maps')
          setIsLoading(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [defaultLocation.lat, defaultLocation.lng])

  // Update marker if props change externally
  useEffect(() => {
    if (marker && map && latitude && longitude) {
      const lat = Number(latitude)
      const lng = Number(longitude)
      const currentPos = marker.getPosition()
      
      if (!currentPos || currentPos.lat() !== lat || currentPos.lng() !== lng) {
        const newPos = { lat, lng }
        marker.setPosition(newPos)
        map.panTo(newPos)
      }
    }
  }, [latitude, longitude, marker, map])

  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      setIsLoading(true)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude: lat, longitude: lng } = position.coords
          onChange(lat, lng)
          if (map && marker) {
            const newPos = { lat, lng }
            marker.setPosition(newPos)
            map.panTo(newPos)
            map.setZoom(17)
          }
          setIsLoading(false)
        },
        (err) => {
          setError('Could not access your location')
          setIsLoading(false)
        }
      )
    } else {
      setError('Geolocation is not supported by your browser')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-300">
          Pin Your Exact Location
        </label>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          className="h-7 text-xs border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 transition-colors"
          onClick={getCurrentLocation}
        >
          <MapPin className="w-3 h-3 mr-1" /> Use Current Location
        </Button>
      </div>

      <div className="relative h-64 rounded-xl overflow-hidden border border-slate-600 shadow-inner bg-slate-800">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800/80 backdrop-blur-sm z-10">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        )}
        
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 z-10 p-4 text-center">
            <MapPin className="w-8 h-8 text-slate-500 mb-2" />
            <p className="text-sm text-rose-400">{error}</p>
          </div>
        ) : (
          <div ref={mapRef} className="w-full h-full" />
        )}
      </div>
      
      <div className="flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            readOnly
            value={latitude || ''}
            placeholder="Latitude"
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-xs font-mono text-slate-300"
          />
        </div>
        <div className="flex-1">
          <input
            type="text"
            readOnly
            value={longitude || ''}
            placeholder="Longitude"
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-xs font-mono text-slate-300"
          />
        </div>
      </div>
    </div>
  )
}
