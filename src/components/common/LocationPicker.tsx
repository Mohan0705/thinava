'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { LocationPickerMap, type LocationPickerSelection } from '@/components/maps/LocationPickerMap'
import type { LatLng } from '@/lib/maps/types'

interface LocationPickerProps {
  apiKey?: string
  onSelect: (location: {
    address: string
    lat: number
    lng: number
  }) => void
  initialLocation?: LatLng
  disabled?: boolean
}

export function LocationPicker({
  onSelect,
  initialLocation,
  disabled = false,
}: LocationPickerProps) {
  const [selected, setSelected] = useState<LocationPickerSelection | null>(null)

  const handleChange = (selection: LocationPickerSelection) => {
    setSelected(selection)
    onSelect({
      address: selection.address || `${selection.lat.toFixed(6)}, ${selection.lng.toFixed(6)}`,
      lat: selection.lat,
      lng: selection.lng,
    })
  }

  return (
    <div className="space-y-3">
      <LocationPickerMap
        value={initialLocation || null}
        onChange={handleChange}
        disabled={disabled}
        heightClassName="h-[440px]"
      />

      {selected?.address ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="flex items-center gap-2 text-xs font-medium text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            Location selected
          </p>
          <p className="mt-1 text-sm text-green-700">{selected.address}</p>
          <p className="mt-1 text-xs text-green-600">
            {selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}
          </p>
        </div>
      ) : null}
    </div>
  )
}

