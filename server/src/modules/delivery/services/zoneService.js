const pool = require('../../../database/connection')

const toRadians = (value) => (value * Math.PI) / 180

const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null
  const R = 6371000
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const getRiderZones = async (partnerId) => {
  const result = await pool.query(
    `SELECT rz.id, rz.zone_name, rz.is_active, zd.center_latitude, zd.center_longitude, zd.radius_meters
     FROM rider_zones rz
     LEFT JOIN zone_definitions zd ON zd.name = rz.zone_name
     WHERE rz.delivery_partner_id = $1 AND rz.is_active = TRUE`,
    [partnerId]
  )
  return result.rows
}

const assignRiderToZone = async (partnerId, zoneName) => {
  const zoneDef = await pool.query(
    `SELECT id, name FROM zone_definitions WHERE name = $1 AND is_active = TRUE`,
    [zoneName]
  )
  if (zoneDef.rows.length === 0) {
    const error = new Error(`Zone "${zoneName}" not found`)
    error.status = 404
    throw error
  }

  const result = await pool.query(
    `INSERT INTO rider_zones (delivery_partner_id, zone_name)
     VALUES ($1, $2)
     ON CONFLICT (delivery_partner_id, zone_name) DO UPDATE SET is_active = TRUE
     RETURNING id, zone_name`,
    [partnerId, zoneName]
  )
  return result.rows[0]
}

const isRiderInZone = async (partnerId, latitude, longitude) => {
  const zones = await getRiderZones(partnerId)
  if (zones.length === 0) return { in_zone: true, current_zone: null }

  for (const zone of zones) {
    if (zone.center_latitude && zone.center_longitude && zone.radius_meters) {
      const distance = calculateDistanceMeters(
        latitude, longitude,
        Number(zone.center_latitude), Number(zone.center_longitude)
      )
      if (distance !== null && distance <= Number(zone.radius_meters)) {
        return { in_zone: true, current_zone: zone.zone_name, distance_meters: Math.round(distance) }
      }
    }
  }

  return { in_zone: false, current_zone: null }
}

const getZoneDefinitions = async () => {
  const result = await pool.query(
    `SELECT id, name, description, polygon_coordinates, center_latitude, center_longitude, radius_meters, is_active
     FROM zone_definitions
     WHERE is_active = TRUE
     ORDER BY name`
  )
  return result.rows
}

module.exports = {
  getRiderZones,
  assignRiderToZone,
  isRiderInZone,
  getZoneDefinitions,
  calculateDistanceMeters,
}
