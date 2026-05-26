'use client'

import { ThinavaMap } from '@/components/maps/ThinavaMap'
import type { LiveMapPayload } from '@/features/admin/types'
import type { MapCircle, MapMarker, MapPolyline } from '@/lib/maps/types'

export function AdminZoneMap({
  data,
  className = 'h-[520px]',
}: {
  data: LiveMapPayload
  className?: string
}) {
  const restaurantMarkers: MapMarker[] = data.restaurants.map((restaurant) => ({
    id: `restaurant-${restaurant.id}`,
    position: {
      lat: restaurant.latitude,
      lng: restaurant.longitude,
    },
    label: 'S',
    title: restaurant.name,
    subtitle: 'Restaurant',
    variant: 'restaurant',
  }))

  const riderMarkers: MapMarker[] = data.riders.map((rider) => ({
    id: `rider-${rider.id}`,
    position: {
      lat: rider.latitude,
      lng: rider.longitude,
    },
    label: 'D',
    title: rider.name,
    subtitle: `${rider.status} - ${rider.area}`,
    variant: 'rider',
    pulse: rider.is_online,
  }))

  const polylines: MapPolyline[] = data.deliveries
    .filter((delivery) => delivery.route.length >= 2)
    .map((delivery) => ({
      id: `delivery-${delivery.id}`,
      points: delivery.route.map((point) => ({
        lat: point.latitude,
        lng: point.longitude,
      })),
      color: '#ff6b35',
      weight: 4,
      dashed: delivery.status !== 'OUT_FOR_DELIVERY',
    }))

  const circles: MapCircle[] = data.hotspots.map((hotspot) => ({
    id: `hotspot-${hotspot.zone}`,
    center: {
      lat: hotspot.latitude,
      lng: hotspot.longitude,
    },
    radiusMeters: 110 + hotspot.intensity * 45,
    color: '#f97316',
    fillColor: '#fb923c',
    fillOpacity: 0.16,
  }))

  return (
    <ThinavaMap
      center={data.center}
      zoom={13}
      markers={[...restaurantMarkers, ...riderMarkers]}
      polylines={polylines}
      circles={circles}
      className={className}
    />
  )
}

