'use client'

import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  ZoomControl,
  useMap,
} from 'react-leaflet'
import { OSM_ATTRIBUTION, OSM_TILE_URL, THINAVA_DEFAULT_ZOOM } from '@/lib/maps/constants'
import type { LatLng, MapCircle, MapMarker, MapMarkerVariant, MapPolyline } from '@/lib/maps/types'
import { cn } from '@/lib/utils'

export type LeafletMapClientProps = {
  center: LatLng
  zoom?: number
  markers?: MapMarker[]
  polylines?: MapPolyline[]
  circles?: MapCircle[]
  className?: string
  fitBounds?: boolean
  darkControls?: boolean
  onTileError?: () => void
}

const markerLabels: Record<MapMarkerVariant, string> = {
  default: 'T',
  pin: 'P',
  restaurant: 'S',
  rider: 'D',
  customer: 'C',
  pickup: 'P',
  dropoff: 'D',
  admin: 'A',
  hotspot: 'H',
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

const createMarkerIcon = (marker: MapMarker) => {
  const variant = marker.variant || 'default'
  const label = escapeHtml((marker.label || markerLabels[variant] || 'T').slice(0, 3).toUpperCase())

  return L.divIcon({
    className: cn(
      'thinava-map-marker',
      `thinava-map-marker-${variant}`,
      marker.pulse && 'thinava-map-marker-pulse'
    ),
    html: `<span>${label}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  })
}

function FitBounds({
  markers,
  polylines,
  circles,
  enabled,
}: {
  markers: MapMarker[]
  polylines: MapPolyline[]
  circles: MapCircle[]
  enabled: boolean
}) {
  const map = useMap()
  const boundsKey = useMemo(() => {
    const markerPoints = markers.map((marker) => `${marker.position.lat},${marker.position.lng}`)
    const routePoints = polylines.flatMap((polyline) =>
      polyline.points.map((point) => `${point.lat},${point.lng}`)
    )
    const circlePoints = circles.map((circle) => `${circle.center.lat},${circle.center.lng}`)
    return [...markerPoints, ...routePoints, ...circlePoints].join('|')
  }, [circles, markers, polylines])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const bounds = L.latLngBounds([])

    markers.forEach((marker) => bounds.extend([marker.position.lat, marker.position.lng]))
    polylines.forEach((polyline) => {
      polyline.points.forEach((point) => bounds.extend([point.lat, point.lng]))
    })
    circles.forEach((circle) => bounds.extend([circle.center.lat, circle.center.lng]))

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [42, 42],
        maxZoom: 16,
        animate: true,
      })
    }
  }, [boundsKey, circles, enabled, map, markers, polylines])

  return null
}

function Recenter({ center, zoom }: { center: LatLng; zoom: number }) {
  const map = useMap()

  useEffect(() => {
    map.setView([center.lat, center.lng], zoom, { animate: true })
  }, [center.lat, center.lng, map, zoom])

  return null
}

function useDeferredMapMount() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return ready
}

export function LeafletMapClient({
  center,
  zoom = THINAVA_DEFAULT_ZOOM,
  markers = [],
  polylines = [],
  circles = [],
  className,
  fitBounds = true,
  darkControls = false,
  onTileError,
}: LeafletMapClientProps) {
  const ready = useDeferredMapMount()

  if (!ready) {
    return (
      <div className={cn('thinava-map-shell flex items-center justify-center', className)}>
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className={cn('thinava-map-shell', darkControls && 'thinava-map-dark-controls', className)}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        className="thinava-map-container"
        zoomControl={false}
        scrollWheelZoom
        preferCanvas
      >
        <TileLayer
          attribution={OSM_ATTRIBUTION}
          url={OSM_TILE_URL}
          eventHandlers={{
            tileerror: () => onTileError?.(),
          }}
        />

        <ZoomControl position="bottomright" />
        <Recenter center={center} zoom={zoom} />
        <FitBounds markers={markers} polylines={polylines} circles={circles} enabled={fitBounds} />

        {circles.map((circle) => (
          <Circle
            key={circle.id}
            center={[circle.center.lat, circle.center.lng]}
            radius={circle.radiusMeters}
            pathOptions={{
              color: circle.color || '#f97316',
              fillColor: circle.fillColor || circle.color || '#fb923c',
              fillOpacity: circle.fillOpacity ?? 0.18,
              weight: 1.4,
            }}
          />
        ))}

        {polylines.map((polyline) => (
          <Polyline
            key={polyline.id}
            positions={polyline.points.map((point) => [point.lat, point.lng])}
            pathOptions={{
              color: polyline.color || '#ff6b35',
              weight: polyline.weight || 5,
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round',
              dashArray: polyline.dashed ? '8 10' : undefined,
            }}
          />
        ))}

        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.position.lat, marker.position.lng]}
            icon={createMarkerIcon(marker)}
            draggable={marker.draggable}
            eventHandlers={{
              dragend: (event) => {
                const next = (event.target as L.Marker).getLatLng()
                marker.onDragEnd?.({ lat: next.lat, lng: next.lng })
              },
            }}
          >
            {marker.title || marker.subtitle || marker.popup ? (
              <Popup>
                <div className="min-w-[160px]">
                  {marker.title ? (
                    <p className="text-sm font-bold text-slate-950">{marker.title}</p>
                  ) : null}
                  {marker.subtitle ? (
                    <p className="mt-1 text-xs font-medium text-slate-600">{marker.subtitle}</p>
                  ) : null}
                  {marker.popup ? (
                    <p className="mt-1 text-xs text-slate-500">{marker.popup}</p>
                  ) : null}
                </div>
              </Popup>
            ) : null}
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
