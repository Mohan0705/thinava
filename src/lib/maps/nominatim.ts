import {
  NOMINATIM_BASE_URL,
  NOMINATIM_REQUEST_GAP_MS,
} from '@/lib/maps/constants'
import { latLngKey, mapDebug, normalizeLatLng } from '@/lib/maps/performance'
import type { GeocodeAddress, GeocodeResult, LatLng } from '@/lib/maps/types'

type CacheEntry<T> = {
  expiresAt: number
  value: T
}

const memoryCache = new Map<string, CacheEntry<unknown>>()
let lastRequestAt = 0
let queue = Promise.resolve()

const CACHE_PREFIX = 'thinava:osm-geocode:'
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7

const getCacheKey = (type: 'reverse' | 'search', value: string) =>
  `${CACHE_PREFIX}${type}:${value.toLowerCase()}`

const readCache = <T>(key: string): T | null => {
  const now = Date.now()
  const memoryValue = memoryCache.get(key)

  if (memoryValue && memoryValue.expiresAt > now) {
    return memoryValue.value as T
  }

  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as CacheEntry<T>
    if (parsed.expiresAt <= now) {
      window.localStorage.removeItem(key)
      return null
    }

    memoryCache.set(key, parsed as CacheEntry<unknown>)
    return parsed.value
  } catch {
    return null
  }
}

const writeCache = <T>(key: string, value: T) => {
  const entry: CacheEntry<T> = {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  }

  memoryCache.set(key, entry as CacheEntry<unknown>)

  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // Cache failures should never block address selection.
  }
}

const createAbortError = () => {
  const error = new Error('Request aborted')
  error.name = 'AbortError'
  return error
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError())
      return
    }

    let timer: ReturnType<typeof globalThis.setTimeout>

    const abort = () => {
      globalThis.clearTimeout(timer)
      reject(createAbortError())
    }

    timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, ms)

    signal?.addEventListener('abort', abort, { once: true })
  })

const enqueueFetch = async <T>(run: () => Promise<T>, signal?: AbortSignal) => {
  const task = queue.then(async () => {
    const elapsed = Date.now() - lastRequestAt
    if (elapsed < NOMINATIM_REQUEST_GAP_MS) {
      await wait(NOMINATIM_REQUEST_GAP_MS - elapsed, signal)
    }

    if (signal?.aborted) {
      throw createAbortError()
    }

    lastRequestAt = Date.now()
    return run()
  })

  queue = task.then(
    () => undefined,
    () => undefined
  )

  return task
}

const buildUrl = (path: string, params: Record<string, string | number>) => {
  const url = new URL(path, NOMINATIM_BASE_URL)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value))
  })
  return url
}

const fetchJson = async <T>(url: URL, signal?: AbortSignal) => {
  const response = await enqueueFetch(
    () =>
      fetch(url.toString(), {
        signal,
        headers: {
          Accept: 'application/json',
        },
      }),
    signal
  )

  if (!response.ok) {
    throw new Error(`OpenStreetMap lookup failed (${response.status})`)
  }

  return (await response.json()) as T
}

const pickShortName = (address: GeocodeAddress, displayName: string) => {
  return (
    address.neighbourhood ||
    address.suburb ||
    address.road ||
    address.city ||
    address.town ||
    address.village ||
    displayName.split(',')[0]?.trim() ||
    displayName
  )
}

const normalizeAddress = (address: Record<string, any>): GeocodeAddress => ({
  houseNumber: address.house_number,
  road: address.road || address.pedestrian || address.footway,
  neighbourhood: address.neighbourhood || address.quarter,
  suburb: address.suburb || address.residential,
  city: address.city || address.city_district,
  town: address.town,
  village: address.village,
  state: address.state,
  postcode: address.postcode,
  country: address.country,
})

const mapNominatimResult = (item: Record<string, any>): GeocodeResult => {
  const address = normalizeAddress(item.address || {})
  const displayName = String(item.display_name || item.name || 'Selected location')

  return {
    placeId: String(item.place_id || `${item.osm_type || 'osm'}-${item.osm_id || displayName}`),
    lat: Number(item.lat),
    lng: Number(item.lon),
    displayName,
    shortName: pickShortName(address, displayName),
    address,
    raw: item,
  }
}

export const reverseGeocode = async (position: LatLng, signal?: AbortSignal) => {
  const queryPosition = normalizeLatLng(position, 6)
  const cacheKey = getCacheKey('reverse', latLngKey(position, 5))
  const cached = readCache<GeocodeResult>(cacheKey)

  if (cached) {
    mapDebug('reverse geocode cache hit', { key: cacheKey })
    return cached
  }

  mapDebug('reverse geocode request', { key: cacheKey, position: queryPosition })
  const url = buildUrl('/reverse', {
    format: 'jsonv2',
    lat: queryPosition.lat,
    lon: queryPosition.lng,
    zoom: 18,
    addressdetails: 1,
    'accept-language': 'en-IN,en',
  })

  const raw = await fetchJson<Record<string, any>>(url, signal)
  const result = mapNominatimResult(raw)
  writeCache(cacheKey, result)
  return result
}

export const searchPlaces = async (query: string, signal?: AbortSignal) => {
  const normalized = query.trim()
  if (normalized.length < 3) {
    return []
  }

  const cacheKey = getCacheKey('search', normalized)
  const cached = readCache<GeocodeResult[]>(cacheKey)
  if (cached) {
    mapDebug('place search cache hit', { query: normalized })
    return cached
  }

  mapDebug('place search request', { query: normalized })
  const url = buildUrl('/search', {
    format: 'jsonv2',
    q: normalized,
    countrycodes: 'in',
    limit: 6,
    addressdetails: 1,
    'accept-language': 'en-IN,en',
  })

  const raw = await fetchJson<Array<Record<string, any>>>(url, signal)
  const results = raw
    .map(mapNominatimResult)
    .filter((result) => Number.isFinite(result.lat) && Number.isFinite(result.lng))

  writeCache(cacheKey, results)
  return results
}
