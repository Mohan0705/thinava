'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, LocateFixed, Loader2, MapPin, Search, X } from 'lucide-react'
import { MapContainer, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import type { LeafletMouseEvent, Map as LeafletMap } from 'leaflet'
import { OSM_ATTRIBUTION, OSM_TILE_URL, THINAVA_DEFAULT_CENTER } from '@/lib/maps/constants'
import { formatLatLng } from '@/lib/maps/geo'
import { reverseGeocode, searchPlaces } from '@/lib/maps/nominatim'
import {
  areLatLngClose,
  distanceMeters,
  isCoarsePointer,
  latLngKey,
  mapDebug,
  normalizeLatLng,
  shouldAnimateMap,
} from '@/lib/maps/performance'
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

type ReverseTarget = {
  position: LatLng
  source: LocationPickerChangeSource
  key: string
}

type MapMoveOptions = {
  zoom?: number
  animate?: boolean
  duration?: number
}

type SelectPositionOptions = MapMoveOptions & {
  address?: string
  shortName?: string
  moveMap?: boolean
  notify?: boolean
  reverse?: boolean
  resolvedResult?: GeocodeResult
}

type DebugEventName = 'move' | 'moveend' | 'drag' | 'zoom'

const REVERSE_GEOCODE_DEBOUNCE_MS = 850
const SEARCH_DEBOUNCE_MS = 450
const PROGRAMMATIC_MOVE_SUPPRESS_MS = 950
const PROGRAMMATIC_MOVE_SUPPRESS_FAST_MS = 350
const MAP_EVENT_LOG_INTERVAL_MS = 2500
const SELECTION_MOVE_THRESHOLD_METERS = 0.75
const REVERSE_GEOCODE_PRECISION = 5

function useLatestRef<T>(value: T) {
  const ref = useRef(value)
  ref.current = value
  return ref
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

function useRenderDebug(label: string) {
  const renderCountRef = useRef(0)
  renderCountRef.current += 1

  useEffect(() => {
    const count = renderCountRef.current
    if (count === 1 || count % 10 === 0) {
      mapDebug(`${label} render count`, { count })
    }
  })
}

function MapController({
  onMapReady,
}: {
  onMapReady: (map: LeafletMap | null) => void
}) {
  const map = useMap()

  useEffect(() => {
    onMapReady(map)
    return () => onMapReady(null)
  }, [map, onMapReady])

  return null
}

function CenterEvents({
  disabled,
  shouldIgnoreMoveEnd,
  onMoveEnd,
  onClickPosition,
}: {
  disabled?: boolean
  shouldIgnoreMoveEnd: () => boolean
  onMoveEnd: (position: LatLng, source: LocationPickerChangeSource) => void
  onClickPosition: (position: LatLng) => void
}) {
  const frameRef = useRef<number | null>(null)
  const lastMoveEndKeyRef = useRef<string | null>(null)
  const eventCountsRef = useRef<Record<DebugEventName, number> & { lastLoggedAt: number }>({
    move: 0,
    moveend: 0,
    drag: 0,
    zoom: 0,
    lastLoggedAt: 0,
  })

  const logEvent = useCallback((name: DebugEventName) => {
    const counts = eventCountsRef.current
    counts[name] += 1
    const now = Date.now()

    if (now - counts.lastLoggedAt < MAP_EVENT_LOG_INTERVAL_MS) {
      return
    }

    mapDebug('picker event frequency', {
      move: counts.move,
      moveend: counts.moveend,
      drag: counts.drag,
      zoom: counts.zoom,
    })

    eventCountsRef.current = {
      move: 0,
      moveend: 0,
      drag: 0,
      zoom: 0,
      lastLoggedAt: now,
    }
  }, [])

  useMapEvents({
    move() {
      logEvent('move')
    },
    drag() {
      logEvent('drag')
    },
    zoom() {
      logEvent('zoom')
    },
    moveend(event) {
      logEvent('moveend')

      if (disabled) {
        return
      }

      if (shouldIgnoreMoveEnd()) {
        mapDebug('picker ignored programmatic moveend')
        return
      }

      const center = event.target.getCenter()
      const next = normalizeLatLng({ lat: center.lat, lng: center.lng })
      const key = latLngKey(next)

      if (lastMoveEndKeyRef.current === key) {
        return
      }

      lastMoveEndKeyRef.current = key

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }

      frameRef.current = window.requestAnimationFrame(() => {
        onMoveEnd(next, 'map')
      })
    },
    click(event: LeafletMouseEvent) {
      if (disabled) {
        return
      }

      onClickPosition(normalizeLatLng({ lat: event.latlng.lat, lng: event.latlng.lng }))
    },
  })

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

  return null
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
  const initialCenterRef = useRef<LatLng | null>(null)
  if (initialCenterRef.current === null) {
    initialCenterRef.current = normalizeLatLng(value || defaultCenter)
  }

  const initialCenter = initialCenterRef.current!
  const [center, setCenter] = useState<LatLng>(() => initialCenter)
  const [reverseTarget, setReverseTarget] = useState<ReverseTarget | null>(() => ({
    position: initialCenter,
    source: 'initial',
    key: latLngKey(initialCenter, REVERSE_GEOCODE_PRECISION),
  }))
  const [addressText, setAddressText] = useState(address || '')
  const [status, setStatus] = useState<'idle' | 'locating' | 'resolving' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const mapRef = useRef<LeafletMap | null>(null)
  const pendingMapMoveRef = useRef<{ position: LatLng; options: MapMoveOptions } | null>(null)
  const selectedPositionRef = useRef(initialCenter)
  const programmaticMoveUntilRef = useRef(0)
  const autoDetectedRef = useRef(false)
  const reverseCacheRef = useRef(new Map<string, GeocodeResult>())
  const reverseRequestIdRef = useRef(0)
  const searchRequestIdRef = useRef(0)
  const onChangeRef = useLatestRef(onChange)
  const onAddressResolvedRef = useLatestRef(onAddressResolved)
  const addressTextRef = useLatestRef(addressText)
  const ready = useDeferredMapMount()
  const debouncedReverseTarget = useDebouncedValue(reverseTarget, REVERSE_GEOCODE_DEBOUNCE_MS)
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)
  const tileKeepBuffer = useMemo(() => (isCoarsePointer() ? 1 : 2), [])

  useRenderDebug('LocationPickerMapClient')

  const notifyChange = useCallback(
    (
      position: LatLng,
      source: LocationPickerChangeSource,
      nextAddress?: string,
      shortName?: string
    ) => {
      const normalized = normalizeLatLng(position)
      onChangeRef.current({
        lat: normalized.lat,
        lng: normalized.lng,
        address: nextAddress,
        shortName,
        source,
      })
    },
    [onChangeRef]
  )

  const moveMapTo = useCallback((position: LatLng, options: MapMoveOptions = {}) => {
    const next = normalizeLatLng(position)
    const map = mapRef.current

    if (!map) {
      pendingMapMoveRef.current = { position: next, options }
      return
    }

    const targetZoom = options.zoom ?? Math.max(map.getZoom(), 16)
    const currentCenter = map.getCenter()
    const current = { lat: currentCenter.lat, lng: currentCenter.lng }

    if (areLatLngClose(current, next, 0.75) && map.getZoom() === targetZoom) {
      return
    }

    const animate = Boolean(options.animate && shouldAnimateMap())
    programmaticMoveUntilRef.current =
      Date.now() + (animate ? PROGRAMMATIC_MOVE_SUPPRESS_MS : PROGRAMMATIC_MOVE_SUPPRESS_FAST_MS)

    mapDebug('picker programmatic map move', {
      position: next,
      zoom: targetZoom,
      animate,
    })

    map.stop()

    if (animate) {
      map.flyTo([next.lat, next.lng], targetZoom, {
        animate: true,
        duration: options.duration ?? 0.3,
      })
      return
    }

    map.setView([next.lat, next.lng], targetZoom, { animate: false })
  }, [])

  const handleMapReady = useCallback(
    (map: LeafletMap | null) => {
      mapRef.current = map

      if (!map || !pendingMapMoveRef.current) {
        return
      }

      const pending = pendingMapMoveRef.current
      pendingMapMoveRef.current = null
      window.requestAnimationFrame(() => moveMapTo(pending.position, pending.options))
    },
    [moveMapTo]
  )

  const shouldIgnoreMoveEnd = useCallback(() => {
    return Date.now() < programmaticMoveUntilRef.current
  }, [])

  const applyReverseResult = useCallback(
    (target: ReverseTarget, result: GeocodeResult) => {
      setAddressText(result.displayName)
      setError(null)
      setStatus('idle')
      onAddressResolvedRef.current?.(result)
      notifyChange(target.position, target.source, result.displayName, result.shortName)
    },
    [notifyChange, onAddressResolvedRef]
  )

  const selectPosition = useCallback(
    (
      position: LatLng,
      source: LocationPickerChangeSource,
      options: SelectPositionOptions = {}
    ) => {
      const next = normalizeLatLng(position)
      const previous = selectedPositionRef.current
      const movedMeters = previous ? distanceMeters(previous, next) : Number.POSITIVE_INFINITY
      const duplicateSelection =
        movedMeters <= SELECTION_MOVE_THRESHOLD_METERS &&
        !options.address &&
        !options.resolvedResult &&
        !options.moveMap

      if (duplicateSelection) {
        mapDebug('picker ignored duplicate selection', { source, movedMeters })
        return
      }

      selectedPositionRef.current = next
      setCenter((current) => (areLatLngClose(current, next, 0.25) ? current : next))

      if (options.address !== undefined) {
        setAddressText(options.address)
      }

      if (options.resolvedResult) {
        onAddressResolvedRef.current?.(options.resolvedResult)
      }

      const immediateAddress =
        options.address ??
        (source === 'search' ? addressTextRef.current || formatLatLng(next) : formatLatLng(next))

      if (options.notify !== false) {
        notifyChange(next, source, immediateAddress, options.shortName)
      }

      if (options.reverse !== false && source !== 'search') {
        const key = latLngKey(next, REVERSE_GEOCODE_PRECISION)
        setReverseTarget((current) =>
          current?.key === key && current.source === source
            ? current
            : {
                position: next,
                source,
                key,
              }
        )
      }

      if (options.moveMap) {
        moveMapTo(next, {
          zoom: options.zoom,
          animate: options.animate,
          duration: options.duration,
        })
      }
    },
    [addressTextRef, moveMapTo, notifyChange, onAddressResolvedRef]
  )

  useEffect(() => {
    if (!value) {
      return
    }

    const next = normalizeLatLng(value)
    if (areLatLngClose(selectedPositionRef.current, next, 1)) {
      return
    }

    mapDebug('picker external value sync', { position: next })
    selectPosition(next, 'initial', {
      moveMap: true,
      notify: false,
      reverse: true,
      animate: false,
    })
  }, [selectPosition, value?.lat, value?.lng])

  useEffect(() => {
    if (address !== undefined) {
      setAddressText((current) => (current === address ? current : address))
    }
  }, [address])

  useEffect(() => {
    if (!debouncedReverseTarget || disabled) {
      return
    }

    const target = debouncedReverseTarget
    const cached = reverseCacheRef.current.get(target.key)

    if (cached) {
      applyReverseResult(target, cached)
      return
    }

    const controller = new AbortController()
    const requestId = reverseRequestIdRef.current + 1
    reverseRequestIdRef.current = requestId

    setStatus('resolving')
    mapDebug('picker reverse geocode start', {
      key: target.key,
      source: target.source,
    })

    reverseGeocode(target.position, controller.signal)
      .then((result) => {
        if (controller.signal.aborted || requestId !== reverseRequestIdRef.current) {
          return
        }

        reverseCacheRef.current.set(target.key, result)
        applyReverseResult(target, result)
      })
      .catch((caught) => {
        if ((caught as Error).name === 'AbortError') {
          return
        }

        if (requestId !== reverseRequestIdRef.current) {
          return
        }

        setStatus('error')
        setError('Address lookup is taking longer than expected. You can still save this pin.')
        notifyChange(target.position, target.source, formatLatLng(target.position))
      })

    return () => controller.abort()
  }, [applyReverseResult, debouncedReverseTarget, disabled, notifyChange])

  const handleUseCurrentLocation = useCallback(
    async (source: LocationPickerChangeSource = 'gps') => {
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

        const next = normalizeLatLng({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })

        mapDebug('picker current location resolved', {
          source,
          accuracy: position.coords.accuracy,
        })
        setStatus('idle')
        selectPosition(next, source, {
          moveMap: true,
          zoom: 17,
          animate: true,
          reverse: true,
        })
      } catch (caught) {
        const geolocationError = caught as GeolocationPositionError
        setStatus('error')
        setError(
          geolocationError?.code === geolocationError?.PERMISSION_DENIED
            ? 'Location permission was denied. Move the pin manually.'
            : 'Unable to detect your current location. Move the pin manually.'
        )
      }
    },
    [disabled, selectPosition]
  )

  useEffect(() => {
    if (!autoDetect || autoDetectedRef.current || value || disabled) {
      return
    }

    autoDetectedRef.current = true
    void handleUseCurrentLocation('initial')
  }, [autoDetect, disabled, handleUseCurrentLocation, value])

  useEffect(() => {
    const normalized = debouncedSearch.trim()
    const requestId = searchRequestIdRef.current + 1
    searchRequestIdRef.current = requestId

    if (normalized.length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      setSearching(false)
      return
    }

    const controller = new AbortController()
    setSearching(true)

    searchPlaces(normalized, controller.signal)
      .then((results) => {
        if (controller.signal.aborted || requestId !== searchRequestIdRef.current) {
          return
        }

        setSuggestions(results)
        setShowSuggestions(results.length > 0)
      })
      .catch((caught) => {
        if ((caught as Error).name === 'AbortError') {
          return
        }

        if (requestId !== searchRequestIdRef.current) {
          return
        }

        setSuggestions([])
        setShowSuggestions(false)
      })
      .finally(() => {
        if (requestId === searchRequestIdRef.current) {
          setSearching(false)
        }
      })

    return () => controller.abort()
  }, [debouncedSearch])

  const handleMoveEnd = useCallback(
    (position: LatLng, source: LocationPickerChangeSource) => {
      selectPosition(position, source, { reverse: true })
    },
    [selectPosition]
  )

  const handleMapClick = useCallback(
    (position: LatLng) => {
      selectPosition(position, 'map', {
        moveMap: true,
        zoom: 17,
        animate: true,
        reverse: true,
      })
    },
    [selectPosition]
  )

  const selectSuggestion = useCallback(
    (suggestion: GeocodeResult) => {
      const next = normalizeLatLng({ lat: suggestion.lat, lng: suggestion.lng })
      setSearch(suggestion.shortName)
      setShowSuggestions(false)
      setError(null)
      setStatus('idle')
      selectPosition(next, 'search', {
        address: suggestion.displayName,
        shortName: suggestion.shortName,
        moveMap: true,
        zoom: 17,
        animate: true,
        reverse: false,
        resolvedResult: suggestion,
      })
    },
    [selectPosition]
  )

  const coordinateLabel = useMemo(() => formatLatLng(center), [center.lat, center.lng])

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
            scrollWheelZoom={!disabled}
            dragging={!disabled}
            touchZoom={!disabled}
            doubleClickZoom={!disabled}
            boxZoom={!disabled}
            keyboard={!disabled}
            preferCanvas
            zoomAnimation={false}
            fadeAnimation={false}
            markerZoomAnimation={false}
            inertia={!isCoarsePointer()}
            wheelDebounceTime={120}
            wheelPxPerZoomLevel={90}
          >
            <TileLayer
              attribution={OSM_ATTRIBUTION}
              url={OSM_TILE_URL}
              updateWhenIdle
              updateWhenZooming={false}
              updateInterval={250}
              keepBuffer={tileKeepBuffer}
            />
            <ZoomControl position="bottomright" />
            <MapController onMapReady={handleMapReady} />
            <CenterEvents
              disabled={disabled}
              shouldIgnoreMoveEnd={shouldIgnoreMoveEnd}
              onMoveEnd={handleMoveEnd}
              onClickPosition={handleMapClick}
            />
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
