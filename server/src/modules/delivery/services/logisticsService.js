const TADEPALLIGUDEM_CENTER = {
  latitude: 16.8148,
  longitude: 81.527,
}

const DELIVERY_PAY_DEFAULTS = {
  basePay: Number(process.env.DELIVERY_BASE_PAY || 0),
  perKmRate: Number(process.env.DELIVERY_PER_KM_RATE || 10),
  nightPerKmRate: Number(process.env.DELIVERY_NIGHT_PER_KM_RATE || 13),
  surgeBonus: Number(process.env.DELIVERY_SURGE_BONUS || 10),
  rainBonus: Number(process.env.DELIVERY_RAIN_BONUS || 15),
}

const DEFAULT_GPS_RADIUS_METERS = Number(process.env.DELIVERY_GPS_RADIUS_METERS || 75)

const hashNumber = (seed, min, max) => {
  const value = String(seed || 'thinava')
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  const normalized = hash / 4294967295
  return min + normalized * (max - min)
}

const coerceCoordinate = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const resolveCoordinatePair = ({ seed, latitude, longitude }) => {
  const resolvedLatitude = coerceCoordinate(latitude)
  const resolvedLongitude = coerceCoordinate(longitude)

  return {
    latitude:
      resolvedLatitude !== null
        ? resolvedLatitude
        : Number(hashNumber(`${seed}-lat`, 16.798, 16.834).toFixed(6)),
    longitude:
      resolvedLongitude !== null
        ? resolvedLongitude
        : Number(hashNumber(`${seed}-lng`, 81.503, 81.552).toFixed(6)),
  }
}

const toRadians = (value) => (value * Math.PI) / 180

const haversineDistanceKm = (from, to) => {
  const earthRadiusKm = 6371
  const latitudeDelta = toRadians(to.latitude - from.latitude)
  const longitudeDelta = toRadians(to.longitude - from.longitude)
  const startLatitude = toRadians(from.latitude)
  const endLatitude = toRadians(to.latitude)

  const haversine =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2)

  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  return earthRadiusKm * centralAngle
}

const roundMetric = (value, digits = 2) => Number(Number(value || 0).toFixed(digits))

const metersFromKm = (value) => Math.round(Number(value || 0) * 1000)

const isPeakWindow = (date = new Date()) => {
  const minutes = date.getHours() * 60 + date.getMinutes()
  const peakWindows = [
    [12 * 60, 14 * 60 + 30],
    [19 * 60, 22 * 60 + 30],
  ]

  return peakWindows.some(([startMinutes, endMinutes]) => minutes >= startMinutes && minutes <= endMinutes)
}

const isNightWindow = (date = new Date()) => {
  const hour = date.getHours()
  return hour >= 22 || hour < 6
}

const shouldApplyRainBonus = () => String(process.env.DELIVERY_RAIN_MODE || 'false').toLowerCase() === 'true'

const isCoordinatePair = (value) =>
  Boolean(
    value &&
      coerceCoordinate(value.latitude) !== null &&
      coerceCoordinate(value.longitude) !== null
  )

const calculateDistanceMeters = (from, to) => {
  if (!isCoordinatePair(from) || !isCoordinatePair(to)) {
    return null
  }

  return metersFromKm(haversineDistanceKm(from, to))
}

const getEffectivePerKmRate = (now = new Date()) =>
  isNightWindow(now) ? DELIVERY_PAY_DEFAULTS.nightPerKmRate : DELIVERY_PAY_DEFAULTS.perKmRate

const getGoogleMapsKey = () =>
  process.env.GOOGLE_MAPS_SERVER_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  ''

const fetchGoogleRouteMetrics = async ({ origin, restaurant, customer }) => {
  const apiKey = getGoogleMapsKey()
  if (!apiKey || apiKey.includes('your-google-maps-api-key')) {
    return null
  }

  const url = new URL('https://maps.googleapis.com/maps/api/directions/json')
  url.searchParams.set('origin', `${origin.latitude},${origin.longitude}`)
  url.searchParams.set('destination', `${customer.latitude},${customer.longitude}`)
  url.searchParams.set('waypoints', `via:${restaurant.latitude},${restaurant.longitude}`)
  url.searchParams.set('mode', 'driving')
  url.searchParams.set('key', apiKey)

  try {
    const response = await fetch(url.toString())
    if (!response.ok) {
      return null
    }

    const payload = await response.json()
    if (payload.status !== 'OK' || !Array.isArray(payload.routes) || payload.routes.length === 0) {
      return null
    }

    const route = payload.routes[0]
    const legs = Array.isArray(route.legs) ? route.legs : []
    if (legs.length < 2) {
      return null
    }

    const pickupLeg = legs[0]
    const dropoffLeg = legs[1]
    const pickupDistanceKm = roundMetric((pickupLeg.distance?.value || 0) / 1000)
    const dropoffDistanceKm = roundMetric((dropoffLeg.distance?.value || 0) / 1000)
    const pickupEtaMinutes = Math.max(1, Math.round((pickupLeg.duration?.value || 0) / 60))
    const dropoffEtaMinutes = Math.max(1, Math.round((dropoffLeg.duration?.value || 0) / 60))

    return {
      pickupDistanceKm,
      dropoffDistanceKm,
      routeDistanceKm: roundMetric(pickupDistanceKm + dropoffDistanceKm),
      pickupEtaMinutes,
      dropoffEtaMinutes,
      totalEtaMinutes: pickupEtaMinutes + dropoffEtaMinutes,
      provider: 'google_maps',
    }
  } catch {
    return null
  }
}

const buildFallbackRouteMetrics = ({ origin, restaurant, customer }) => {
  const pickupDistanceKm = roundMetric(haversineDistanceKm(origin, restaurant) * 1.22)
  const dropoffDistanceKm = roundMetric(haversineDistanceKm(restaurant, customer) * 1.18)
  const routeDistanceKm = roundMetric(pickupDistanceKm + dropoffDistanceKm)

  const pickupEtaMinutes = Math.max(4, Math.round((pickupDistanceKm / 22) * 60))
  const dropoffEtaMinutes = Math.max(6, Math.round((dropoffDistanceKm / 24) * 60))

  return {
    pickupDistanceKm,
    dropoffDistanceKm,
    routeDistanceKm,
    pickupEtaMinutes,
    dropoffEtaMinutes,
    totalEtaMinutes: pickupEtaMinutes + dropoffEtaMinutes,
    provider: 'fallback',
  }
}

const calculateDynamicDeliveryPay = (deliveryDistanceKm, paymentMethod = 'cod', now = new Date()) => {
  const distanceKm = roundMetric(deliveryDistanceKm)
  const basePay = DELIVERY_PAY_DEFAULTS.basePay
  const nightRateActive = isNightWindow(now)
  const effectivePerKmRate = nightRateActive
    ? DELIVERY_PAY_DEFAULTS.nightPerKmRate
    : DELIVERY_PAY_DEFAULTS.perKmRate
  const distancePay = roundMetric(distanceKm * effectivePerKmRate)
  const regularDistancePay = roundMetric(distanceKm * DELIVERY_PAY_DEFAULTS.perKmRate)
  const surgeBonus = isPeakWindow(now) ? DELIVERY_PAY_DEFAULTS.surgeBonus : 0
  const rainBonus = shouldApplyRainBonus() ? DELIVERY_PAY_DEFAULTS.rainBonus : 0
  const nightBonus = nightRateActive ? roundMetric(distancePay - regularDistancePay) : 0
  const codHandlingBonus = String(paymentMethod || '').toLowerCase() === 'cod' ? 4 : 0
  const total = roundMetric(basePay + distancePay + surgeBonus + rainBonus + codHandlingBonus)

  return {
    basePay: roundMetric(basePay),
    perKmRate: effectivePerKmRate,
    distancePay,
    surgeBonus: roundMetric(surgeBonus),
    rainBonus: roundMetric(rainBonus),
    nightBonus,
    codHandlingBonus: roundMetric(codHandlingBonus),
    total,
  }
}

const buildDeliveryOfferMetrics = async ({
  orderId,
  paymentMethod,
  restaurantLatitude,
  restaurantLongitude,
  customerLatitude,
  customerLongitude,
  riderLatitude,
  riderLongitude,
}) => {
  const restaurant = resolveCoordinatePair({
    seed: `${orderId}-restaurant`,
    latitude: restaurantLatitude,
    longitude: restaurantLongitude,
  })
  const customer = resolveCoordinatePair({
    seed: `${orderId}-customer`,
    latitude: customerLatitude,
    longitude: customerLongitude,
  })
  const origin =
    coerceCoordinate(riderLatitude) !== null && coerceCoordinate(riderLongitude) !== null
      ? {
          latitude: Number(riderLatitude),
          longitude: Number(riderLongitude),
        }
      : TADEPALLIGUDEM_CENTER

  const routeMetrics =
    (await fetchGoogleRouteMetrics({ origin, restaurant, customer })) ||
    buildFallbackRouteMetrics({ origin, restaurant, customer })

  const pay = calculateDynamicDeliveryPay(routeMetrics.dropoffDistanceKm, paymentMethod)

  return {
    coordinates: {
      origin,
      restaurant,
      customer,
    },
    route: routeMetrics,
    pay,
  }
}

module.exports = {
  DEFAULT_GPS_RADIUS_METERS,
  TADEPALLIGUDEM_CENTER,
  buildDeliveryOfferMetrics,
  calculateDistanceMeters,
  calculateDynamicDeliveryPay,
  coerceCoordinate,
  getEffectivePerKmRate,
  haversineDistanceKm,
  isCoordinatePair,
  isNightWindow,
  resolveCoordinatePair,
  roundMetric,
}
