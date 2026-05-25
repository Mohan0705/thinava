require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const pool = require('./connection')

const MIGRATION_SCRIPT = `
-- ============================================================
-- THINAVA RESTAURANT SCHEMA FIX - Missing Columns
-- ============================================================

-- 1. Fix restaurants table - add missing columns for registration
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'multi-cuisine',
ADD COLUMN IF NOT EXISTS veg_non_veg VARCHAR(50) DEFAULT 'both',
ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) DEFAULT 'Asia/Kolkata',
ADD COLUMN IF NOT EXISTS is_manually_closed BOOLEAN DEFAULT FALSE;

-- Create index for phone
CREATE INDEX IF NOT EXISTS idx_restaurants_phone ON restaurants(phone);

-- 2. Fix restaurant_users table - add phone column for contact
ALTER TABLE restaurant_users
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS supabase_user_id UUID UNIQUE,
ADD COLUMN IF NOT EXISTS reset_token TEXT,
ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP;

-- Create index for phone
CREATE INDEX IF NOT EXISTS idx_restaurant_users_phone ON restaurant_users(phone);
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_users_supabase_user_id
ON restaurant_users(supabase_user_id)
WHERE supabase_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_restaurant_users_reset_token
ON restaurant_users(reset_token)
WHERE reset_token IS NOT NULL;

-- 3. Fix restaurant_details table - add address components and improve tracking
ALTER TABLE restaurant_details
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS state VARCHAR(100),
ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);

-- Create composite index for location queries
CREATE INDEX IF NOT EXISTS idx_restaurant_details_location 
ON restaurant_details(city, state, pincode);

-- 4. Ensure restaurant_approvals has all necessary address fields
ALTER TABLE restaurant_approvals
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS state VARCHAR(100),
ADD COLUMN IF NOT EXISTS pincode VARCHAR(10),
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS veg_non_veg VARCHAR(50),
ADD COLUMN IF NOT EXISTS opening_time VARCHAR(20),
ADD COLUMN IF NOT EXISTS closing_time VARCHAR(20),
ADD COLUMN IF NOT EXISTS delivery_radius_km DECIMAL(5, 2);

-- Fix latitude/longitude to allow NULL (optional during registration)
ALTER TABLE restaurant_approvals
ALTER COLUMN latitude DROP NOT NULL,
ALTER COLUMN longitude DROP NOT NULL;

-- 5. Create tracking indexes for approvals
CREATE INDEX IF NOT EXISTS idx_restaurant_approvals_address 
ON restaurant_approvals(city, state);
`

async function ensureRestaurantRegistrationSchema() {
  const client = await pool.connect()
  try {
    console.log('🔄 Fixing restaurant schema for registration...')
    
    // Split by GO or semicolon and execute each statement separately
    const statements = MIGRATION_SCRIPT.split(';').filter(s => s.trim())
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await client.query(statement)
        } catch (err) {
          // Ignore "already exists" type errors
          if (!err.message.includes('already exists') && 
              !err.message.includes('does not exist')) {
            console.error('Migration statement error:', err.message, '\nStatement:', statement.substring(0, 100))
          }
        }
      }
    }
    
    console.log('✅ Restaurant schema migration complete')
    return true
  } catch (error) {
    console.error('❌ Failed to migrate restaurant schema:', error.message)
    throw error
  } finally {
    client.release()
  }
}

module.exports = { ensureRestaurantRegistrationSchema }
