require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') })
const pool = require('./connection')
const fs = require('fs')
const path = require('path')

async function runPasswordResetMigration() {
  const client = await pool.connect()
  try {
    console.log('🔄 Running password reset schema migration...\n')

    // Create password reset tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS restaurant_password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        restaurant_user_id UUID NOT NULL REFERENCES restaurant_users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    console.log('✅ Created restaurant_password_reset_tokens table')

    // Create indexes for efficient lookup
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_restaurant_password_reset_tokens_user_id 
        ON restaurant_password_reset_tokens(restaurant_user_id);
    `)
    console.log('✅ Created index on restaurant_user_id')

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_restaurant_password_reset_tokens_expires_at 
        ON restaurant_password_reset_tokens(expires_at);
    `)
    console.log('✅ Created index on expires_at')

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_restaurant_password_reset_tokens_used_at 
        ON restaurant_password_reset_tokens(used_at) 
        WHERE used_at IS NULL;
    `)
    console.log('✅ Created index on unused tokens')

    console.log('\n✅ Password reset migration completed successfully!')
    console.log('\n📝 Password reset features ready:')
    console.log('   - POST /api/restaurant-auth/password-reset/request')
    console.log('   - GET /api/restaurant-auth/password-reset/verify/:token')
    console.log('   - POST /api/restaurant-auth/password-reset/confirm')
    console.log('   - Reset password page: /reset-password?token=...')

  } catch (error) {
    console.error('❌ Migration error:', error.message)
    throw error
  } finally {
    client.release()
  }
}

// Run if called directly
if (require.main === module) {
  runPasswordResetMigration()
    .then(() => {
      console.log('\n✨ Done!')
      process.exit(0)
    })
    .catch(error => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

module.exports = { runPasswordResetMigration }
