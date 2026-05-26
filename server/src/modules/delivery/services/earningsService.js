const pool = require('../../../database/connection')

const { computeRiderPayout } = require('./logisticsService')

const calculateEarnings = (distanceKm, durationMinutes, orderTotal) => {
  const pay = computeRiderPayout(distanceKm, { paymentMethod: 'cod' })

  return {
    base_fee: pay.basePay,
    distance_fee: pay.distancePay,
    time_bonus: 0,
    peak_incentive: pay.surgeBonus,
    rain_bonus: pay.rainBonus,
    night_bonus: pay.nightBonus,
    total: pay.total,
  }
}

const recordEarning = async (partnerId, orderId, distanceKm, durationMinutes, amount, incentive = 0, existingClient = null) => {
  const client = existingClient || await pool.connect()
  const ownsConnection = !existingClient

  try {
    if (ownsConnection) {
      await client.query('BEGIN')
    }

    const existingEarning = await client.query(
      `SELECT id, amount, incentive, earned_at
       FROM delivery_earnings
       WHERE order_id = $1::uuid
       FOR UPDATE`,
      [orderId]
    )

    if (existingEarning.rows.length > 0) {
      if (ownsConnection) {
        await client.query('COMMIT')
      }
      return existingEarning.rows[0]
    }

    const orderResult = await client.query(
      `SELECT
         payment_method,
         dropoff_distance_km,
         estimated_total_eta_minutes,
         base_delivery_pay,
         distance_delivery_pay,
         surge_bonus,
         rain_bonus,
         night_bonus,
         cod_handling_bonus,
         tip_amount,
         estimated_earning,
         total
       FROM orders
       WHERE id = $1::uuid`,
      [orderId]
    )

    if (orderResult.rows.length === 0) {
      const error = new Error('Order not found while recording earning')
      error.status = 404
      throw error
    }

    const order = orderResult.rows[0]
    const resolvedDistanceKm = Number(order.dropoff_distance_km || distanceKm || 0)
    const resolvedDurationMinutes = Number(order.estimated_total_eta_minutes || durationMinutes || 0)
    const resolvedAmount =
      Number(order.estimated_earning || 0) ||
      Number(order.base_delivery_pay || 0) +
        Number(order.distance_delivery_pay || 0) +
        Number(order.surge_bonus || 0) +
        Number(order.rain_bonus || 0) +
        Number(order.cod_handling_bonus || 0) +
        Number(order.tip_amount || 0)
    const resolvedIncentive =
      Number(order.surge_bonus || 0) +
      Number(order.rain_bonus || 0) +
      Number(order.cod_handling_bonus || 0) +
      Number(order.tip_amount || 0)

    const result = await client.query(
      `INSERT INTO delivery_earnings (delivery_partner_id, order_id, amount, incentive, distance_km, duration_minutes)
       VALUES ($1::uuid, $2::uuid, $3::numeric, $4::numeric, $5::numeric, $6::int)
       RETURNING id, amount, incentive, earned_at`,
      [partnerId, orderId, resolvedAmount, resolvedIncentive, resolvedDistanceKm, resolvedDurationMinutes]
    )

    await client.query(
      `UPDATE delivery_partners
       SET total_deliveries = total_deliveries + 1,
           cash_in_hand = cash_in_hand + CASE
             WHEN EXISTS (SELECT 1 FROM orders WHERE id = $2::uuid AND LOWER(payment_method) = 'cod') THEN COALESCE((SELECT total FROM orders WHERE id = $2::uuid), 0)
             ELSE 0
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [partnerId, orderId]
    )

    await client.query(
      `UPDATE delivery_wallets
       SET available_balance = available_balance + $2,
           cod_collected = cod_collected + CASE
             WHEN EXISTS (SELECT 1 FROM orders WHERE id = $3::uuid AND LOWER(payment_method) = 'cod') THEN COALESCE((SELECT total FROM orders WHERE id = $3::uuid), 0)
             ELSE 0
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE delivery_partner_id = $1::uuid`,
      [partnerId, resolvedAmount, orderId]
    )

    if (ownsConnection) {
      await client.query('COMMIT')
    }
    return result.rows[0]
  } catch (error) {
    if (ownsConnection) {
      await client.query('ROLLBACK')
    }
    throw error
  } finally {
    if (ownsConnection) {
      client.release()
    }
  }
}

const getTodayEarnings = async (partnerId) => {
  const result = await pool.query(
    `SELECT
       COUNT(*) as deliveries,
       SUM(amount) as total_amount,
       SUM(incentive) as total_incentive,
       AVG(distance_km) as avg_distance
     FROM delivery_earnings
     WHERE delivery_partner_id = $1
       AND DATE(earned_at) = CURRENT_DATE`,
    [partnerId]
  )

  const row = result.rows[0]

  return {
    deliveries: Number(row.deliveries || 0),
    total_amount: Number(row.total_amount || 0),
    total_incentive: Number(row.total_incentive || 0),
    avg_distance: Number(row.avg_distance || 0),
  }
}

const getWeekEarnings = async (partnerId) => {
  const result = await pool.query(
    `SELECT
       COUNT(*) as deliveries,
       SUM(amount) as total_amount,
       SUM(incentive) as total_incentive
     FROM delivery_earnings
     WHERE delivery_partner_id = $1
       AND earned_at >= NOW() - INTERVAL '7 days'`,
    [partnerId]
  )

  const row = result.rows[0]

  return {
    deliveries: Number(row.deliveries || 0),
    total_amount: Number(row.total_amount || 0),
    total_incentive: Number(row.total_incentive || 0),
  }
}

const getMonthEarnings = async (partnerId) => {
  const result = await pool.query(
    `SELECT
       COUNT(*) as deliveries,
       SUM(amount) as total_amount,
       SUM(incentive) as total_incentive
     FROM delivery_earnings
     WHERE delivery_partner_id = $1
       AND DATE_TRUNC('month', earned_at) = DATE_TRUNC('month', CURRENT_DATE)`,
    [partnerId]
  )

  const row = result.rows[0]

  return {
    deliveries: Number(row.deliveries || 0),
    total_amount: Number(row.total_amount || 0),
    total_incentive: Number(row.total_incentive || 0),
  }
}

const getEarningsHistory = async (partnerId, limit = 50) => {
  const result = await pool.query(
    `SELECT
       de.id,
       de.order_id,
       de.amount,
       de.incentive,
       de.distance_km,
       de.duration_minutes,
       de.earned_at,
       r.name as restaurant_name,
       u.name as customer_name
     FROM delivery_earnings de
     JOIN orders o ON de.order_id = o.id
     JOIN restaurants r ON o.restaurant_id = r.id
     JOIN users u ON o.user_id = u.id
     WHERE de.delivery_partner_id = $1
     ORDER BY de.earned_at DESC
     LIMIT $2`,
    [partnerId, limit]
  )

  return result.rows
}

module.exports = {
  calculateEarnings,
  recordEarning,
  getTodayEarnings,
  getWeekEarnings,
  getMonthEarnings,
  getEarningsHistory,
}
