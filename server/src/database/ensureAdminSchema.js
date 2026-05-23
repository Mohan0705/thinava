const pool = require('./connection')

const defaultSettings = [
  {
    key: 'delivery_radius_km',
    value: 6,
    description: 'Maximum delivery radius for customer orders.',
    category: 'operations',
  },
  {
    key: 'tax_configuration',
    value: { gst_percent: 5, packing_fee: 8 },
    description: 'Platform tax and fee configuration.',
    category: 'finance',
  },
  {
    key: 'surge_pricing',
    value: { enabled: true, peak_hours: ['12:00-14:30', '19:00-22:30'], multiplier: 1.18 },
    description: 'Peak-hour surge pricing rules.',
    category: 'operations',
  },
  {
    key: 'platform_fees',
    value: { base_fee: 18, service_fee: 6, restaurant_commission_default: 22 },
    description: 'Platform default fees and commissions.',
    category: 'finance',
  },
  {
    key: 'maintenance_mode',
    value: { enabled: false, message: 'Thinava is operating normally.' },
    description: 'Admin-controlled maintenance mode state.',
    category: 'platform',
  },
  {
    key: 'operational_timings',
    value: {
      support: '08:00-23:00',
      delivery: '07:00-23:30',
      restaurant_onboarding: '10:00-20:00',
    },
    description: 'Operational timings for core platform services.',
    category: 'operations',
  },
]

const seedCoupons = [
  {
    code: 'TADEPAL40',
    title: 'Tadepalligudem Treat',
    description: 'Flat Rs. 40 off on evening orders above Rs. 249.',
    discount_type: 'flat',
    discount_value: 40,
    minimum_order_amount: 249,
    max_discount_amount: 40,
  },
  {
    code: 'BIRYANI15',
    title: 'Biryani Rush',
    description: '15 percent off on biryani orders above Rs. 399.',
    discount_type: 'percentage',
    discount_value: 15,
    minimum_order_amount: 399,
    max_discount_amount: 120,
  },
  {
    code: 'WELCOME75',
    title: 'New User Welcome',
    description: 'Flat Rs. 75 off for first orders above Rs. 299.',
    discount_type: 'flat',
    discount_value: 75,
    minimum_order_amount: 299,
    max_discount_amount: 75,
  },
]

const ensureAdminSchema = async () => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

     await client.query(`
       CREATE TABLE IF NOT EXISTS admin_users (
         id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
         email VARCHAR(255) UNIQUE NOT NULL,
         password_hash TEXT NOT NULL,
         full_name VARCHAR(255) NOT NULL,
         role VARCHAR(80) NOT NULL,
         permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
         is_active BOOLEAN DEFAULT TRUE,
         last_login_at TIMESTAMP,
         failed_login_attempts INTEGER DEFAULT 0,
         lockout_until TIMESTAMP,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS lockout_until TIMESTAMP;
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_activity_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
        action VARCHAR(120) NOT NULL,
        entity_type VARCHAR(80) NOT NULL,
        entity_id UUID,
        description TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        ip_address VARCHAR(80),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
        order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
        assigned_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
        category VARCHAR(80) NOT NULL DEFAULT 'general',
        subject VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'open',
        priority VARCHAR(40) NOT NULL DEFAULT 'medium',
        resolution_notes TEXT,
        refund_amount DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS coupon_codes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code VARCHAR(80) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        discount_type VARCHAR(40) NOT NULL DEFAULT 'flat',
        discount_value DECIMAL(10, 2) NOT NULL,
        minimum_order_amount DECIMAL(10, 2) DEFAULT 0,
        max_discount_amount DECIMAL(10, 2) DEFAULT 0,
        usage_limit INTEGER DEFAULT 0,
        used_count INTEGER DEFAULT 0,
        starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ends_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        target_audience VARCHAR(80) DEFAULT 'all',
        featured_restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
        banner_image TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        setting_key VARCHAR(120) UNIQUE NOT NULL,
        setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
        description TEXT,
        category VARCHAR(80) NOT NULL DEFAULT 'general',
        updated_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS payout_transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        entity_type VARCHAR(40) NOT NULL,
        entity_id UUID,
        order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
        amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        commission_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        settlement_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        status VARCHAR(40) NOT NULL DEFAULT 'pending',
        payout_reference VARCHAR(120),
        due_date TIMESTAMP,
        settled_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS fraud_score INTEGER DEFAULT 0;
    `)

    await client.query(`
      ALTER TABLE addresses
      ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
    `)

    await client.query(`
      ALTER TABLE restaurants
      ADD COLUMN IF NOT EXISTS approval_status VARCHAR(40) DEFAULT 'approved',
      ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5, 2) DEFAULT 22,
      ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS complaints_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
      ADD COLUMN IF NOT EXISTS zone_name VARCHAR(120) DEFAULT 'Tadepalligudem Central';
    `)

    await client.query(`
      ALTER TABLE delivery_partners
      ADD COLUMN IF NOT EXISTS status VARCHAR(40) DEFAULT 'ACTIVE',
      ADD COLUMN IF NOT EXISTS approval_status VARCHAR(40) DEFAULT 'approved',
      ADD COLUMN IF NOT EXISTS document_status VARCHAR(40) DEFAULT 'verified',
      ADD COLUMN IF NOT EXISTS vehicle_verification_status VARCHAR(40) DEFAULT 'verified',
      ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS force_offline BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS earnings_balance DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS home_zone VARCHAR(120) DEFAULT 'Tadepalligudem';
    `)

    await client.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS admin_flagged BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
      ADD COLUMN IF NOT EXISTS platform_commission_amount DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS payout_status VARCHAR(40) DEFAULT 'pending';
    `)

    await client.query(`
      UPDATE orders
      SET platform_commission_amount = ROUND((COALESCE(total, 0) * 0.22)::numeric, 2)
      WHERE COALESCE(platform_commission_amount, 0) = 0;
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
      CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_admin_user_id ON admin_activity_logs(admin_user_id);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_customer_id ON support_tickets(customer_id);
      CREATE INDEX IF NOT EXISTS idx_coupon_codes_code ON coupon_codes(code);
      CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(setting_key);
      CREATE INDEX IF NOT EXISTS idx_payout_transactions_status ON payout_transactions(status);
      CREATE INDEX IF NOT EXISTS idx_orders_payout_status ON orders(payout_status);
    `)

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  for (const setting of defaultSettings) {
    await pool.query(
      `INSERT INTO platform_settings (setting_key, setting_value, description, category)
       VALUES ($1, $2::jsonb, $3, $4)
       ON CONFLICT (setting_key)
       DO UPDATE SET
         setting_value = EXCLUDED.setting_value,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         updated_at = CURRENT_TIMESTAMP`,
      [setting.key, JSON.stringify(setting.value), setting.description, setting.category]
    )
  }

  for (const coupon of seedCoupons) {
    await pool.query(
      `INSERT INTO coupon_codes (
         code, title, description, discount_type, discount_value, minimum_order_amount, max_discount_amount,
         usage_limit, used_count, ends_at, is_active, target_audience
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 200, 0, CURRENT_TIMESTAMP + INTERVAL '45 days', TRUE, 'all')
       ON CONFLICT (code) DO NOTHING`,
      [
        coupon.code,
        coupon.title,
        coupon.description,
        coupon.discount_type,
        coupon.discount_value,
        coupon.minimum_order_amount,
        coupon.max_discount_amount,
      ]
    )
  }

  const supportCount = await pool.query('SELECT COUNT(*)::int AS count FROM support_tickets')

  if (supportCount.rows[0].count === 0) {
    await pool.query(`
      INSERT INTO support_tickets (customer_id, order_id, category, subject, description, status, priority, refund_amount)
      SELECT
        o.user_id,
        o.id,
        CASE row_number() OVER (ORDER BY o.created_at DESC)
          WHEN 1 THEN 'delivery_delay'
          WHEN 2 THEN 'refund_request'
          ELSE 'food_quality'
        END,
        CASE row_number() OVER (ORDER BY o.created_at DESC)
          WHEN 1 THEN 'Late delivery reported near RTC Complex'
          WHEN 2 THEN 'Customer requested refund for missing item'
          ELSE 'Taste complaint from evening order'
        END,
        CASE row_number() OVER (ORDER BY o.created_at DESC)
          WHEN 1 THEN 'Customer says the rider route was stalled near Pentapadu Road.'
          WHEN 2 THEN 'One biryani item was not delivered as billed.'
          ELSE 'Complaint logged about packaging and freshness.'
        END,
        CASE row_number() OVER (ORDER BY o.created_at DESC)
          WHEN 1 THEN 'open'
          WHEN 2 THEN 'investigating'
          ELSE 'resolved'
        END,
        CASE row_number() OVER (ORDER BY o.created_at DESC)
          WHEN 1 THEN 'high'
          WHEN 2 THEN 'medium'
          ELSE 'low'
        END,
        CASE row_number() OVER (ORDER BY o.created_at DESC)
          WHEN 2 THEN 120
          ELSE 0
        END
      FROM orders o
      ORDER BY o.created_at DESC
      LIMIT 3
    `)
  }

  const payoutCount = await pool.query('SELECT COUNT(*)::int AS count FROM payout_transactions')

  if (payoutCount.rows[0].count === 0) {
    await pool.query(`
      INSERT INTO payout_transactions (
        entity_type, entity_id, order_id, amount, commission_amount, settlement_amount, status, due_date, notes
      )
      SELECT
        'restaurant',
        o.restaurant_id,
        o.id,
        COALESCE(o.total, 0),
        COALESCE(o.platform_commission_amount, ROUND((COALESCE(o.total, 0) * 0.22)::numeric, 2)),
        GREATEST(COALESCE(o.total, 0) - COALESCE(o.platform_commission_amount, ROUND((COALESCE(o.total, 0) * 0.22)::numeric, 2)), 0),
        CASE
          WHEN row_number() OVER (ORDER BY o.created_at DESC) = 1 THEN 'pending'
          WHEN row_number() OVER (ORDER BY o.created_at DESC) = 2 THEN 'processing'
          ELSE 'settled'
        END,
        o.created_at + INTERVAL '2 days',
        'Auto-seeded settlement record for admin finance dashboard.'
      FROM orders o
      ORDER BY o.created_at DESC
      LIMIT 6
    `)
  }
}

module.exports = {
  ensureAdminSchema,
}
