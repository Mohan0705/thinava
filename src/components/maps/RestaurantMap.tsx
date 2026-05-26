'use client'

import { LocationPickerMap, type LocationPickerSelection } from '@/components/maps/LocationPickerMap'
import { THINAVA_DEFAULT_CENTER } from '@/lib/maps/constants'
import type { GeocodeResult, LatLng } from '@/lib/maps/types'

export function RestaurantMap({
  value,
  address,
  onChange,
  onAddressResolved,
  className,
  heightClassName = 'h-[360px]',
  dark = false,
  autoDetect = false,
}: {
  value?: LatLng | null
  address?: string
  onChange: (selection: LocationPickerSelection) => void
  onAddressResolved?: (result: GeocodeResult) => void
  className?: string
  heightClassName?: string
  dark?: boolean
  autoDetect?: boolean
}) {
  return (
    <LocationPickerMap
      value={value}
      defaultCenter={THINAVA_DEFAULT_CENTER}
      address={address}
      onChange={onChange}
      onAddressResolved={onAddressResolved}
      className={className}
      heightClassName={heightClassName}
      autoDetect={autoDetect}
      dark={dark}
      searchPlaceholder="Search restaurant area or street"
      showCoordinateFields
    />
  )
}

