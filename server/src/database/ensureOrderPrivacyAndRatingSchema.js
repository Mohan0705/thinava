const pool = require('./connection')

const MIGRATION_SCRIPT = `
-- ============================================================
-- THINAVA ORDER PRIVACY, PAYMENT STATUS & RATING SYSTEM
-- ============================================================

-- 1. ADD payment_status TO orders TABLE
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(40) DEFAULT 'pending';

-- Update existing orders based on status
UPDATE orders SET payment_status = 'paid' WHERE status IN ('delivered', 'out_for_delivery', 'ready_for_pickup', 'preparing') AND payment_method != 'cod';
UPDATE orders SET payment_status = 'pending' WHERE status IN ('placed', 'confirmed') AND payment_method != 'cod';
UPDATE orders SET payment_status = 'cancelled' WHERE status IN ('cancelled', 'rejected', 'failed');
UPDATE orders SET payment_status = 'refunded' WHERE status = 'cancelled' AND payment_method != 'cod';
UPDATE orders SET payment_status = 'cod_pending' WHERE payment_method = 'cod' AND status NOT IN ('cancelled', 'delivered');
UPDATE orders SET payment_status = 'cod_collected' WHERE payment_method = 'cod' AND status = 'delivered';

-- 2. CREATE RESTAURANT RATINGS TABLE
CREATE TABLE IF NOT EXISTS restaurant_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  food_quality INTEGER CHECK (food_quality >= 1 AND food_quality <= 5),
  review_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restaurant_ratings_restaurant_id ON restaurant_ratings(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_ratings_order_id ON restaurant_ratings(order_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_ratings_customer_id ON restaurant_ratings(customer_id);

-- 3. CREATE RIDER RATINGS TABLE
CREATE TABLE IF NOT EXISTS rider_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  delivery_speed INTEGER CHECK (delivery_speed >= 1 AND delivery_speed <= 5),
  behavior INTEGER CHECK (behavior >= 1 AND behavior <= 5),
  review_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rider_ratings_rider_id ON rider_ratings(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_ratings_order_id ON rider_ratings(order_id);
CREATE INDEX IF NOT EXISTS idx_rider_ratings_customer_id ON rider_ratings(customer_id);

-- 4. CREATE ORDER REVIEWS TABLE (combined review)
CREATE TABLE IF NOT EXISTS order_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_rating INTEGER CHECK (restaurant_rating >= 1 AND restaurant_rating <= 5),
  rider_rating INTEGER CHECK (rider_rating >= 1 AND rider_rating <= 5),
  food_quality INTEGER CHECK (food_quality >= 1 AND food_quality <= 5),
  delivery_speed INTEGER CHECK (delivery_speed >= 1 AND delivery_speed <= 5),
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  review_text TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_reviews_order_id ON order_reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_order_reviews_customer_id ON order_reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_reviews_restaurant_rating ON order_reviews(restaurant_rating);
CREATE INDEX IF NOT EXISTS idx_order_reviews_rider_rating ON order_reviews(rider_rating);

-- 5. ADD rating columns to restaurants and delivery_partners if not exists
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating_sum DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE delivery_partners
ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating_sum DECIMAL(10, 2) DEFAULT 0;

-- 6. CREATE INDEX FOR payment_status queries
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_status_payment ON orders(status, payment_status);
`

async function ensureOrderPrivacyAndRatingSchema() {
  const client = await pool.connect()
  try {
    console.log('🔄 Applying order privacy, payment status & rating schema...')
    
    const statements = MIGRATION_SCRIPT.split(';').filter(s => s.trim())
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await client.query(statement)
        } catch (err) {
          if (!err.message.includes('already exists') && 
              !err.message.includes('does not exist') &&
              !err.message.includes('constraint')) {
            console.error('Migration statement error:', err.message, '\nStatement:', statement.substring(0, 100))
          }
        }
      }
    }
    
    console.log('✅ Order privacy, payment status & rating schema applied')
    return true
  } catch (error) {
    console.error('❌ Failed to apply schema:', error.message)
    throw error
  } finally {
    client.release()
  }
}

module.exports = { ensureOrderPrivacyAndRatingSchema }
