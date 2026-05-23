const pool = require('../../../database/connection')
const env = require('../../../config/env')

const SUPPORT_PHONE = env.SUPPORT_PHONE
const SUPPORT_WHATSAPP = env.SUPPORT_WHATSAPP
const SUPPORT_EMAIL = env.SUPPORT_EMAIL

const getSupportInfo = async () => ({
  phone: SUPPORT_PHONE,
  whatsapp: SUPPORT_WHATSAPP,
  email: SUPPORT_EMAIL,
})

const notifyAdminCashPickupRequest = async (partnerId, requestId, amount) => {
  const partnerResult = await pool.query(
    `SELECT id, full_name, phone FROM delivery_partners WHERE id = $1`,
    [partnerId]
  )
  const partner = partnerResult.rows[0]

  const io = require('../../../realtime/socketServer').getIO()
  if (io) {
    io.to('admin:global').emit('cash_pickup_requested', {
      request_id: requestId,
      rider_id: partnerId,
      rider_name: partner?.full_name || 'Unknown',
      rider_phone: partner?.phone || '',
      amount,
      timestamp: new Date().toISOString(),
    })
  }

  // Also log to a notifications table for persistence
  try {
    await pool.query(
      `INSERT INTO admin_notifications (type, title, message, metadata)
       VALUES ($1, $2, $3, $4)`,
      [
        'cash_pickup',
        'Cash Pickup Requested',
        `${partner?.full_name || 'A rider'} requested cash pickup of Rs. ${amount}`,
        JSON.stringify({ partner_id: partnerId, request_id: requestId, amount }),
      ]
    )
  } catch {
    // notifications table might not exist, non-critical
  }
}

module.exports = {
  getSupportInfo,
  notifyAdminCashPickupRequest,
  SUPPORT_PHONE,
  SUPPORT_WHATSAPP,
  SUPPORT_EMAIL,
}
