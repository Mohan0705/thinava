const pool = require('./connection')

const ensureDeliveryLogisticsSchema = async () => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    await client.query(`
      ALTER TABLE restaurants
      ADD COLUMN IF NOT EXISTS formatted_address TEXT,
      ADD COLUMN IF NOT EXISTS place_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
    `)

    await client.query(`
      ALTER TABLE delivery_partners
      ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(80),
      ADD COLUMN IF NOT EXISTS bank_ifsc_code VARCHAR(32),
      ADD COLUMN IF NOT EXISTS upi_id VARCHAR(120),
      ADD COLUMN IF NOT EXISTS cash_in_hand DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS acceptance_rate DECIMAL(5, 2) DEFAULT 100,
      ADD COLUMN IF NOT EXISTS cancellation_rate DECIMAL(5, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS online_minutes_today INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_latitude DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS last_longitude DECIMAL(11, 8),
      ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMP;
    `)

    await client.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS route_distance_km DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS pickup_distance_km DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS dropoff_distance_km DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS estimated_pickup_eta_minutes INTEGER,
      ADD COLUMN IF NOT EXISTS estimated_dropoff_eta_minutes INTEGER,
      ADD COLUMN IF NOT EXISTS estimated_total_eta_minutes INTEGER,
      ADD COLUMN IF NOT EXISTS base_delivery_pay DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS distance_delivery_pay DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS surge_bonus DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rain_bonus DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS night_bonus DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS cod_handling_bonus DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS estimated_earning DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10, 2) DEFAULT 0;
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_wallets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        delivery_partner_id UUID NOT NULL UNIQUE REFERENCES delivery_partners(id) ON DELETE CASCADE,
        available_balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
        pending_balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
        cod_collected DECIMAL(10, 2) NOT NULL DEFAULT 0,
        total_withdrawn DECIMAL(10, 2) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_payouts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        delivery_partner_id UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        payout_method VARCHAR(60) DEFAULT 'bank_transfer',
        status VARCHAR(40) DEFAULT 'requested',
        reference_code VARCHAR(120),
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_shifts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        delivery_partner_id UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
        shift_date DATE NOT NULL,
        slot_label VARCHAR(80) NOT NULL,
        zone_name VARCHAR(120),
        starts_at TIMESTAMP NOT NULL,
        ends_at TIMESTAMP NOT NULL,
        demand_level VARCHAR(40) DEFAULT 'normal',
        incentive_amount DECIMAL(10, 2) DEFAULT 0,
        status VARCHAR(40) DEFAULT 'booked',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      ALTER TABLE delivery_shifts
      ADD COLUMN IF NOT EXISTS zone_name VARCHAR(120);
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_incentive_rules (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        rule_type VARCHAR(60) NOT NULL,
        target_orders INTEGER DEFAULT 0,
        bonus_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        starts_at TIMESTAMP,
        ends_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_incentives (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        delivery_partner_id UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
        rule_id UUID REFERENCES delivery_incentive_rules(id) ON DELETE SET NULL,
        order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        incentive_type VARCHAR(60) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        status VARCHAR(40) DEFAULT 'earned',
        awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS active_deliveries (
        order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
        delivery_partner_id UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'ASSIGNED',
        restaurant_latitude DECIMAL(10, 8),
        restaurant_longitude DECIMAL(11, 8),
        customer_latitude DECIMAL(10, 8),
        customer_longitude DECIMAL(11, 8),
        route_distance_km DECIMAL(10, 2),
        pickup_distance_km DECIMAL(10, 2),
        dropoff_distance_km DECIMAL(10, 2),
        pickup_eta_minutes INTEGER,
        dropoff_eta_minutes INTEGER,
        total_eta_minutes INTEGER,
        earnings_total DECIMAL(10, 2) DEFAULT 0,
        surge_bonus DECIMAL(10, 2) DEFAULT 0,
        rain_bonus DECIMAL(10, 2) DEFAULT 0,
        night_bonus DECIMAL(10, 2) DEFAULT 0,
        gps_validation_status JSONB DEFAULT '{}'::jsonb,
        accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        picked_up_at TIMESTAMP,
        delivered_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      ALTER TABLE active_deliveries
      ADD COLUMN IF NOT EXISTS gps_validation_status JSONB DEFAULT '{}'::jsonb;
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_tracking (
        order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
        delivery_partner_id UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
        current_latitude DECIMAL(10, 8),
        current_longitude DECIMAL(11, 8),
        current_accuracy DECIMAL(10, 2),
        current_eta_minutes INTEGER,
        last_status VARCHAR(50) DEFAULT 'ASSIGNED',
        last_location_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      INSERT INTO delivery_wallets (delivery_partner_id)
      SELECT dp.id
      FROM delivery_partners dp
      WHERE NOT EXISTS (
        SELECT 1
        FROM delivery_wallets dw
        WHERE dw.delivery_partner_id = dp.id
      );
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_delivery_payouts_partner_id ON delivery_payouts(delivery_partner_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_shifts_partner_date ON delivery_shifts(delivery_partner_id, shift_date);
      CREATE INDEX IF NOT EXISTS idx_delivery_incentives_partner_id ON delivery_incentives(delivery_partner_id);
      CREATE INDEX IF NOT EXISTS idx_active_deliveries_partner_id ON active_deliveries(delivery_partner_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_tracking_partner_id ON delivery_tracking(delivery_partner_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_earnings_order_unique ON delivery_earnings(order_id);
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
  ensureDeliveryLogisticsSchema,
}
