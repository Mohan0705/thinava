const pool = require('./connection')
const { RESTAURANT_STATUSES } = require('../modules/restaurantPanel/constants')

const ensureRestaurantPanelSchema = async () => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS addresses (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label VARCHAR(100) NOT NULL,
        full_address TEXT NOT NULL,
        landmark VARCHAR(255),
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        image TEXT NOT NULL,
        logo TEXT NOT NULL,
        rating DECIMAL(3, 1) DEFAULT 0,
        delivery_time VARCHAR(50) NOT NULL,
        price_for_one DECIMAL(10, 2) NOT NULL,
        cuisines TEXT[] NOT NULL,
        offer VARCHAR(100),
        featured BOOLEAN DEFAULT FALSE,
        is_open BOOLEAN DEFAULT TRUE,
        opening_time VARCHAR(20),
        closing_time VARCHAR(20),
        timezone VARCHAR(64) DEFAULT 'Asia/Kolkata',
        is_manually_closed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        image TEXT NOT NULL,
        category VARCHAR(100) NOT NULL,
        is_veg BOOLEAN DEFAULT TRUE,
        is_bestseller BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        restaurant_id UUID NOT NULL REFERENCES restaurants(id),
        address_id UUID NOT NULL REFERENCES addresses(id),
        subtotal DECIMAL(10, 2) NOT NULL,
        delivery_fee DECIMAL(10, 2) NOT NULL,
        tax DECIMAL(10, 2) NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'placed',
        payment_method VARCHAR(50) NOT NULL,
        estimated_delivery VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        menu_item_id UUID NOT NULL REFERENCES menu_items(id),
        quantity INTEGER NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        notes TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS restaurant_users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        supabase_user_id UUID UNIQUE,
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        reset_token TEXT,
        reset_token_expiry TIMESTAMP,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'restaurant_owner',
        is_active BOOLEAN DEFAULT TRUE,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS restaurant_categories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT restaurant_categories_restaurant_name_unique UNIQUE (restaurant_id, name)
      );
    `)

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `)

    await client.query(`
      ALTER TABLE restaurants
      ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS offer VARCHAR(100),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS banner_image TEXT,
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS opening_time VARCHAR(20),
      ADD COLUMN IF NOT EXISTS closing_time VARCHAR(20),
      ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) DEFAULT 'Asia/Kolkata',
      ADD COLUMN IF NOT EXISTS is_manually_closed BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS minimum_order DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS delivery_radius_km INTEGER DEFAULT 5,
      ADD COLUMN IF NOT EXISTS status VARCHAR(40) DEFAULT 'OPEN';
    `)

    await client.query(`
      ALTER TABLE menu_items
      ADD COLUMN IF NOT EXISTS category VARCHAR(100) NOT NULL DEFAULT 'Uncategorized',
      ADD COLUMN IF NOT EXISTS in_stock BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES restaurant_categories(id) ON DELETE SET NULL;
    `)

    await client.query(`
      ALTER TABLE menu_items
      ALTER COLUMN category SET DEFAULT 'Uncategorized';
    `)

    await client.query(`
      ALTER TABLE restaurant_users
      ADD COLUMN IF NOT EXISTS supabase_user_id UUID UNIQUE,
      ADD COLUMN IF NOT EXISTS reset_token TEXT,
      ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP,
      ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'restaurant_owner',
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `)

    await client.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id),
      ADD COLUMN IF NOT EXISTS address_id UUID REFERENCES addresses(id),
      ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tax DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'placed',
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cod',
      ADD COLUMN IF NOT EXISTS estimated_delivery VARCHAR(50),
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `)

    await client.query(`
      ALTER TABLE restaurant_categories
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `)

    await client.query(`
      UPDATE restaurants
      SET status = CASE
        WHEN is_open = TRUE THEN '${RESTAURANT_STATUSES.OPEN}'
        ELSE '${RESTAURANT_STATUSES.CLOSED}'
      END
      WHERE status IS NULL;
    `)

    await client.query(`
      UPDATE restaurants
      SET timezone = 'Asia/Kolkata'
      WHERE timezone IS NULL OR TRIM(timezone) = '';
    `)

    await client.query(`
      UPDATE restaurants
      SET is_manually_closed = TRUE
      WHERE UPPER(COALESCE(status, '')) IN ('${RESTAURANT_STATUSES.CLOSED}', '${RESTAURANT_STATUSES.TEMPORARILY_UNAVAILABLE}')
        AND COALESCE(is_manually_closed, FALSE) = FALSE;
    `)

    await client.query(`
      UPDATE menu_items
      SET in_stock = TRUE
      WHERE in_stock IS NULL;
    `)

    await client.query(`
      UPDATE menu_items
      SET category = 'Uncategorized'
      WHERE category IS NULL OR TRIM(category) = '';
    `)

    await client.query(`
      INSERT INTO restaurant_categories (restaurant_id, name, description, display_order)
      SELECT
        distinct_categories.restaurant_id,
        distinct_categories.category,
        NULL,
        ROW_NUMBER() OVER (
          PARTITION BY distinct_categories.restaurant_id
          ORDER BY distinct_categories.category
        ) - 1
      FROM (
        SELECT DISTINCT restaurant_id, category
        FROM menu_items
        WHERE category IS NOT NULL AND TRIM(category) != ''
      ) distinct_categories
      WHERE NOT EXISTS (
        SELECT 1
        FROM restaurant_categories rc
        WHERE rc.restaurant_id = distinct_categories.restaurant_id
          AND rc.name = distinct_categories.category
      );
    `)

    await client.query(`
      UPDATE menu_items mi
      SET category_id = rc.id
      FROM restaurant_categories rc
      WHERE mi.restaurant_id = rc.restaurant_id
        AND mi.category = rc.name
        AND mi.category_id IS NULL;
    `)

    const duplicateOwnerResult = await client.query(`
      SELECT restaurant_id, COUNT(*)::int AS owner_count
      FROM restaurant_users
      GROUP BY restaurant_id
      HAVING COUNT(*) > 1;
    `)

    if (duplicateOwnerResult.rows.length > 0) {
      console.warn('Multiple restaurant owner records found; leaving credentials unchanged for manual review.', {
        count: duplicateOwnerResult.rows.length,
      })
    }

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
      CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
      CREATE INDEX IF NOT EXISTS idx_restaurants_featured ON restaurants(featured);
      CREATE INDEX IF NOT EXISTS idx_restaurants_manual_closed ON restaurants(is_manually_closed);
      CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_restaurant_users_restaurant_id ON restaurant_users(restaurant_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_users_supabase_user_id
      ON restaurant_users(supabase_user_id)
      WHERE supabase_user_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_restaurant_users_reset_token
      ON restaurant_users(reset_token)
      WHERE reset_token IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_restaurant_categories_restaurant_id ON restaurant_categories(restaurant_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_categories_restaurant_name_unique
      ON restaurant_categories(restaurant_id, name);
      CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
      CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
    `)

    // Delivery Partner Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_partners (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        full_name VARCHAR(255) NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        password_hash TEXT NOT NULL,
        profile_image TEXT,
        vehicle_type VARCHAR(50),
        vehicle_number VARCHAR(50),
        driving_license VARCHAR(100),
        is_online BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        rating DECIMAL(3, 2) DEFAULT 0,
        total_deliveries INTEGER DEFAULT 0,
        current_status VARCHAR(50) DEFAULT 'AVAILABLE',
        current_order_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_assignments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        delivery_partner_id UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE RESTRICT,
        assignment_status VARCHAR(50) DEFAULT 'ASSIGNED',
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        picked_up_at TIMESTAMP,
        delivered_at TIMESTAMP,
        earnings DECIMAL(10, 2) DEFAULT 0,
        distance_km DECIMAL(10, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_locations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        delivery_partner_id UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
        order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        accuracy DECIMAL(10, 2),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_status_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        delivery_partner_id UUID REFERENCES delivery_partners(id) ON DELETE SET NULL,
        status VARCHAR(50) NOT NULL,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_earnings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        delivery_partner_id UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        incentive DECIMAL(10, 2) DEFAULT 0,
        distance_km DECIMAL(10, 2),
        duration_minutes INTEGER,
        earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS delivery_partner_id UUID REFERENCES delivery_partners(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(50) DEFAULT 'PENDING',
      ADD COLUMN IF NOT EXISTS delivery_assigned_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_delivery_partners_phone ON delivery_partners(phone);
      CREATE INDEX IF NOT EXISTS idx_delivery_partners_is_online ON delivery_partners(is_online);
      CREATE INDEX IF NOT EXISTS idx_delivery_partners_status ON delivery_partners(current_status);
      CREATE INDEX IF NOT EXISTS idx_delivery_assignments_order_id ON delivery_assignments(order_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_assignments_partner_id ON delivery_assignments(delivery_partner_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_assignments_status ON delivery_assignments(assignment_status);
      CREATE INDEX IF NOT EXISTS idx_delivery_locations_partner_id ON delivery_locations(delivery_partner_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_locations_timestamp ON delivery_locations(timestamp);
      CREATE INDEX IF NOT EXISTS idx_delivery_status_logs_order_id ON delivery_status_logs(order_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_status_logs_partner_id ON delivery_status_logs(delivery_partner_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_earnings_partner_id ON delivery_earnings(delivery_partner_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_earnings_date ON delivery_earnings(earned_at);
      CREATE INDEX IF NOT EXISTS idx_orders_delivery_partner_id ON orders(delivery_partner_id);
      CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON orders(delivery_status);
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
  ensureRestaurantPanelSchema,
}
