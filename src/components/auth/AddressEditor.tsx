'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, LocateFixed, MapPinned, MapPin, Phone, User2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import type { Address } from '@/types'

type AddressType = 'Home' | 'Office' | 'Other'

type AddressDraft = {
  label: string
  house: string
  street: string
  area: string
  landmark: string
  latitude: string
  longitude: string
  isDefault: boolean
  receiverName: string
  receiverPhone: string
  useAccountDetails: boolean
  addressType: AddressType
}

const ADDRESS_TYPES: AddressType[] = ['Home', 'Office', 'Other']

const inferAddressType = (label: string): AddressType => {
  const normalized = label.trim().toLowerCase()
  if (normalized === 'home') return 'Home'
  if (normalized === 'office' || normalized === 'work') return 'Office'
  return 'Other'
}

const getAddressType = (address?: Address | null): AddressType => {
  const savedType = address?.addressType
  if (savedType === 'Home' || savedType === 'Office' || savedType === 'Other') {
    return savedType
  }

  return inferAddressType(address?.label || 'Home')
}

const splitAddress = (value: string) => {
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  return {
    house: parts[0] || '',
    street: parts[1] || '',
    area: parts.slice(2).join(', '),
  }
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
    address_type: AddressType
    address: string
    landmark?: string
    latitude?: number | null
    longitude?: number | null
    is_default: boolean
    receiver_name?: string
    receiver_phone?: string
    use_account_details: boolean
  }) => Promise<void> | void
}) {
  const user = useAuthStore((state) => state.user)

  const [draft, setDraft] = useState<AddressDraft>({
    label: '',
    house: '',
    street: '',
    area: '',
    landmark: '',
    latitude: '',
    longitude: '',
    isDefault: false,
    receiverName: '',
    receiverPhone: '',
    useAccountDetails: true,
    addressType: 'Home',
  })

  useEffect(() => {
    const accountName = user?.fullName || user?.name || ''
    const accountPhone = user?.phone || ''
    const parsedAddress = splitAddress(address?.fullAddress || address?.address || '')
    const initialLabel = address?.label || ''
    const initialType = getAddressType(address)
    const savedReceiverName = address?.receiverName?.trim() || ''
    const savedReceiverPhone = address?.receiverPhone?.trim() || ''
    const useAccountDetails =
      address?.useAccountDetails ?? (!address || (!savedReceiverName && !savedReceiverPhone))

    setDraft({
      label: initialLabel,
      house: parsedAddress.house,
      street: parsedAddress.street,
      area: parsedAddress.area,
      landmark: address?.landmark || '',
      latitude:
        address?.latitude !== undefined && address?.latitude !== null ? String(address.latitude) : '',
      longitude:
        address?.longitude !== undefined && address?.longitude !== null
          ? String(address.longitude)
          : '',
      isDefault: address?.isDefault || false,
      receiverName: useAccountDetails ? accountName : savedReceiverName,
      receiverPhone: useAccountDetails ? accountPhone : savedReceiverPhone,
      useAccountDetails,
      addressType: initialType,
    })
  }, [address, user?.fullName, user?.name, user?.phone])

  const accountName = user?.fullName || user?.name || ''
  const accountPhone = user?.phone || ''

  const addressPreview = useMemo(() => {
    const segments = [draft.house, draft.street, draft.area].filter(Boolean)
    if (segments.length > 0) return segments.join(', ')
    return 'Choose your house, street, and locality details for a clearer delivery handoff.'
  }, [draft.house, draft.street, draft.area])

  const coordinatePreview = draft.latitude && draft.longitude
    ? `${draft.latitude}, ${draft.longitude}`
    : 'Add a location pin for smoother doorstep delivery.'

  const updateDraft = (field: keyof AddressDraft, value: string | boolean) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleAddressTypeChange = (type: AddressType) => {
    setDraft((current) => ({
      ...current,
      addressType: type,
      label:
        current.label.trim() === '' ||
        current.label === 'Home' ||
        current.label === 'Office' ||
        current.label === 'Other'
          ? type
          : current.label,
    }))
  }

  const handleAccountDetailsToggle = (checked: boolean) => {
    setDraft((current) => ({
      ...current,
      useAccountDetails: checked,
      receiverName: checked ? accountName : current.receiverName,
      receiverPhone: checked ? accountPhone : current.receiverPhone,
    }))
  }

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

  const handleSave = () => {
    const composedAddress = [draft.house, draft.street, draft.area]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(', ')

    onSave({
      label: draft.label.trim() || draft.addressType,
      address_type: draft.addressType,
      address: composedAddress,
      landmark: draft.landmark.trim() || undefined,
      latitude: draft.latitude ? Number(draft.latitude) : null,
      longitude: draft.longitude ? Number(draft.longitude) : null,
      is_default: draft.isDefault,
      receiver_name: draft.useAccountDetails ? accountName.trim() : draft.receiverName.trim(),
      receiver_phone: draft.useAccountDetails ? accountPhone.trim() : draft.receiverPhone.trim(),
      use_account_details: draft.useAccountDetails,
    })
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[1.8rem] border border-[#F3E3DA] bg-[#FFFDFB] p-4 shadow-[0_18px_38px_-28px_rgba(17,24,39,0.24)]">
        <div className="mb-4">
          <p className="text-lg font-black tracking-tight text-[#111827]">Receiver details</p>
          <p className="mt-1 text-sm text-[#6B7280]">
            Keep your drop-off contact handy for delivery updates and calling support if needed.
          </p>
        </div>

        <label className="mb-4 flex items-center gap-3 rounded-2xl border border-[#F5D8CB] bg-[#FFF6F0] px-4 py-3 text-sm font-medium text-[#374151]">
          <input
            type="checkbox"
            checked={draft.useAccountDetails}
            onChange={(event) => handleAccountDetailsToggle(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
          />
          Use my account details
        </label>

        <div className="grid gap-3">
          <div className="relative">
            <User2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
            <Input
              value={draft.receiverName}
              onChange={(event) => updateDraft('receiverName', event.target.value)}
              placeholder="Receiver name"
              className="h-14 rounded-[1.2rem] border-[#E9DCD2] bg-white pl-11"
              disabled={draft.useAccountDetails}
            />
          </div>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
            <Input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={draft.receiverPhone}
              onChange={(event) => updateDraft('receiverPhone', event.target.value)}
              placeholder="Receiver phone number"
              className="h-14 rounded-[1.2rem] border-[#E9DCD2] bg-white pl-11"
              disabled={draft.useAccountDetails}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-[#F3E3DA] bg-[#FFFDFB] p-4 shadow-[0_18px_38px_-28px_rgba(17,24,39,0.24)]">
        <div className="mb-4">
          <p className="text-lg font-black tracking-tight text-[#111827]">Location details</p>
          <p className="mt-1 text-sm text-[#6B7280]">
            Add clear address details so your order arrives without confusion.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-[1.3rem] bg-[#F7F1EC] p-1.5">
          {ADDRESS_TYPES.map((type) => {
            const isActive = draft.addressType === type

            return (
              <button
                key={type}
                type="button"
                onClick={() => handleAddressTypeChange(type)}
                className={cn(
                  'rounded-[1rem] px-3 py-3 text-sm font-semibold transition-all',
                  isActive
                    ? 'bg-[#111827] text-white shadow-[0_14px_28px_-18px_rgba(17,24,39,0.55)]'
                    : 'text-[#4B5563]'
                )}
              >
                {type}
              </button>
            )
          })}
        </div>

        <div className="mt-4 grid gap-3">
          <Input
            value={draft.house}
            onChange={(event) => updateDraft('house', event.target.value)}
            placeholder="House / Flat / Floor"
            className="h-14 rounded-[1.2rem] border-[#E9DCD2] bg-white"
          />
          <Input
            value={draft.street}
            onChange={(event) => updateDraft('street', event.target.value)}
            placeholder="Building / Street"
            className="h-14 rounded-[1.2rem] border-[#E9DCD2] bg-white"
          />
          <Input
            value={draft.area}
            onChange={(event) => updateDraft('area', event.target.value)}
            placeholder="Area / Locality"
            className="h-14 rounded-[1.2rem] border-[#E9DCD2] bg-white"
          />
          <Textarea
            value={draft.landmark}
            onChange={(event) => updateDraft('landmark', event.target.value)}
            placeholder="Landmark (optional)"
            className="min-h-[110px] rounded-[1.2rem] border-[#E9DCD2] bg-white"
          />
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-[#F3DCCD] bg-[linear-gradient(180deg,#FFF8F3_0%,#FFFFFF_100%)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#FFEEE6] text-[#FF6B35]">
                  <MapPin className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-[#111827]">Detected location</p>
                  <p className="text-xs text-[#6B7280]">{coordinatePreview}</p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#4B5563]">{addressPreview}</p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={useCurrentLocation}
              className="rounded-full border-[#F3D1C0] bg-white px-4 text-[#C2410C] shadow-sm"
            >
              <LocateFixed className="mr-2 h-4 w-4" />
              Change
            </Button>
          </div>

          {draft.latitude && draft.longitude ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${draft.latitude},${draft.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex"
            >
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-[#E5E7EB] bg-white px-4 text-[#374151]"
              >
                <MapPinned className="mr-2 h-4 w-4" />
                Open in Maps
              </Button>
            </a>
          ) : null}
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-[#F3E3DA] bg-[#FFFDFB] p-4 shadow-[0_18px_38px_-28px_rgba(17,24,39,0.24)]">
        <div className="mb-4">
          <p className="text-lg font-black tracking-tight text-[#111827]">Save address as</p>
          <p className="mt-1 text-sm text-[#6B7280]">
            Choose a familiar label such as Home, Office, Parents, or Hostel.
          </p>
        </div>

        <Input
          value={draft.label}
          onChange={(event) => updateDraft('label', event.target.value)}
          placeholder="Home"
          className="h-14 rounded-[1.2rem] border-[#E9DCD2] bg-white"
        />

        <label className="mt-4 flex items-center gap-3 rounded-2xl border border-[#F5D8CB] bg-[#FFF6F0] px-4 py-3 text-sm text-[#374151]">
          <input
            type="checkbox"
            checked={draft.isDefault}
            onChange={(event) => updateDraft('isDefault', event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
          />
          Make this my default delivery address
        </label>
      </section>

      <Button
        type="button"
        className="h-14 w-full rounded-[1.2rem] text-base font-bold shadow-[0_18px_34px_-22px_rgba(255,107,53,0.6)]"
        disabled={saving}
        onClick={handleSave}
      >
        {saving ? 'Saving Address...' : address ? 'Update Address' : 'Save Address'}
      </Button>

      <div className="flex items-center justify-center gap-2 text-xs font-medium text-[#9CA3AF]">
        <Check className="h-3.5 w-3.5 text-[#FF6B35]" />
        Address layout refreshed without changing your existing save flow.
      </div>
    </div>
  )
}
