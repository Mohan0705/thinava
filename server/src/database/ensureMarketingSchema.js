const pool = require('./connection')

const ensureMarketingSchema = async () => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    await client.query(`
      CREATE TABLE IF NOT EXISTS marketing_banners (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(160) NOT NULL,
        subtitle TEXT,
        image_url TEXT NOT NULL,
        cloudinary_public_id TEXT,
        redirect_type VARCHAR(40) NOT NULL DEFAULT 'restaurants',
        redirect_target TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        priority INTEGER NOT NULL DEFAULT 0,
        starts_at TIMESTAMP,
        ends_at TIMESTAMP,
        created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT marketing_banners_redirect_type_check CHECK (
          redirect_type IN ('restaurants', 'restaurant', 'category', 'offers', 'custom')
        )
      );
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_marketing_banners_active_priority
      ON marketing_banners (is_active, priority DESC, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_marketing_banners_schedule
      ON marketing_banners (starts_at, ends_at);
    `)

    await client.query('COMMIT')
    console.log('Marketing database schema initialized successfully')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Failed to initialize marketing database schema:', error)
    throw error
  } finally {
    client.release()
  }
}

module.exports = {
  ensureMarketingSchema,
}
