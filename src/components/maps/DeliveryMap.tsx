'use client'

import { Navigation } from 'lucide-react'
import { ThinavaMap } from '@/components/maps/ThinavaMap'
import { getMapCenter, routeDistanceLabel, toLatLng } from '@/lib/maps/geo'
import type { Coordinate, MapMarker, MapPolyline } from '@/lib/maps/types'
import { cn } from '@/lib/utils'

export function DeliveryMap({
  rider,
  restaurant,
  customer,
  className,
  darkControls = true,
}: {
  rider?: Coordinate | null
  restaurant?: Coordinate | null
  customer?: Coordinate | null
  className?: string
  darkControls?: boolean
}) {
  const riderPoint = toLatLng(rider)
  const restaurantPoint = toLatLng(restaurant)
  const customerPoint = toLatLng(customer)
  const routePoints = [riderPoint, restaurantPoint, customerPoint].filter(Boolean) as NonNullable<typeof riderPoint>[]

  const markers: MapMarker[] = [
    restaurantPoint
      ? {
          id: 'restaurant',
          position: restaurantPoint,
          label: 'S',
          title: 'Pickup',
          subtitle: 'Restaurant location',
          variant: 'restaurant',
        }
      : null,
    customerPoint
      ? {
          id: 'customer',
          position: customerPoint,
          label: 'C',
          title: 'Drop',
          subtitle: 'Customer location',
          variant: 'customer',
        }
      : null,
    riderPoint
      ? {
          id: 'rider',
          position: riderPoint,
          label: 'D',
          title: 'Rider',
          subtitle: 'Live GPS position',
          variant: 'rider',
          pulse: true,
        }
      : null,
  ].filter(Boolean) as MapMarker[]

  const polylines: MapPolyline[] =
    routePoints.length >= 2
      ? [
          {
            id: 'delivery-route',
            points: routePoints,
            color: '#ff6b35',
            weight: 5,
          },
        ]
      : []

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <ThinavaMap
        center={getMapCenter(riderPoint, restaurantPoint, customerPoint)}
        zoom={14}
        markers={markers}
        polylines={polylines}
        className="h-full w-full"
        darkControls={darkControls}
        fitBounds={false}
        fallbackMessage="Live route coordinates are still available, but map tiles could not be loaded."
      />
      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/15 bg-slate-950/75 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white shadow-lg backdrop-blur">
        Live route
      </div>
      {routePoints.length >= 2 ? (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-2xl border border-white/20 bg-white/95 px-3 py-2 text-xs font-bold text-slate-950 shadow-lg backdrop-blur">
          <span className="inline-flex items-center gap-1.5">
            <Navigation className="h-3.5 w-3.5 text-orange-600" />
            {routeDistanceLabel(routePoints)}
          </span>
        </div>
      ) : null}
    </div>
  )
}
