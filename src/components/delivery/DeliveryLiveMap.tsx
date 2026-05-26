'use client'

import { AlertTriangle } from 'lucide-react'
import { DeliveryMap } from '@/components/maps/DeliveryMap'
import { toLatLng } from '@/lib/maps/geo'
import { cn } from '@/lib/utils'

type Coordinate = {
  latitude: number
  longitude: number
}

export function DeliveryLiveMap({
  rider,
  restaurant,
  customer,
  heightClassName = 'h-[52vh]',
}: {
  rider?: Coordinate | null
  restaurant?: Coordinate | null
  customer?: Coordinate | null
  heightClassName?: string
}) {
  const restaurantPoint = toLatLng(restaurant)
  const customerPoint = toLatLng(customer)

  if (!restaurantPoint || !customerPoint) {
    return (
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden rounded-[32px] border border-white/40 bg-slate-950 px-6 text-center',
          heightClassName
        )}
      >
        <div>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-orange-300/20 bg-orange-500/10 text-orange-200">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">Route unavailable</p>
          <p className="mt-2 text-sm text-white/65">
            Pickup or drop coordinates are missing for this delivery.
          </p>
        </div>
      </div>
    )
  }

  return (
    <DeliveryMap
      rider={rider}
      restaurant={restaurant}
      customer={customer}
      className={cn('rounded-[32px] border border-white/40 bg-slate-950', heightClassName)}
      darkControls
    />
  )
}

