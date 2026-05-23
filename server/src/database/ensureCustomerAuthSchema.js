const pool = require('./connection')

const ensureCustomerAuthSchema = async () => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS profile_image TEXT,
      ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
    `)

    await client.query(`
      UPDATE users
      SET full_name = COALESCE(NULLIF(full_name, ''), name),
          name = COALESCE(NULLIF(name, ''), full_name)
      WHERE full_name IS NULL OR name IS NULL;
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_otp_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        phone VARCHAR(20) NOT NULL,
        country_code VARCHAR(10) NOT NULL DEFAULT '+91',
        otp_code VARCHAR(10) NOT NULL,
        full_name VARCHAR(255),
        email VARCHAR(255),
        purpose VARCHAR(40) NOT NULL DEFAULT 'login',
        expires_at TIMESTAMP NOT NULL,
        resend_available_at TIMESTAMP NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        is_consumed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      ALTER TABLE customer_otp_sessions
      ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC',
      ALTER COLUMN resend_available_at TYPE TIMESTAMPTZ USING resend_available_at AT TIME ZONE 'UTC',
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_addresses (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label VARCHAR(100) NOT NULL,
        address TEXT NOT NULL,
        landmark VARCHAR(255),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        is_default BOOLEAN DEFAULT FALSE,
        legacy_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_customer_otp_sessions_phone
      ON customer_otp_sessions(phone, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id
      ON user_addresses(user_id);
    `)

    await client.query(`
      INSERT INTO user_addresses (user_id, label, address, landmark, latitude, longitude, is_default, legacy_address_id, created_at, updated_at)
      SELECT
        a.user_id,
        a.label,
        a.full_address,
        a.landmark,
        a.latitude,
        a.longitude,
        a.is_default,
        a.id,
        a.created_at,
        a.updated_at
      FROM addresses a
      WHERE NOT EXISTS (
        SELECT 1
        FROM user_addresses ua
        WHERE ua.legacy_address_id = a.id
      );
    `)

    await client.query(`
      WITH ranked_addresses AS (
        SELECT id,
               user_id,
               ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY is_default DESC, created_at ASC) AS ranking
        FROM user_addresses
      )
      UPDATE user_addresses ua
      SET is_default = ranked_addresses.ranking = 1
      FROM ranked_addresses
      WHERE ranked_addresses.id = ua.id;
    `)

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = {
  ensureCustomerAuthSchema,
}
