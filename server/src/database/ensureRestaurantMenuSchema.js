const pool = require('./connection')

const MIGRATION_SCRIPT = `
-- ============================================================
-- THINAVA RESTAURANT MENU SYSTEM REBUILD
-- Remove global menu tables, enhance restaurant-specific menus
-- ============================================================

-- 1. DROP OLD GLOBAL MENU TABLES
DROP TABLE IF EXISTS restaurant_menu_mappings CASCADE;
DROP TABLE IF EXISTS admin_food_items CASCADE;
DROP TABLE IF EXISTS admin_menu_categories CASCADE;

-- 2. ENHANCE menu_items TABLE WITH NEW FIELDS
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS offer_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS preparation_time INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS spice_level VARCHAR(20) DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS calories INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- 3. CREATE RESTAURANT ITEM VARIANTS TABLE
CREATE TABLE IF NOT EXISTS restaurant_item_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  offer_price DECIMAL(10, 2),
  is_default BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_item_variants_menu_item_id ON restaurant_item_variants(menu_item_id);

-- 4. CREATE RESTAURANT ITEM ADDONS TABLE
CREATE TABLE IF NOT EXISTS restaurant_item_addons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  is_required BOOLEAN DEFAULT FALSE,
  max_quantity INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_item_addons_menu_item_id ON restaurant_item_addons(menu_item_id);

-- 5. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_category ON menu_items(restaurant_id, category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_availability ON menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_menu_items_bestseller ON menu_items(is_bestseller);
CREATE INDEX IF NOT EXISTS idx_menu_items_recommended ON menu_items(is_recommended);
CREATE INDEX IF NOT EXISTS idx_menu_items_display_order ON menu_items(display_order);
`

async function ensureRestaurantMenuSchema() {
  const client = await pool.connect()
  try {
    console.log('🔄 Rebuilding restaurant menu schema...')
    
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
    
    console.log('✅ Restaurant menu schema rebuild complete')
    return true
  } catch (error) {
    console.error('❌ Failed to rebuild menu schema:', error.message)
    throw error
  } finally {
    client.release()
  }
}

module.exports = { ensureRestaurantMenuSchema }
