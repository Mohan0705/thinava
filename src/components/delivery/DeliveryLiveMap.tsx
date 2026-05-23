'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { loadGoogleMaps, resetGoogleMapsScript } from '@/lib/google-maps'

type Coordinate = {
  latitude: number
  longitude: number
}

export function DeliveryLiveMap({
  rider,
  restaurant,
  customer,
  heightClassName = 'h-[52vh]',
}: {
  rider?: Coordinate | null
  restaurant?: Coordinate | null
  customer?: Coordinate | null
  heightClassName?: string
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'loading' | 'google' | 'fallback'>('loading')
  const [errorMessage, setErrorMessage] = useState('Google Maps could not be loaded for this delivery route.')
  const [retryKey, setRetryKey] = useState(0)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

  useEffect(() => {
    const isValidCoord = (c?: Coordinate | null) =>
      !!c && isFinite(Number(c.latitude)) && isFinite(Number(c.longitude))

    if (!mapRef.current || !isValidCoord(restaurant) || !isValidCoord(customer)) {
      setErrorMessage('Live route coordinates are unavailable for this delivery.')
      setMode('fallback')
      return
    }

    let cancelled = false
    setMode('loading')
    setErrorMessage('Google Maps could not be loaded for this delivery route.')

    loadGoogleMaps(apiKey)
      .then((google) => {
        if (cancelled || !mapRef.current || !window.google?.maps) {
          return
        }

        const toCoord = (c: Coordinate) => ({ latitude: Number(c.latitude), longitude: Number(c.longitude) })

        const centerCoord = rider && isFinite(Number(rider.latitude)) && isFinite(Number(rider.longitude)) ? toCoord(rider) : toCoord(restaurant as Coordinate)

        const map = new google.maps.Map(mapRef.current, {
          center: { lat: centerCoord.latitude, lng: centerCoord.longitude },
          zoom: 13,
          disableDefaultUI: true,
          styles: [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          ],
        })

        const bounds = new google.maps.LatLngBounds()
        const points = [
          rider ? { ...toCoord(rider), label: 'Rider', color: '#0f172a' } : null,
          { ...toCoord(restaurant as Coordinate), label: 'Restaurant', color: '#f97316' },
          { ...toCoord(customer as Coordinate), label: 'Customer', color: '#2563eb' },
        ].filter(Boolean)

        points.forEach((point: any) => {
          if (!isFinite(Number(point.latitude)) || !isFinite(Number(point.longitude))) return

          try {
            const marker = new google.maps.Marker({
              position: { lat: point.latitude, lng: point.longitude },
              map,
              title: point.label,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: point.label === 'Rider' ? 8 : 7,
                fillColor: point.color,
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              },
            })

            bounds.extend(marker.getPosition())
          } catch (err) {
            // ignore invalid marker positions
          }
        })

        const directionsService = new google.maps.DirectionsService()
        const directionsRenderer = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#f97316',
            strokeOpacity: 0.92,
            strokeWeight: 5,
          },
        })

        try {
          directionsService.route(
            {
              origin: rider
                ? { lat: Number(rider.latitude), lng: Number(rider.longitude) }
                : { lat: Number((restaurant as Coordinate).latitude), lng: Number((restaurant as Coordinate).longitude) },
              destination: { lat: Number((customer as Coordinate).latitude), lng: Number((customer as Coordinate).longitude) },
              waypoints: rider
                ? [
                    {
                      location: { lat: Number((restaurant as Coordinate).latitude), lng: Number((restaurant as Coordinate).longitude) },
                      stopover: true,
                    },
                  ]
                : [],
              travelMode: google.maps.TravelMode.DRIVING,
              optimizeWaypoints: false,
            },
            (result: unknown, statusText: string) => {
              if (!cancelled && statusText === 'OK' && result) {
                directionsRenderer.setDirections(result)
              }
            }
          )
        } catch (err) {
          // ignore routing errors
        }

        map.fitBounds(bounds, 48)
        setMode('google')
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        setErrorMessage(error instanceof Error ? error.message : 'Unable to load Google Maps.')
        setMode('fallback')
      })

    return () => {
      cancelled = true
    }
  }, [apiKey, customer, restaurant, rider, retryKey])

  return (
    <div className={`relative overflow-hidden rounded-[32px] border border-white/40 bg-slate-950 ${heightClassName}`}>
      <div ref={mapRef} className={`absolute inset-0 ${mode === 'google' ? 'block' : 'hidden'}`} />

      {mode === 'loading' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,#07172f_0%,#0b1f42_100%)] px-6 text-center">
          <div>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-orange-300/20 bg-orange-500/10 text-orange-200">
              <Loader className="h-6 w-6 animate-spin" />
            </div>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">Loading maps</p>
            <p className="mt-2 text-sm text-white/65">
              Connecting to Google Maps and preparing the live route.
            </p>
          </div>
        </div>
      ) : null}

      {mode === 'fallback' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,#07172f_0%,#0b1f42_100%)] px-6 text-center">
          <div>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-orange-300/20 bg-orange-500/10 text-orange-200">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">Maps unavailable</p>
            <p className="mt-2 text-sm text-white/65">
              {errorMessage}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 border-white/15 bg-white/5 text-white hover:bg-white/10"
              onClick={() => {
                resetGoogleMapsScript()
                setRetryKey((current) => current + 1)
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Retry maps
            </Button>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/15 bg-slate-950/72 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur">
        Live route
      </div>
    </div>
  )
}
