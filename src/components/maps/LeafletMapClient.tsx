'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  useMapEvents,
} from 'react-leaflet'
import { OSM_ATTRIBUTION, OSM_TILE_URL, THINAVA_DEFAULT_ZOOM } from '@/lib/maps/constants'
import {
  distanceMeters,
  isCoarsePointer,
  latLngKey,
  mapDebug,
  normalizeLatLng,
  shouldAnimateMap,
} from '@/lib/maps/performance'
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

type BoundsData = {
  key: string
  points: LatLng[]
}

type DebugEventName = 'move' | 'moveend' | 'drag' | 'zoom'

const MAP_EVENT_LOG_INTERVAL_MS = 2500
const RECENTER_MOVE_THRESHOLD_METERS = 24
const FIT_BOUNDS_MIN_INTERVAL_MS = 1500

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

const markerIconCache = new Map<string, L.DivIcon>()

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
  const cacheKey = `${variant}:${label}:${marker.pulse ? 'pulse' : 'static'}`
  const cached = markerIconCache.get(cacheKey)

  if (cached) {
    return cached
  }

  const icon = L.divIcon({
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

  markerIconCache.set(cacheKey, icon)
  return icon
}

function useLatestRef<T>(value: T) {
  const ref = useRef(value)
  ref.current = value
  return ref
}

function useRenderDebug(label: string) {
  const renderCountRef = useRef(0)
  renderCountRef.current += 1

  useEffect(() => {
    const count = renderCountRef.current
    if (count === 1 || count % 10 === 0) {
      mapDebug(`${label} render count`, { count })
    }
  })
}

function MapEventDebug({ label }: { label: string }) {
  const eventCountsRef = useRef<Record<DebugEventName, number> & { lastLoggedAt: number }>({
    move: 0,
    moveend: 0,
    drag: 0,
    zoom: 0,
    lastLoggedAt: 0,
  })

  const logEvent = useCallback((name: DebugEventName) => {
    const counts = eventCountsRef.current
    counts[name] += 1
    const now = Date.now()

    if (now - counts.lastLoggedAt < MAP_EVENT_LOG_INTERVAL_MS) {
      return
    }

    mapDebug(`${label} event frequency`, {
      move: counts.move,
      moveend: counts.moveend,
      drag: counts.drag,
      zoom: counts.zoom,
    })

    eventCountsRef.current = {
      move: 0,
      moveend: 0,
      drag: 0,
      zoom: 0,
      lastLoggedAt: now,
    }
  }, [label])

  useMapEvents({
    move() {
      logEvent('move')
    },
    moveend() {
      logEvent('moveend')
    },
    drag() {
      logEvent('drag')
    },
    zoom() {
      logEvent('zoom')
    },
  })

  return null
}

function FitBounds({
  boundsData,
  enabled,
}: {
  boundsData: BoundsData
  enabled: boolean
}) {
  const map = useMap()
  const lastFitKeyRef = useRef<string | null>(null)
  const lastFitAtRef = useRef(0)

  useEffect(() => {
    if (!enabled || boundsData.points.length === 0) {
      return
    }

    let frame: number | null = window.requestAnimationFrame(() => {
      if (lastFitKeyRef.current === boundsData.key) {
        return
      }

      const bounds = L.latLngBounds([])
      boundsData.points.forEach((point) => bounds.extend([point.lat, point.lng]))

      if (!bounds.isValid()) {
        return
      }

      if (lastFitKeyRef.current && map.getBounds().pad(-0.1).contains(bounds)) {
        lastFitKeyRef.current = boundsData.key
        mapDebug('fitBounds skipped; targets already visible', {
          key: boundsData.key,
          points: boundsData.points.length,
        })
        return
      }

      const now = Date.now()
      if (lastFitKeyRef.current && now - lastFitAtRef.current < FIT_BOUNDS_MIN_INTERVAL_MS) {
        return
      }

      lastFitKeyRef.current = boundsData.key
      lastFitAtRef.current = now
      mapDebug('fitBounds applied', {
        key: boundsData.key,
        points: boundsData.points.length,
      })

      map.stop()
      map.fitBounds(bounds, {
        padding: [42, 42],
        maxZoom: 16,
        animate: shouldAnimateMap(),
      })
    })

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [boundsData.key, enabled, map])

  return null
}

function Recenter({
  center,
  zoom,
  enabled,
}: {
  center: LatLng
  zoom: number
  enabled: boolean
}) {
  const map = useMap()
  const lastTargetKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }

    const nextCenter = normalizeLatLng(center)
    const targetKey = `${latLngKey(nextCenter)}:${zoom}`
    let frame: number | null = window.requestAnimationFrame(() => {
      const currentCenter = map.getCenter()
      const current = { lat: currentCenter.lat, lng: currentCenter.lng }
      const movedMeters = distanceMeters(current, nextCenter)
      const zoomChanged = map.getZoom() !== zoom

      if (lastTargetKeyRef.current === targetKey && movedMeters < RECENTER_MOVE_THRESHOLD_METERS && !zoomChanged) {
        return
      }

      if (movedMeters < RECENTER_MOVE_THRESHOLD_METERS && !zoomChanged) {
        lastTargetKeyRef.current = targetKey
        return
      }

      const animate = shouldAnimateMap()
      lastTargetKeyRef.current = targetKey
      mapDebug('map recenter applied', {
        movedMeters: Number(movedMeters.toFixed(1)),
        zoomChanged,
        animate,
      })

      map.stop()

      if (zoomChanged) {
        map.setView([nextCenter.lat, nextCenter.lng], zoom, { animate })
        return
      }

      map.panTo([nextCenter.lat, nextCenter.lng], { animate })
    })

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [center.lat, center.lng, enabled, map, zoom])

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

const buildBoundsData = (
  markers: MapMarker[],
  polylines: MapPolyline[],
  circles: MapCircle[]
): BoundsData => {
  const points = [
    ...markers.map((marker) => marker.position),
    ...polylines.flatMap((polyline) => polyline.points),
    ...circles.map((circle) => circle.center),
  ].map((point) => normalizeLatLng(point))

  return {
    key: points.map((point) => latLngKey(point, 5)).join('|'),
    points,
  }
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
  const onTileErrorRef = useLatestRef(onTileError)
  const tileKeepBuffer = useMemo(() => (isCoarsePointer() ? 1 : 2), [])
  const boundsData = useMemo(
    () => buildBoundsData(markers, polylines, circles),
    [circles, markers, polylines]
  )
  const shouldFitBounds = fitBounds && boundsData.points.length > 0
  const markerItems = useMemo(
    () =>
      markers.map((marker) => ({
        marker,
        icon: createMarkerIcon(marker),
      })),
    [markers]
  )
  const tileEventHandlers = useMemo(
    () => ({
      tileerror: () => onTileErrorRef.current?.(),
    }),
    [onTileErrorRef]
  )

  useRenderDebug('LeafletMapClient')

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
        zoomAnimation={false}
        fadeAnimation={false}
        markerZoomAnimation={false}
        inertia={!isCoarsePointer()}
        wheelDebounceTime={120}
        wheelPxPerZoomLevel={90}
      >
        <TileLayer
          attribution={OSM_ATTRIBUTION}
          url={OSM_TILE_URL}
          updateWhenIdle
          updateWhenZooming={false}
          updateInterval={250}
          keepBuffer={tileKeepBuffer}
          eventHandlers={tileEventHandlers}
        />

        <ZoomControl position="bottomright" />
        <MapEventDebug label="LeafletMapClient" />
        <Recenter center={center} zoom={zoom} enabled={!shouldFitBounds} />
        <FitBounds boundsData={boundsData} enabled={shouldFitBounds} />

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

        {markerItems.map(({ marker, icon }) => (
          <Marker
            key={marker.id}
            position={[marker.position.lat, marker.position.lng]}
            icon={icon}
            draggable={marker.draggable}
            eventHandlers={{
              dragend: (event) => {
                const next = (event.target as L.Marker).getLatLng()
                marker.onDragEnd?.(normalizeLatLng({ lat: next.lat, lng: next.lng }))
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
