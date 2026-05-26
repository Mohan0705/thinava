import type { LatLng } from '@/lib/maps/types'

export const THINAVA_DEFAULT_CENTER: LatLng = {
  lat: 16.8148,
  lng: 81.527,
}

export const THINAVA_DEFAULT_ZOOM = 14

export const OSM_TILE_URL =
  process.env.NEXT_PUBLIC_OSM_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

export const NOMINATIM_BASE_URL =
  process.env.NEXT_PUBLIC_NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org'

export const NOMINATIM_REQUEST_GAP_MS = 1150

