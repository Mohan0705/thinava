import { THINAVA_DEFAULT_CENTER } from '@/lib/maps/constants'
import type { Coordinate, LatLng } from '@/lib/maps/types'

export const toLatLng = (value?: Coordinate | LatLng | null): LatLng | null => {
  if (!value) {
    return null
  }

  const maybeLat = 'lat' in value ? value.lat : value.latitude
  const maybeLng = 'lng' in value ? value.lng : value.longitude
  const lat = Number(maybeLat)
  const lng = Number(maybeLng)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null
  }

  return { lat, lng }
}

export const getMapCenter = (...values: Array<Coordinate | LatLng | null | undefined>) => {
  const points = values.map(toLatLng).filter((point): point is LatLng => Boolean(point))

  if (points.length === 0) {
    return THINAVA_DEFAULT_CENTER
  }

  return {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  }
}

export const formatLatLng = (position?: LatLng | null) => {
  if (!position) {
    return ''
  }

  return `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`
}

const toRadians = (value: number) => (value * Math.PI) / 180

export const calculateDistanceKm = (from: LatLng, to: LatLng) => {
  const earthRadiusKm = 6371
  const latDelta = toRadians(to.lat - from.lat)
  const lngDelta = toRadians(to.lng - from.lng)
  const startLat = toRadians(from.lat)
  const endLat = toRadians(to.lat)

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2)

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const openOsmLocation = (position: LatLng, zoom = 18) => {
  const url = `https://www.openstreetmap.org/?mlat=${position.lat}&mlon=${position.lng}#map=${zoom}/${position.lat}/${position.lng}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

export const openOsmDirections = (destination: LatLng, origin?: LatLng | null) => {
  const route = origin
    ? `engine=fossgis_osrm_car&route=${origin.lat}%2C${origin.lng}%3B${destination.lat}%2C${destination.lng}`
    : `mlat=${destination.lat}&mlon=${destination.lng}`
  const url = `https://www.openstreetmap.org/directions?${route}#map=16/${destination.lat}/${destination.lng}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

export const routeDistanceLabel = (points: LatLng[]) => {
  if (points.length < 2) {
    return '--'
  }

  const distance = points.slice(1).reduce((sum, point, index) => {
    return sum + calculateDistanceKm(points[index], point)
  }, 0)

  return distance >= 1 ? `${distance.toFixed(1)} km` : `${Math.round(distance * 1000)} m`
}

