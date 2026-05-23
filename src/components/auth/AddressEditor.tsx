'use client'

import { useEffect, useState } from 'react'
import { LocateFixed, MapPinned } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import type { Address } from '@/types'

type AddressDraft = {
  label: string
  address: string
  landmark: string
  latitude: string
  longitude: string
  isDefault: boolean
}

export function AddressEditor({
  address,
  saving,
  onSave,
}: {
  address?: Address | null
  saving: boolean
  onSave: (payload: {
    label: string
    address: string
    landmark?: string
    latitude?: number | null
    longitude?: number | null
    is_default: boolean
  }) => Promise<void> | void
}) {
  const [draft, setDraft] = useState<AddressDraft>({
    label: '',
    address: '',
    landmark: '',
    latitude: '',
    longitude: '',
    isDefault: false,
  })

  useEffect(() => {
    setDraft({
      label: address?.label || '',
      address: address?.fullAddress || address?.address || '',
      landmark: address?.landmark || '',
      latitude: address?.latitude !== undefined && address?.latitude !== null ? String(address.latitude) : '',
      longitude: address?.longitude !== undefined && address?.longitude !== null ? String(address.longitude) : '',
      isDefault: address?.isDefault || false,
    })
  }, [address])

  const useCurrentLocation = async () => {
    if (!navigator.geolocation) {
      return
    }

    navigator.geolocation.getCurrentPosition((position) => {
      setDraft((current) => ({
        ...current,
        latitude: position.coords.latitude.toFixed(6),
        longitude: position.coords.longitude.toFixed(6),
      }))
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          value={draft.label}
          onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
          placeholder="Home / Work / Hostel"
        />
        <Input
          value={draft.landmark}
          onChange={(event) => setDraft((current) => ({ ...current, landmark: event.target.value }))}
          placeholder="Landmark"
        />
      </div>

      <Textarea
        value={draft.address}
        onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
        placeholder="Full delivery address"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Input
          value={draft.latitude}
          onChange={(event) => setDraft((current) => ({ ...current, latitude: event.target.value }))}
          placeholder="Latitude"
        />
        <Input
          value={draft.longitude}
          onChange={(event) => setDraft((current) => ({ ...current, longitude: event.target.value }))}
          placeholder="Longitude"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={useCurrentLocation}>
          <LocateFixed className="mr-2 h-4 w-4" />
          Use Current Location
        </Button>
        {draft.latitude && draft.longitude ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${draft.latitude},${draft.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            <Button type="button" variant="outline">
              <MapPinned className="mr-2 h-4 w-4" />
              Open in Maps
            </Button>
          </a>
        ) : null}
      </div>

      <label className="flex items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50/70 px-4 py-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={draft.isDefault}
          onChange={(event) => setDraft((current) => ({ ...current, isDefault: event.target.checked }))}
          className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
        />
        Make this my default address
      </label>

      <Button
        type="button"
        className="w-full"
        disabled={saving}
        onClick={() =>
          onSave({
            label: draft.label,
            address: draft.address,
            landmark: draft.landmark || undefined,
            latitude: draft.latitude ? Number(draft.latitude) : null,
            longitude: draft.longitude ? Number(draft.longitude) : null,
            is_default: draft.isDefault,
          })
        }
      >
        {saving ? 'Saving Address...' : address ? 'Update Address' : 'Save Address'}
      </Button>
    </div>
  )
}
