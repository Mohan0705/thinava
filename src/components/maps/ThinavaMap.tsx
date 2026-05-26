'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { MapFallback, MapLoading } from '@/components/maps/MapFallback'
import { THINAVA_DEFAULT_CENTER, THINAVA_DEFAULT_ZOOM } from '@/lib/maps/constants'
import type { LatLng, MapCircle, MapMarker, MapPolyline } from '@/lib/maps/types'

const LeafletMap = dynamic(
  () => import('@/components/maps/LeafletMapClient').then((module) => module.LeafletMapClient),
  {
    ssr: false,
    loading: () => <MapLoading />,
  }
)

export type ThinavaMapProps = {
  center?: LatLng | null
  zoom?: number
  markers?: MapMarker[]
  polylines?: MapPolyline[]
  circles?: MapCircle[]
  className?: string
  fitBounds?: boolean
  darkControls?: boolean
  fallbackMessage?: string
}

export function ThinavaMap({
  center = THINAVA_DEFAULT_CENTER,
  zoom = THINAVA_DEFAULT_ZOOM,
  markers = [],
  polylines = [],
  circles = [],
  className,
  fitBounds = true,
  darkControls = false,
  fallbackMessage,
}: ThinavaMapProps) {
  const [tileFailed, setTileFailed] = useState(false)
  const resolvedCenter = center || THINAVA_DEFAULT_CENTER

  if (tileFailed) {
    return <MapFallback className={className} message={fallbackMessage} />
  }

  return (
    <LeafletMap
      center={resolvedCenter}
      zoom={zoom}
      markers={markers}
      polylines={polylines}
      circles={circles}
      className={className}
      fitBounds={fitBounds}
      darkControls={darkControls}
      onTileError={() => setTileFailed(true)}
    />
  )
}

