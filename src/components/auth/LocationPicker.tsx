'use client'

import { LocationPickerMap, type LocationPickerSelection } from '@/components/maps/LocationPickerMap'
import { THINAVA_DEFAULT_CENTER } from '@/lib/maps/constants'

interface LocationPickerProps {
  latitude: number | string
  longitude: number | string
  onChange: (lat: number, lng: number) => void
  defaultLocation?: { lat: number; lng: number }
}

export function LocationPicker({
  latitude,
  longitude,
  onChange,
  defaultLocation = THINAVA_DEFAULT_CENTER,
}: LocationPickerProps) {
  const lat = latitude ? Number(latitude) : null
  const lng = longitude ? Number(longitude) : null
  const value = lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null

  const handleChange = (selection: LocationPickerSelection) => {
    onChange(Number(selection.lat.toFixed(6)), Number(selection.lng.toFixed(6)))
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-300">
        Pin Your Exact Location
      </label>
      <LocationPickerMap
        value={value}
        defaultCenter={defaultLocation}
        onChange={handleChange}
        heightClassName="h-72"
        dark
        showCoordinateFields
        searchPlaceholder="Search pickup street or landmark"
      />
    </div>
  )
}

