const env = require('../../../config/env')

const TADEPALLIGUDEM_CENTER = {
  latitude: 16.8148,
  longitude: 81.527,
}

const DELIVERY_PAY_DEFAULTS = {
  basePay: env.DELIVERY_BASE_PAY,
  perKmRate: env.DELIVERY_PER_KM_RATE,
  nightPerKmRate: env.DELIVERY_NIGHT_PER_KM_RATE,
  surgeBonus: env.DELIVERY_SURGE_BONUS,
  rainBonus: env.DELIVERY_RAIN_BONUS,
  codHandlingBonus: env.DELIVERY_COD_HANDLING_BONUS || 4,
  baseDistanceKm: 2,
}

const DEFAULT_GPS_RADIUS_METERS = env.DELIVERY_GPS_RADIUS_METERS

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

const shouldApplyRainBonus = () => String(env.DELIVERY_RAIN_MODE).toLowerCase() === 'true'

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

const getEffectivePerKmRate = () => DELIVERY_PAY_DEFAULTS.perKmRate

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
    provider: 'openstreetmap_estimate',
  }
}

const computeRiderPayout = (deliveryDistanceKm, options = {}) => {
  const {
    paymentMethod = 'cod',
    now = new Date(),
    tipAmount = 0,
  } = options
  const distanceKm = roundMetric(deliveryDistanceKm)
  const billableDistanceKm = Math.max(0, Math.ceil(distanceKm) - DELIVERY_PAY_DEFAULTS.baseDistanceKm)
  const basePay = DELIVERY_PAY_DEFAULTS.basePay > 0 ? DELIVERY_PAY_DEFAULTS.basePay : 25
  const regularPerKmRate = DELIVERY_PAY_DEFAULTS.perKmRate > 0 ? DELIVERY_PAY_DEFAULTS.perKmRate : 10
  const distancePay = roundMetric(billableDistanceKm * regularPerKmRate)
  const resolvedTipAmount = roundMetric(tipAmount)
  const total = roundMetric(basePay + distancePay + resolvedTipAmount)

  return {
    basePay: roundMetric(basePay),
    perKmRate: regularPerKmRate,
    baseDistanceKm: DELIVERY_PAY_DEFAULTS.baseDistanceKm,
    billableDistanceKm,
    distancePay,
    surgeBonus: 0,
    rainBonus: 0,
    nightBonus: 0,
    codHandlingBonus: 0,
    tipAmount: resolvedTipAmount,
    total,
  }
}

const calculateDynamicDeliveryPay = (deliveryDistanceKm, paymentMethod = 'cod', now = new Date()) =>
  computeRiderPayout(deliveryDistanceKm, { paymentMethod, now })

const buildDeliveryOfferMetrics = async ({
  orderId,
  paymentMethod,
  restaurantLatitude,
  restaurantLongitude,
  customerLatitude,
  customerLongitude,
  riderLatitude,
  riderLongitude,
  tipAmount = 0,
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

  const routeMetrics = buildFallbackRouteMetrics({ origin, restaurant, customer })

  const pay = computeRiderPayout(routeMetrics.dropoffDistanceKm, { paymentMethod, tipAmount })

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
  computeRiderPayout,
  coerceCoordinate,
  getEffectivePerKmRate,
  haversineDistanceKm,
  isCoordinatePair,
  isNightWindow,
  resolveCoordinatePair,
  roundMetric,
}
