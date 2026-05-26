'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, LocateFixed, Loader2, MapPin, Search, X } from 'lucide-react'
import { MapContainer, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import type { LeafletMouseEvent, Map as LeafletMap } from 'leaflet'
import { OSM_ATTRIBUTION, OSM_TILE_URL, THINAVA_DEFAULT_CENTER } from '@/lib/maps/constants'
import { formatLatLng } from '@/lib/maps/geo'
import { reverseGeocode, searchPlaces } from '@/lib/maps/nominatim'
import type { GeocodeResult, LatLng } from '@/lib/maps/types'
import { cn } from '@/lib/utils'

export type LocationPickerChangeSource = 'initial' | 'gps' | 'map' | 'search'

export type LocationPickerSelection = {
  lat: number
  lng: number
  address?: string
  shortName?: string
  source: LocationPickerChangeSource
}

export type LocationPickerMapClientProps = {
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
}

function MapController({
  center,
  onMapReady,
}: {
  center: LatLng
  onMapReady: (map: LeafletMap) => void
}) {
  const map = useMap()

  useEffect(() => {
    onMapReady(map)
  }, [map, onMapReady])

  useEffect(() => {
    map.flyTo([center.lat, center.lng], Math.max(map.getZoom(), 16), {
      animate: true,
      duration: 0.65,
    })
  }, [center.lat, center.lng, map])

  return null
}

function CenterEvents({
  disabled,
  onMoveEnd,
}: {
  disabled?: boolean
  onMoveEnd: (position: LatLng, source: LocationPickerChangeSource) => void
}) {
  useMapEvents({
    moveend(event) {
      if (disabled) {
        return
      }

      const center = event.target.getCenter()
      onMoveEnd({ lat: center.lat, lng: center.lng }, 'map')
    },
    click(event: LeafletMouseEvent) {
      if (disabled) {
        return
      }

      const map = event.target as LeafletMap
      map.flyTo(event.latlng, Math.max(map.getZoom(), 17), { animate: true, duration: 0.45 })
    },
  })

  return null
}

const useDebouncedValue = <T,>(value: T, delayMs: number) => {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs, value])

  return debounced
}

function useDeferredMapMount() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return ready
}

export function LocationPickerMapClient({
  value,
  defaultCenter = THINAVA_DEFAULT_CENTER,
  address,
  onChange,
  onAddressResolved,
  className,
  heightClassName = 'h-[420px]',
  autoDetect = true,
  disabled = false,
  dark = false,
  searchPlaceholder = 'Search area, street, or landmark',
  showCoordinateFields = false,
}: LocationPickerMapClientProps) {
  const initialCenter = value || defaultCenter
  const [center, setCenter] = useState<LatLng>(initialCenter)
  const [addressText, setAddressText] = useState(address || '')
  const [status, setStatus] = useState<'idle' | 'locating' | 'resolving' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const mapRef = useRef<LeafletMap | null>(null)
  const autoDetectedRef = useRef(false)
  const ready = useDeferredMapMount()
  const debouncedCenter = useDebouncedValue(center, 650)
  const debouncedSearch = useDebouncedValue(search, 450)

  const notifyChange = useCallback(
    (position: LatLng, source: LocationPickerChangeSource, nextAddress?: string, shortName?: string) => {
      onChange({
        lat: position.lat,
        lng: position.lng,
        address: nextAddress,
        shortName,
        source,
      })
    },
    [onChange]
  )

  useEffect(() => {
    if (value && (value.lat !== center.lat || value.lng !== center.lng)) {
      setCenter(value)
    }
  }, [center.lat, center.lng, value])

  useEffect(() => {
    if (address !== undefined) {
      setAddressText(address)
    }
  }, [address])

  useEffect(() => {
    const controller = new AbortController()
    setStatus('resolving')

    reverseGeocode(debouncedCenter, controller.signal)
      .then((result) => {
        setAddressText(result.displayName)
        setError(null)
        setStatus('idle')
        onAddressResolved?.(result)
        notifyChange(debouncedCenter, 'map', result.displayName, result.shortName)
      })
      .catch((caught) => {
        if ((caught as Error).name === 'AbortError') {
          return
        }

        setStatus('error')
        setError('Address lookup is taking longer than expected. You can still save this pin.')
        notifyChange(debouncedCenter, 'map', formatLatLng(debouncedCenter))
      })

    return () => controller.abort()
  }, [debouncedCenter, notifyChange, onAddressResolved])

  useEffect(() => {
    if (!autoDetect || autoDetectedRef.current || value || disabled) {
      return
    }

    autoDetectedRef.current = true
    void handleUseCurrentLocation('initial')
  }, [autoDetect, disabled, value])

  useEffect(() => {
    const normalized = debouncedSearch.trim()
    if (normalized.length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const controller = new AbortController()
    setSearching(true)

    searchPlaces(normalized, controller.signal)
      .then((results) => {
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
      })
      .catch(() => {
        setSuggestions([])
        setShowSuggestions(false)
      })
      .finally(() => setSearching(false))

    return () => controller.abort()
  }, [debouncedSearch])

  const handleMapReady = useCallback((map: LeafletMap) => {
    mapRef.current = map
  }, [])

  const handleMoveEnd = useCallback(
    (position: LatLng, source: LocationPickerChangeSource) => {
      setCenter(position)
      notifyChange(position, source, addressText || formatLatLng(position))
    },
    [addressText, notifyChange]
  )

  async function handleUseCurrentLocation(source: LocationPickerChangeSource = 'gps') {
    if (disabled) {
      return
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Location is not available in this browser.')
      return
    }

    setStatus('locating')
    setError(null)

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 14000,
          maximumAge: 12000,
        })
      })

      const next = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }

      setCenter(next)
      notifyChange(next, source, addressText || formatLatLng(next))
      mapRef.current?.flyTo([next.lat, next.lng], 17, { animate: true, duration: 0.65 })
    } catch (caught) {
      const geolocationError = caught as GeolocationPositionError
      setStatus('error')
      setError(
        geolocationError?.code === geolocationError?.PERMISSION_DENIED
          ? 'Location permission was denied. Move the pin manually.'
          : 'Unable to detect your current location. Move the pin manually.'
      )
    }
  }

  const selectSuggestion = (suggestion: GeocodeResult) => {
    const next = { lat: suggestion.lat, lng: suggestion.lng }
    setCenter(next)
    setAddressText(suggestion.displayName)
    setSearch(suggestion.shortName)
    setShowSuggestions(false)
    notifyChange(next, 'search', suggestion.displayName, suggestion.shortName)
    onAddressResolved?.(suggestion)
    mapRef.current?.flyTo([next.lat, next.lng], 17, { animate: true, duration: 0.65 })
  }

  const coordinateLabel = useMemo(() => formatLatLng(center), [center])

  return (
    <div className={cn('space-y-3', className)}>
      <div
        className={cn(
          'thinava-location-picker',
          dark && 'thinava-location-picker-dark',
          heightClassName
        )}
      >
        {ready ? (
          <MapContainer
            center={[initialCenter.lat, initialCenter.lng]}
            zoom={16}
            className="thinava-map-container"
            zoomControl={false}
            scrollWheelZoom
            preferCanvas
          >
            <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILE_URL} />
            <ZoomControl position="bottomright" />
            <MapController center={center} onMapReady={handleMapReady} />
            <CenterEvents disabled={disabled} onMoveEnd={handleMoveEnd} />
          </MapContainer>
        ) : (
          <div className="flex h-full min-h-[inherit] w-full items-center justify-center bg-slate-100">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-4 z-[410] px-4">
          <div className="pointer-events-auto relative mx-auto max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              disabled={disabled}
              placeholder={searchPlaceholder}
              className="h-12 w-full rounded-2xl border border-white/80 bg-white/95 pl-11 pr-11 text-sm font-semibold text-slate-900 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.55)] outline-none backdrop-blur placeholder:text-slate-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10 disabled:opacity-60"
            />
            {search ? (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setSuggestions([])
                  setShowSuggestions(false)
                }}
                className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}

            {showSuggestions ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.placeId}
                    type="button"
                    onClick={() => selectSuggestion(suggestion)}
                    className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-orange-50"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-950">
                        {suggestion.shortName}
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">
                        {suggestion.displayName}
                      </span>
                    </span>
                  </button>
                ))}
                {searching && suggestions.length === 0 ? (
                  <div className="px-4 py-3 text-sm font-medium text-slate-500">Searching...</div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="thinava-center-pin" aria-hidden="true">
          <div className="thinava-center-pin-pulse" />
          <div className="thinava-center-pin-head">
            <MapPin className="h-7 w-7" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleUseCurrentLocation('gps')}
          disabled={disabled || status === 'locating'}
          className="absolute bottom-28 right-4 z-[405] flex h-12 w-12 items-center justify-center rounded-2xl border border-white/80 bg-white text-orange-600 shadow-[0_18px_38px_-22px_rgba(15,23,42,0.55)] transition hover:bg-orange-50 disabled:opacity-60"
          aria-label="Use current location"
        >
          {status === 'locating' ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
        </button>

        <div className="absolute bottom-0 left-0 right-0 z-[400] rounded-t-[28px] border-t border-white/70 bg-white/95 p-4 shadow-[0_-20px_50px_-36px_rgba(15,23,42,0.75)] backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              {status === 'resolving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-slate-950">
                {addressText || 'Move the pin to select your location'}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">{error || coordinateLabel}</p>
            </div>
          </div>
        </div>
      </div>

      {showCoordinateFields ? (
        <div className="grid grid-cols-2 gap-3">
          <input
            readOnly
            value={center.lat.toFixed(6)}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-mono text-slate-600"
            aria-label="Latitude"
          />
          <input
            readOnly
            value={center.lng.toFixed(6)}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-mono text-slate-600"
            aria-label="Longitude"
          />
        </div>
      ) : null}
    </div>
  )
}
