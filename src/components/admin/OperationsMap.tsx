'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { LiveMapPayload } from '@/features/admin/types'
import { loadGoogleMaps, resetGoogleMapsScript } from '@/lib/google-maps'

function projectPoint(
  latitude: number,
  longitude: number,
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }
) {
  const x = ((longitude - bounds.minLng) / Math.max(bounds.maxLng - bounds.minLng, 0.0001)) * 100
  const y = ((bounds.maxLat - latitude) / Math.max(bounds.maxLat - bounds.minLat, 0.0001)) * 100

  return {
    x: Math.min(98, Math.max(2, x)),
    y: Math.min(98, Math.max(2, y)),
  }
}

function OperationsMapFallback({
  compact,
  data,
}: {
  compact: boolean
  data: LiveMapPayload
}) {
  const allCoordinates = [
    ...data.riders.map((item) => ({ latitude: item.latitude, longitude: item.longitude })),
    ...data.restaurants.map((item) => ({ latitude: item.latitude, longitude: item.longitude })),
    ...data.deliveries.flatMap((item) => item.route),
  ]

  const bounds = {
    minLat: Math.min(...allCoordinates.map((item) => item.latitude), data.center.lat - 0.02),
    maxLat: Math.max(...allCoordinates.map((item) => item.latitude), data.center.lat + 0.02),
    minLng: Math.min(...allCoordinates.map((item) => item.longitude), data.center.lng - 0.02),
    maxLng: Math.max(...allCoordinates.map((item) => item.longitude), data.center.lng + 0.02),
  }

  return (
    <div className={`relative overflow-hidden rounded-[28px] border border-orange-100 ${compact ? 'h-[360px]' : 'h-[520px]'}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(251,146,60,0.28),transparent_32%),radial-gradient(circle_at_85%_18%,rgba(244,63,94,0.18),transparent_26%),linear-gradient(180deg,#fff7ed_0%,#fff 48%,#fff7ed_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(251,146,60,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(251,146,60,0.12)_1px,transparent_1px)] bg-[length:80px_80px]" />

      <svg className="absolute inset-0 h-full w-full">
        {data.deliveries.map((delivery) => {
          const points = delivery.route.map((point) => projectPoint(point.latitude, point.longitude, bounds))
          const path = points.map((point) => `${point.x},${point.y}`).join(' ')
          return (
            <polyline
              key={delivery.id}
              points={path}
              fill="none"
              stroke="rgba(249,115,22,0.9)"
              strokeWidth="1.8"
              strokeDasharray="6 6"
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>

      {data.hotspots.map((hotspot) => {
        const point = projectPoint(hotspot.latitude, hotspot.longitude, bounds)
        const size = 46 + hotspot.intensity * 12
        return (
          <div
            key={hotspot.zone}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-400/20 ring-1 ring-orange-400/35"
            style={{ left: `${point.x}%`, top: `${point.y}%`, width: size, height: size }}
          />
        )
      })}

      {data.restaurants.map((restaurant) => {
        const point = projectPoint(restaurant.latitude, restaurant.longitude, bounds)
        return (
          <div
            key={restaurant.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            <div className="rounded-full border border-orange-300 bg-white px-2 py-1 text-[11px] font-semibold text-orange-700 shadow-sm">
              {restaurant.name}
            </div>
          </div>
        )
      })}

      {data.riders.map((rider) => {
        const point = projectPoint(rider.latitude, rider.longitude, bounds)
        return (
          <div
            key={rider.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-emerald-500/25" />
            <div className="mt-2 rounded-full bg-slate-950/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-md">
              {rider.name}
            </div>
          </div>
        )
      })}

      <div className="absolute bottom-4 left-4 right-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Riders</div>
          <div className="mt-1 text-2xl font-bold text-slate-950">{data.riders.length}</div>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Active Routes</div>
          <div className="mt-1 text-2xl font-bold text-slate-950">{data.deliveries.length}</div>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Busy Zones</div>
          <div className="mt-1 text-2xl font-bold text-slate-950">{data.hotspots.length}</div>
        </div>
      </div>
    </div>
  )
}

export function OperationsMap({
  data,
  title = 'Live Operations Map',
  compact = false,
}: {
  data: LiveMapPayload
  title?: string
  compact?: boolean
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'loading' | 'google' | 'fallback'>('loading')
  const [errorMessage, setErrorMessage] = useState('Google Maps could not be loaded for the operations view.')
  const [retryKey, setRetryKey] = useState(0)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

  const stats = useMemo(
    () => ({
      riders: data.riders.length,
      deliveries: data.deliveries.length,
      hotspots: data.hotspots.length,
    }),
    [data]
  )

  useEffect(() => {
    if (!mapRef.current) {
      return
    }

    setMode('loading')

    loadGoogleMaps(apiKey)
      .then((google) => {
        if (!mapRef.current) {
          return
        }

        const map = new google.maps.Map(mapRef.current, {
          center: { lat: data.center.lat, lng: data.center.lng },
          zoom: 13,
          disableDefaultUI: true,
          styles: [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          ],
        })

        const bounds = new google.maps.LatLngBounds()

        data.restaurants.forEach((restaurant) => {
          const position = { lat: restaurant.latitude, lng: restaurant.longitude }
          bounds.extend(position)

          new google.maps.Marker({
            position,
            map,
            title: restaurant.name,
            label: {
              text: 'R',
              color: '#ffffff',
              fontWeight: '700',
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#f97316',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
          })
        })

        data.riders.forEach((rider) => {
          const position = { lat: rider.latitude, lng: rider.longitude }
          bounds.extend(position)

          new google.maps.Marker({
            position,
            map,
            title: rider.name,
            label: {
              text: 'D',
              color: '#ffffff',
              fontWeight: '700',
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: '#10b981',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
          })
        })

        data.deliveries.forEach((delivery) => {
          const path = delivery.route.map((point) => ({ lat: point.latitude, lng: point.longitude }))
          path.forEach((point) => bounds.extend(point))

          new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: '#f97316',
            strokeOpacity: 0.92,
            strokeWeight: 4,
            map,
          })
        })

        data.hotspots.forEach((hotspot) => {
          const center = { lat: hotspot.latitude, lng: hotspot.longitude }
          bounds.extend(center)

          new google.maps.Circle({
            center,
            map,
            radius: 110 + hotspot.intensity * 35,
            fillColor: '#fb923c',
            fillOpacity: 0.16,
            strokeColor: '#f97316',
            strokeOpacity: 0.45,
            strokeWeight: 1,
          })
        })

        map.fitBounds(bounds, 56)
        setMode('google')
      })
      .catch((error: unknown) => {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load Google Maps.')
        setMode('fallback')
      })
  }, [apiKey, data, retryKey])

  return (
    <Card className="border border-white/70 bg-white/90">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Dispatch-style live view for rider positions, route flow, restaurant clusters, and hotspot intensity.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          Tadepalligudem
        </div>
      </CardHeader>
      <CardContent>
        {mode === 'google' || mode === 'loading' ? (
          <div className={`relative overflow-hidden rounded-[28px] border border-orange-100 ${compact ? 'h-[360px]' : 'h-[520px]'}`}>
            <div ref={mapRef} className="absolute inset-0" />
            {mode === 'loading' ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur">
                <div className="text-center">
                  <Loader className="mx-auto h-7 w-7 animate-spin text-orange-500" />
                  <p className="mt-3 text-sm font-medium text-slate-600">Loading Google Maps operations view...</p>
                </div>
              </div>
            ) : null}

            <div className="absolute bottom-4 left-4 right-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Riders</div>
                <div className="mt-1 text-2xl font-bold text-slate-950">{stats.riders}</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Active Routes</div>
                <div className="mt-1 text-2xl font-bold text-slate-950">{stats.deliveries}</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Busy Zones</div>
                <div className="mt-1 text-2xl font-bold text-slate-950">{stats.hotspots}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-[28px] border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
              <p className="font-semibold">Google Maps unavailable</p>
              <p className="mt-1">{errorMessage}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                onClick={() => {
                  resetGoogleMapsScript()
                  setRetryKey((current) => current + 1)
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Retry maps
              </Button>
            </div>
            <OperationsMapFallback compact={compact} data={data} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
