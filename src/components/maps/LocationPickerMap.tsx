'use client'

import dynamic from 'next/dynamic'
import { MapLoading } from '@/components/maps/MapFallback'
import type { GeocodeResult, LatLng } from '@/lib/maps/types'
import type {
  LocationPickerSelection,
} from '@/components/maps/LocationPickerMapClient'

const LocationPickerMapClient = dynamic(
  () =>
    import('@/components/maps/LocationPickerMapClient').then(
      (module) => module.LocationPickerMapClient
    ),
  {
    ssr: false,
    loading: () => <MapLoading className="h-[420px]" label="Preparing picker" />,
  }
)

export type { LocationPickerSelection }

export function LocationPickerMap({
  value,
  defaultCenter,
  address,
  onChange,
  onAddressResolved,
  className,
  heightClassName,
  autoDetect,
  disabled,
  dark,
  searchPlaceholder,
  showCoordinateFields,
}: {
  value?: LatLng | null
  defaultCenter?: LatLng
  address?: string
  onChange: (selection: LocationPickerSelection) => void
  onAddressResolved?: (result: GeocodeResult) => void
  className?: string
  heightClassName?: string
  autoDetect?: boolean
  disabled?: boolean
  dark?: boolean
  searchPlaceholder?: string
  showCoordinateFields?: boolean
}) {
  return (
    <LocationPickerMapClient
      value={value}
      defaultCenter={defaultCenter}
      address={address}
      onChange={onChange}
      onAddressResolved={onAddressResolved}
      className={className}
      heightClassName={heightClassName}
      autoDetect={autoDetect}
      disabled={disabled}
      dark={dark}
      searchPlaceholder={searchPlaceholder}
      showCoordinateFields={showCoordinateFields}
    />
  )
}

