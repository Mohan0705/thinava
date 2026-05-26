export type LatLng = {
  lat: number
  lng: number
}

export type Coordinate = {
  latitude: number
  longitude: number
}

export type MapMarkerVariant =
  | 'default'
  | 'pin'
  | 'restaurant'
  | 'rider'
  | 'customer'
  | 'pickup'
  | 'dropoff'
  | 'admin'
  | 'hotspot'

export type MapMarker = {
  id: string
  position: LatLng
  label?: string
  title?: string
  subtitle?: string
  popup?: string
  variant?: MapMarkerVariant
  pulse?: boolean
  draggable?: boolean
  onDragEnd?: (position: LatLng) => void
}

export type MapPolyline = {
  id: string
  points: LatLng[]
  color?: string
  weight?: number
  dashed?: boolean
}

export type MapCircle = {
  id: string
  center: LatLng
  radiusMeters: number
  color?: string
  fillColor?: string
  fillOpacity?: number
}

export type GeocodeAddress = {
  houseNumber?: string
  road?: string
  neighbourhood?: string
  suburb?: string
  city?: string
  town?: string
  village?: string
  state?: string
  postcode?: string
  country?: string
}

export type GeocodeResult = {
  placeId: string
  lat: number
  lng: number
  displayName: string
  shortName: string
  address: GeocodeAddress
  raw?: unknown
}

