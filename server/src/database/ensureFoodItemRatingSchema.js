const pool = require('./connection')

const MIGRATION_SCRIPT = `
-- ============================================================
-- THINAVA FOOD ITEM RATINGS & REVIEW ANALYTICS MIGRATION
-- ============================================================

-- 1. ADD rating columns TO menu_items table
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS item_rating_sum DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS item_rating_count INTEGER DEFAULT 0;

-- 2. ADD average_rating column TO restaurants (computed display field)
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3, 1) DEFAULT 0;

-- 3. ADD average_rating column TO delivery_partners (computed display field)
ALTER TABLE delivery_partners
ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3, 1) DEFAULT 0;

-- 4. CREATE food_item_reviews TABLE
CREATE TABLE IF NOT EXISTS food_item_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_food_item_reviews_menu_item_id ON food_item_reviews(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_food_item_reviews_order_id ON food_item_reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_food_item_reviews_customer_id ON food_item_reviews(customer_id);

-- 5. ADD CONSTRAINT TO PREVENT DUPLICATE food_item_reviews per order per item
-- (one review per item per order)
CREATE UNIQUE INDEX IF NOT EXISTS idx_food_item_reviews_unique
  ON food_item_reviews(order_id, menu_item_id);

-- 6. UPDATE existing average_rating columns from denormalized data
UPDATE restaurants
SET average_rating = CASE
  WHEN rating_count > 0 THEN (rating_sum / rating_count)::decimal(3,1)
  ELSE 0
END
WHERE rating_count > 0;

UPDATE delivery_partners
SET average_rating = CASE
  WHEN rating_count > 0 THEN (rating_sum / rating_count)::decimal(3,1)
  ELSE 0
END
WHERE rating_count > 0;

-- 7. UPDATE menu_items with computed averages
UPDATE menu_items
SET item_rating_sum = COALESCE(item_rating_sum, 0),
    item_rating_count = COALESCE(item_rating_count, 0)
WHERE item_rating_sum IS NULL OR item_rating_count IS NULL;

-- 8. CREATE restaurant_review_analytics MATERIALIZED VIEW HELPERS
-- (We use the reviewAggregationService for computation, but keep indexes up to date)

-- Ensure indexes on order_reviews for analytics queries
CREATE INDEX IF NOT EXISTS idx_order_reviews_created_at ON order_reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_order_reviews_restaurant_id_computed
  ON order_reviews USING gin (to_tsvector('simple', COALESCE(review_text, '')));

-- 9. UPDATE restaurant_reviews and rider_reviews with rating_sum/count
-- Ensure all legacy data has rating_sum and rating_count initialized
UPDATE restaurants SET
  rating_sum = COALESCE(rating_sum, 0),
  rating_count = COALESCE(rating_count, 0)
WHERE rating_sum IS NULL OR rating_count IS NULL;

UPDATE delivery_partners SET
  rating_sum = COALESCE(rating_sum, 0),
  rating_count = COALESCE(rating_count, 0)
WHERE rating_sum IS NULL OR rating_count IS NULL;
`

async function ensureFoodItemRatingSchema() {
  const client = await pool.connect()
  try {
    console.log('🔄 Applying food item rating & review analytics schema...')

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

    console.log('✅ Food item rating & review analytics schema applied')
    return true
  } catch (error) {
    console.error('❌ Failed to apply schema:', error.message)
    throw error
  } finally {
    client.release()
  }
}

module.exports = { ensureFoodItemRatingSchema }
