const pool = require('../../../database/connection')

const toNumber = (value) => Number(value || 0)

const getWallet = async (partnerId) => {
  const result = await pool.query(
    `SELECT
       id, delivery_partner_id, floating_cash, floating_cash_limit,
       pending_settlement, last_settlement_at, created_at, updated_at
     FROM rider_wallets
     WHERE delivery_partner_id = $1`,
    [partnerId]
  )

  if (result.rows.length === 0) {
    const insert = await pool.query(
      `INSERT INTO rider_wallets (delivery_partner_id, floating_cash, floating_cash_limit)
       VALUES ($1, 0, 1500)
       RETURNING id, delivery_partner_id, floating_cash, floating_cash_limit,
                 pending_settlement, last_settlement_at, created_at, updated_at`,
      [partnerId]
    )
    return insert.rows[0]
  }

  return result.rows[0]
}

const getFloatingCashStatus = async (partnerId) => {
  const wallet = await getWallet(partnerId)
  const limit = toNumber(wallet.floating_cash_limit)
  const cash = toNumber(wallet.floating_cash)
  const percent = limit > 0 ? Math.round((cash / limit) * 100) : 0

  return {
    floating_cash: cash,
    floating_cash_limit: limit,
    percent_used: percent,
    is_warning: percent >= 80,
    is_critical: percent >= 100,
  }
}

const addCODToFloatingCash = async (partnerId, orderId, amount, existingClient = null) => {
  const client = existingClient || await pool.connect()
  const ownsConnection = !existingClient

  try {
    if (ownsConnection) await client.query('BEGIN')

    await client.query(
      `UPDATE rider_wallets
       SET floating_cash = floating_cash + $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE delivery_partner_id = $1`,
      [partnerId, amount]
    )

    if (ownsConnection) await client.query('COMMIT')
    return { success: true }
  } catch (error) {
    if (ownsConnection) await client.query('ROLLBACK')
    throw error
  } finally {
    if (ownsConnection) client.release()
  }
}

const canAcceptCOD = async (partnerId) => {
  const status = await getFloatingCashStatus(partnerId)
  return !status.is_critical
}

const requestCashPickup = async (partnerId, notes = '') => {
  const wallet = await getWallet(partnerId)
  const amount = toNumber(wallet.floating_cash)

  if (amount <= 0) {
    const error = new Error('No floating cash to pick up')
    error.status = 400
    throw error
  }

  const result = await pool.query(
    `INSERT INTO cash_pickup_requests (delivery_partner_id, amount, notes)
     VALUES ($1, $2, $3)
     RETURNING id, amount, status, created_at`,
    [partnerId, amount, notes]
  )

  // Update pending settlement
  await pool.query(
    `UPDATE rider_wallets
     SET pending_settlement = pending_settlement + $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE delivery_partner_id = $1`,
    [partnerId, amount]
  )

  return result.rows[0]
}

const getCashPickupRequests = async (partnerId) => {
  const result = await pool.query(
    `SELECT id, amount, status, notes, admin_notes, created_at, resolved_at
     FROM cash_pickup_requests
     WHERE delivery_partner_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [partnerId]
  )
  return result.rows
}

const settleFloatingCash = async (partnerId, amount, adminId) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(
      `UPDATE rider_wallets
       SET floating_cash = GREATEST(0, floating_cash - $2),
           pending_settlement = GREATEST(0, pending_settlement - $2),
           last_settlement_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE delivery_partner_id = $1`,
      [partnerId, amount]
    )

    await client.query(
      `UPDATE cash_pickup_requests
       SET status = 'collected',
           admin_notes = COALESCE(admin_notes, '') || ' Settled by admin.',
           resolved_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE delivery_partner_id = $1 AND status = 'pending'`,
      [partnerId]
    )

    await client.query('COMMIT')
    return { success: true }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = {
  getWallet,
  getFloatingCashStatus,
  addCODToFloatingCash,
  canAcceptCOD,
  requestCashPickup,
  getCashPickupRequests,
  settleFloatingCash,
}
