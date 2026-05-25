const DEFAULT_RESTAURANT_TIMEZONE = 'Asia/Kolkata'

const DISPLAY_STATUS = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  MANUALLY_CLOSED: 'MANUALLY_CLOSED',
}

const validTimeZones = new Set()

const isValidTimeZone = (timezone) => {
  const candidate = String(timezone || '').trim()
  if (!candidate) return false
  if (validTimeZones.has(candidate)) return true

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date())
    validTimeZones.add(candidate)
    return true
  } catch {
    return false
  }
}

const resolveTimeZone = (timezone) => (
  isValidTimeZone(timezone) ? String(timezone).trim() : DEFAULT_RESTAURANT_TIMEZONE
)

const parseTimeToMinutes = (value) => {
  if (value === null || value === undefined) return null

  const normalized = String(value)
    .trim()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase()

  if (!normalized) return null

  const match = normalized.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?$/)
  if (!match) return null

  let hours = Number(match[1])
  const minutes = Number(match[2] || 0)
  const meridiem = match[3]

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    return null
  }

  if (meridiem) {
    if (hours < 1 || hours > 12) return null
    if (meridiem === 'AM') {
      hours = hours === 12 ? 0 : hours
    } else {
      hours = hours === 12 ? 12 : hours + 12
    }
  } else if (hours < 0 || hours > 23) {
    return null
  }

  return hours * 60 + minutes
}

const pad2 = (value) => String(value).padStart(2, '0')

const formatDisplayTime = (minutes) => {
  if (minutes === null || minutes === undefined) return null

  const normalized = ((minutes % 1440) + 1440) % 1440
  const hours24 = Math.floor(normalized / 60)
  const mins = normalized % 60
  const period = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = hours24 % 12 || 12

  return `${hours12}:${pad2(mins)} ${period}`
}

const getZonedMinutes = (date, timezone) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(timezone),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

  const parts = formatter.formatToParts(date instanceof Date ? date : new Date(date))
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const hours = Number(values.hour)
  const minutes = Number(values.minute)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0
  }

  return hours * 60 + minutes
}

const toBoolean = (value) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes'
  }
  return false
}

const computeRestaurantAvailability = ({
  opening_time,
  closing_time,
  timezone,
  is_manually_closed,
} = {}, currentServerTime = new Date()) => {
  const resolvedTimeZone = resolveTimeZone(timezone)
  const openingMinutes = parseTimeToMinutes(opening_time)
  const closingMinutes = parseTimeToMinutes(closing_time)
  const manuallyClosed = toBoolean(is_manually_closed)
  const scheduleIsOvernight = openingMinutes !== null && closingMinutes !== null && openingMinutes > closingMinutes

  if (manuallyClosed) {
    return {
      isOpenNow: false,
      displayStatus: DISPLAY_STATUS.MANUALLY_CLOSED,
      nextOpeningTime: null,
      closesAt: null,
      isOvernightSchedule: scheduleIsOvernight,
    }
  }

  if (openingMinutes === null || closingMinutes === null) {
    return {
      isOpenNow: true,
      displayStatus: DISPLAY_STATUS.OPEN,
      nextOpeningTime: null,
      closesAt: null,
      isOvernightSchedule: false,
    }
  }

  if (openingMinutes === closingMinutes) {
    return {
      isOpenNow: true,
      displayStatus: DISPLAY_STATUS.OPEN,
      nextOpeningTime: null,
      closesAt: formatDisplayTime(closingMinutes),
      isOvernightSchedule: false,
    }
  }

  const nowMinutes = getZonedMinutes(currentServerTime, resolvedTimeZone)
  const isOvernightSchedule = scheduleIsOvernight
  const isOpenNow = isOvernightSchedule
    ? nowMinutes >= openingMinutes || nowMinutes < closingMinutes
    : nowMinutes >= openingMinutes && nowMinutes < closingMinutes

  return {
    isOpenNow,
    displayStatus: isOpenNow ? DISPLAY_STATUS.OPEN : DISPLAY_STATUS.CLOSED,
    nextOpeningTime: isOpenNow ? null : formatDisplayTime(openingMinutes),
    closesAt: isOpenNow ? formatDisplayTime(closingMinutes) : null,
    isOvernightSchedule,
  }
}

const parseDeliveryMinutes = (value) => {
  const numbers = String(value || '').match(/\d+/g)?.map(Number) || []
  return numbers.length > 0 ? Math.min(...numbers) : Number.POSITIVE_INFINITY
}

const getRestaurantRating = (restaurant) => (
  Number(restaurant.average_rating ?? restaurant.averageRating ?? restaurant.rating ?? 0)
)

const applyRestaurantAvailability = (restaurant, currentServerTime = new Date()) => {
  const availability = computeRestaurantAvailability(restaurant, currentServerTime)

  return {
    ...restaurant,
    timezone: resolveTimeZone(restaurant.timezone),
    is_open: availability.isOpenNow,
    isOpenNow: availability.isOpenNow,
    displayStatus: availability.displayStatus,
    nextOpeningTime: availability.nextOpeningTime,
    closesAt: availability.closesAt,
    isOvernightSchedule: availability.isOvernightSchedule,
    status: availability.displayStatus,
  }
}

const compareRestaurantsByAvailability = (left, right) => {
  const leftOpen = left.isOpenNow ?? left.is_open ?? false
  const rightOpen = right.isOpenNow ?? right.is_open ?? false

  if (leftOpen !== rightOpen) return leftOpen ? -1 : 1

  const ratingDiff = getRestaurantRating(right) - getRestaurantRating(left)
  if (ratingDiff !== 0) return ratingDiff

  const deliveryDiff = parseDeliveryMinutes(left.delivery_time ?? left.deliveryTime) -
    parseDeliveryMinutes(right.delivery_time ?? right.deliveryTime)
  if (deliveryDiff !== 0) return deliveryDiff

  return String(left.name || '').localeCompare(String(right.name || ''))
}

const applyAvailabilityToRestaurants = (restaurants, currentServerTime = new Date()) => (
  (restaurants || [])
    .map((restaurant) => applyRestaurantAvailability(restaurant, currentServerTime))
    .sort(compareRestaurantsByAvailability)
)

module.exports = {
  DEFAULT_RESTAURANT_TIMEZONE,
  DISPLAY_STATUS,
  applyAvailabilityToRestaurants,
  applyRestaurantAvailability,
  compareRestaurantsByAvailability,
  computeRestaurantAvailability,
  formatDisplayTime,
  parseDeliveryMinutes,
  parseTimeToMinutes,
  resolveTimeZone,
  toBoolean,
}
