const pool = require('./connection')

const ensureRiderWalletSchema = async () => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Add average_rating to delivery_partners if not present
    await client.query(`
      ALTER TABLE delivery_partners
      ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3, 1) DEFAULT 0;
    `)

    // Rider wallets table - tracks floating cash
    await client.query(`
      CREATE TABLE IF NOT EXISTS rider_wallets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        delivery_partner_id UUID NOT NULL UNIQUE REFERENCES delivery_partners(id) ON DELETE CASCADE,
        floating_cash DECIMAL(10, 2) NOT NULL DEFAULT 0,
        floating_cash_limit DECIMAL(10, 2) NOT NULL DEFAULT 1500,
        pending_settlement DECIMAL(10, 2) NOT NULL DEFAULT 0,
        last_settlement_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Insert wallet for existing riders that don't have one
    await client.query(`
      INSERT INTO rider_wallets (delivery_partner_id, floating_cash, floating_cash_limit)
      SELECT dp.id, COALESCE(dp.cash_in_hand, 0), 1500
      FROM delivery_partners dp
      WHERE NOT EXISTS (
        SELECT 1 FROM rider_wallets rw WHERE rw.delivery_partner_id = dp.id
      );
    `)

    // Cash pickup requests
    await client.query(`
      CREATE TABLE IF NOT EXISTS cash_pickup_requests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        delivery_partner_id UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(40) DEFAULT 'pending',
        notes TEXT,
        admin_notes TEXT,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Rider online sessions for accurate tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS rider_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        delivery_partner_id UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
        online_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        offline_at TIMESTAMP,
        duration_seconds INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Rider zones
    await client.query(`
      CREATE TABLE IF NOT EXISTS rider_zones (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        delivery_partner_id UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
        zone_name VARCHAR(120) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Zone definitions with polygon coordinates
    await client.query(`
      CREATE TABLE IF NOT EXISTS zone_definitions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(120) NOT NULL UNIQUE,
        description TEXT,
        polygon_coordinates JSONB NOT NULL DEFAULT '[]'::jsonb,
        center_latitude DECIMAL(10, 8),
        center_longitude DECIMAL(11, 8),
        radius_meters DECIMAL(10, 2) DEFAULT 2000,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Insert default zones
    await client.query(`
      INSERT INTO zone_definitions (name, description, center_latitude, center_longitude, radius_meters)
      VALUES
        ('RTC Complex', 'Tadepalligudem RTC Complex area', 16.8138, 81.5245, 1500),
        ('Railway Colony', 'Tadepalligudem Railway Colony area', 16.8172, 81.5310, 1200),
        ('Housing Board', 'Tadepalligudem Housing Board area', 16.8105, 81.5190, 1000)
      ON CONFLICT (name) DO NOTHING;
    `)

    // Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rider_wallets_partner_id ON rider_wallets(delivery_partner_id);
      CREATE INDEX IF NOT EXISTS idx_cash_pickup_requests_partner_id ON cash_pickup_requests(delivery_partner_id);
      CREATE INDEX IF NOT EXISTS idx_cash_pickup_requests_status ON cash_pickup_requests(status);
      CREATE INDEX IF NOT EXISTS idx_rider_sessions_partner_id ON rider_sessions(delivery_partner_id);
      CREATE INDEX IF NOT EXISTS idx_rider_zones_partner_id ON rider_zones(delivery_partner_id);
    `)

    await client.query('COMMIT')
    console.log('✅ Rider wallet, session, zone schema applied')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = { ensureRiderWalletSchema }
