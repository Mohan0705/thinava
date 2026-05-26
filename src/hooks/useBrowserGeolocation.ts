'use client'

import { useCallback, useEffect, useState } from 'react'
import type { LatLng } from '@/lib/maps/types'

type GeolocationStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'unavailable' | 'error'

export function useBrowserGeolocation({
  autoRequest = false,
  highAccuracy = true,
}: {
  autoRequest?: boolean
  highAccuracy?: boolean
} = {}) {
  const [status, setStatus] = useState<GeolocationStatus>('idle')
  const [position, setPosition] = useState<LatLng | null>(null)
  const [error, setError] = useState<string | null>(null)

  const requestLocation = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable')
      setError('Location is not available in this browser.')
      return null
    }

    setStatus('loading')
    setError(null)

    try {
      const result = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: highAccuracy,
          maximumAge: 12000,
          timeout: 14000,
        })
      })

      const nextPosition = {
        lat: result.coords.latitude,
        lng: result.coords.longitude,
      }

      setPosition(nextPosition)
      setStatus('granted')
      return nextPosition
    } catch (caught) {
      const geolocationError = caught as GeolocationPositionError
      const denied = geolocationError?.code === geolocationError?.PERMISSION_DENIED
      setStatus(denied ? 'denied' : 'error')
      setError(denied ? 'Location permission was denied.' : 'Unable to detect your location.')
      return null
    }
  }, [highAccuracy])

  useEffect(() => {
    if (!autoRequest) {
      return
    }

    void requestLocation()
  }, [autoRequest, requestLocation])

  return {
    status,
    position,
    error,
    requestLocation,
  }
}

