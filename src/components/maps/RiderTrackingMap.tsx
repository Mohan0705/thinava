'use client'

import { ThinavaMap } from '@/components/maps/ThinavaMap'
import { getMapCenter, toLatLng } from '@/lib/maps/geo'
import type { Coordinate, MapMarker, MapPolyline } from '@/lib/maps/types'

export function RiderTrackingMap({
  rider,
  pickup,
  delivery,
  className = 'h-64',
}: {
  rider?: Coordinate | null
  pickup?: Coordinate | null
  delivery?: Coordinate | null
  className?: string
}) {
  const riderPoint = toLatLng(rider)
  const pickupPoint = toLatLng(pickup)
  const deliveryPoint = toLatLng(delivery)

  const markers: MapMarker[] = [
    pickupPoint
      ? {
          id: 'pickup',
          position: pickupPoint,
          label: 'P',
          title: 'Pickup',
          variant: 'pickup',
        }
      : null,
    deliveryPoint
      ? {
          id: 'delivery',
          position: deliveryPoint,
          label: 'D',
          title: 'Drop',
          variant: 'dropoff',
        }
      : null,
    riderPoint
      ? {
          id: 'rider',
          position: riderPoint,
          label: 'R',
          title: 'Rider',
          variant: 'rider',
          pulse: true,
        }
      : null,
  ].filter(Boolean) as MapMarker[]

  const route = [riderPoint, pickupPoint, deliveryPoint].filter(Boolean) as NonNullable<typeof riderPoint>[]
  const polylines: MapPolyline[] =
    route.length >= 2
      ? [
          {
            id: 'rider-route',
            points: route,
            color: '#2563eb',
            weight: 4,
          },
        ]
      : []

  return (
    <ThinavaMap
      center={getMapCenter(riderPoint, pickupPoint, deliveryPoint)}
      zoom={14}
      markers={markers}
      polylines={polylines}
      className={className}
    />
  )
}

