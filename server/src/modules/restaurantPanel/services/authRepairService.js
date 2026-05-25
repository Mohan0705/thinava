const pool = require('../../../database/connection')
const { logger } = require('../../../lib/logger')
const {
  ensureSupabaseUserForRestaurantOwner,
  getRestaurantAuthEnvStatus,
} = require('./supabaseRestaurantAuthService')

const repairRestaurantAuthUsers = async () => {
  const status = getRestaurantAuthEnvStatus()
  if (!status.ready) {
    logger.error('Restaurant Supabase Auth repair skipped because required env is missing', {
      tag: 'restaurant_auth_repair',
      missing: status.missing,
    })
    return { repaired: 0, skipped: true, missing: status.missing }
  }

  const result = await pool.query(
    `SELECT ru.id, ru.supabase_user_id, ru.restaurant_id, ru.email, ru.full_name, ru.phone,
            r.name AS restaurant_name
     FROM restaurant_users ru
     JOIN restaurants r ON r.id = ru.restaurant_id
     WHERE ru.email IS NOT NULL
     ORDER BY ru.created_at ASC`
  )

  let repaired = 0
  let created = 0
  let confirmed = 0
  let failed = 0

  for (const owner of result.rows) {
    try {
      const ensured = await ensureSupabaseUserForRestaurantOwner(owner)

      if (ensured.userId && ensured.userId !== owner.supabase_user_id) {
        await pool.query(
          `UPDATE restaurant_users
           SET supabase_user_id = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [ensured.userId, owner.id]
        )
        repaired += 1
      }

      if (ensured.created) {
        created += 1
      }
      if (ensured.confirmed) {
        confirmed += 1
      }

      if (ensured.passwordResetRecommended) {
        logger.warn('Restaurant auth user recreated with secure temporary password; owner must use password reset', {
          tag: 'restaurant_auth_repair',
          ownerId: owner.id,
          restaurantId: owner.restaurant_id,
          email: owner.email,
          supabaseUserId: ensured.userId,
        })
      }
    } catch (error) {
      failed += 1
      logger.error('Restaurant auth repair failed for owner', {
        tag: 'restaurant_auth_repair',
        ownerId: owner.id,
        restaurantId: owner.restaurant_id,
        email: owner.email,
        error,
      })
    }
  }

  logger.info('Restaurant auth repair complete', {
    tag: 'restaurant_auth_repair',
    scanned: result.rows.length,
    repaired,
    created,
    confirmed,
    failed,
  })

  return { scanned: result.rows.length, repaired, created, confirmed, failed }
}

module.exports = {
  repairRestaurantAuthUsers,
}
