const pool = require('../../../database/connection')
const { logger } = require('../../../lib/logger')

const mapShift = (row) => ({
  id: row.id,
  delivery_partner_id: row.delivery_partner_id,
  shift_date: row.shift_date,
  slot_label: row.slot_label,
  zone_name: row.zone_name || '',
  starts_at: row.starts_at,
  ends_at: row.ends_at,
  demand_level: row.demand_level || 'normal',
  incentive_amount: Number(row.incentive_amount || 0),
  status: row.status || 'booked',
  created_at: row.created_at,
  updated_at: row.updated_at,
})

const listShifts = async (partnerId) => {
  const result = await pool.query(
    `SELECT *
     FROM delivery_shifts
     WHERE delivery_partner_id = $1
       AND ends_at >= CURRENT_TIMESTAMP - INTERVAL '12 hours'
     ORDER BY starts_at ASC`,
    [partnerId]
  )

  return result.rows.map(mapShift)
}

const VALID_SLOTS = ['Breakfast', 'Lunch', 'Dinner']

const bookShift = async (partnerId, payload) => {
  logger.info('Shift booking request', {
    tag: 'shift',
    partnerId,
    payload,
  })

  const startsAt = new Date(payload.starts_at)
  const endsAt = new Date(payload.ends_at)

  if (!payload.slot_label || !VALID_SLOTS.includes(payload.slot_label)) {
    logger.warn('Invalid slot_label in shift booking', {
      tag: 'shift',
      partnerId,
      slot_label: payload.slot_label,
    })
    const error = new Error('slot_label must be one of: Breakfast, Lunch, Dinner')
    error.status = 400
    throw error
  }

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    logger.warn('Invalid dates in shift booking', {
      tag: 'shift',
      partnerId,
      starts_at: payload.starts_at,
      ends_at: payload.ends_at,
    })
    const error = new Error('starts_at and ends_at must be valid ISO dates')
    error.status = 400
    throw error
  }

  if (endsAt <= startsAt) {
    logger.warn('Shift end time before start time', {
      tag: 'shift',
      partnerId,
      startsAt,
      endsAt,
    })
    const error = new Error('Shift end time must be after start time')
    error.status = 400
    throw error
  }

  logger.debug('Checking shift overlap', {
    tag: 'shift',
    partnerId,
    query: 'delivery_shifts WHERE delivery_partner_id = $1 AND status IN (booked, active)',
    params: [partnerId, startsAt, endsAt],
  })

  const conflictResult = await pool.query(
    `SELECT id
     FROM delivery_shifts
     WHERE delivery_partner_id = $1
       AND status IN ('booked', 'active')
       AND starts_at < $3
       AND ends_at > $2
     LIMIT 1`,
    [partnerId, startsAt, endsAt]
  )

  if (conflictResult.rows.length > 0) {
    logger.warn('Shift time conflict', {
      tag: 'shift',
      partnerId,
      conflictingShiftId: conflictResult.rows[0].id,
    })
    const error = new Error('You already have a shift booked in this time window')
    error.status = 400
    throw error
  }

  logger.debug('Inserting shift booking', {
    tag: 'shift',
    partnerId,
    slot_label: payload.slot_label,
    shift_date: startsAt.toISOString().slice(0, 10),
  })

  let result
  try {
    result = await pool.query(
      `INSERT INTO delivery_shifts (
         delivery_partner_id,
         shift_date,
         slot_label,
         zone_name,
         starts_at,
         ends_at,
         demand_level,
         incentive_amount,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'booked')
       RETURNING *`,
      [
        partnerId,
        startsAt.toISOString().slice(0, 10),
        payload.slot_label,
        payload.zone_name || null,
        startsAt,
        endsAt,
        payload.demand_level || 'normal',
        Number(payload.incentive_amount || 0),
      ]
    )
  } catch (dbError) {
    logger.error('Shift booking DB insert failed', {
      tag: 'shift',
      partnerId,
      error: dbError.message,
      sqlParams: [partnerId, startsAt.toISOString().slice(0, 10), payload.slot_label],
    })
    const error = new Error('Unable to book shift right now. Please try again.')
    error.status = 500
    throw error
  }

  logger.info('Shift booked successfully', {
    tag: 'shift',
    partnerId,
    shiftId: result.rows[0].id,
    slotLabel: payload.slot_label,
  })

  return mapShift(result.rows[0])
}

module.exports = {
  bookShift,
  listShifts,
}
