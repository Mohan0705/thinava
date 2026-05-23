const pool = require('./connection')

const ensureFeaturesSchema = async () => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Create coupons table
    await client.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT NOT NULL,
        discount_type VARCHAR(20) NOT NULL, -- PERCENTAGE, FLAT
        discount_value DECIMAL(10, 2) NOT NULL,
        min_order DECIMAL(10, 2) DEFAULT 0.00,
        max_discount DECIMAL(10, 2),
        active BOOLEAN DEFAULT TRUE,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Create restaurant reviews table
    await client.query(`
      CREATE TABLE IF NOT EXISTS restaurant_reviews (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Create rider reviews table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rider_reviews (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        rider_id UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Add indexes for reviews and coupons
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_restaurant_id ON restaurant_reviews(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_rider_reviews_rider_id ON rider_reviews(rider_id);
      CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
    `)

    // Seed default coupons if not already present
    await client.query(`
      INSERT INTO coupons (code, description, discount_type, discount_value, min_order, max_discount)
      VALUES 
        ('WELCOME10', '10% off on orders above Rs.299', 'PERCENTAGE', 10.00, 299.00, 120.00),
        ('SAVE75', 'Rs.75 off on orders above Rs.499', 'FLAT', 75.00, 499.00, 75.00),
        ('FREEDEL', 'Removes the delivery fee', 'FLAT', 0.00, 0.00, 0.00)
      ON CONFLICT (code) DO NOTHING;
    `)

    await client.query('COMMIT')
    console.log('✓ Features database schema initialized successfully')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Failed to initialize features database schema:', error)
    throw error
  } finally {
    client.release()
  }
}

module.exports = {
  ensureFeaturesSchema,
}
