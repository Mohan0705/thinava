import { calculateDistanceKm } from '@/lib/maps/geo'
import type { LatLng } from '@/lib/maps/types'

export const MAP_DEBUG_STORAGE_KEY = 'thinava:map-debug'

export const normalizeLatLng = (position: LatLng, precision = 6): LatLng => ({
  lat: Number(position.lat.toFixed(precision)),
  lng: Number(position.lng.toFixed(precision)),
})

export const latLngKey = (position: LatLng, precision = 6) => {
  const normalized = normalizeLatLng(position, precision)
  return `${normalized.lat},${normalized.lng}`
}

export const distanceMeters = (from: LatLng, to: LatLng) => calculateDistanceKm(from, to) * 1000

export const areLatLngClose = (from: LatLng | null | undefined, to: LatLng, meters = 1) => {
  if (!from) {
    return false
  }

  return distanceMeters(from, to) <= meters
}

export const isCoarsePointer = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia('(pointer: coarse)').matches
}

export const shouldAnimateMap = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return !reducedMotion && !isCoarsePointer()
}

export const isMapDebugEnabled = () => {
  if (process.env.NODE_ENV !== 'production') {
    return true
  }

  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(MAP_DEBUG_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export const mapDebug = (label: string, details?: unknown) => {
  if (!isMapDebugEnabled()) {
    return
  }

  if (details === undefined) {
    console.debug(`[Thinava maps] ${label}`)
    return
  }

  console.debug(`[Thinava maps] ${label}`, details)
}
