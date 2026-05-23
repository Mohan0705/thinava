-- ============================================================
-- THINAVA RESTAURANT SCHEMA FIX - Missing Columns
-- ============================================================

-- 1. Fix restaurants table - add missing columns for registration
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'multi-cuisine',
ADD COLUMN IF NOT EXISTS veg_non_veg VARCHAR(50) DEFAULT 'both';

-- Create index for phone
CREATE INDEX IF NOT EXISTS idx_restaurants_phone ON restaurants(phone);

-- 2. Fix restaurant_users table - add phone column for contact
ALTER TABLE restaurant_users
ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Create index for phone
CREATE INDEX IF NOT EXISTS idx_restaurant_users_phone ON restaurant_users(phone);

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

-- 5. Create tracking indexes for approvals
CREATE INDEX IF NOT EXISTS idx_restaurant_approvals_address 
ON restaurant_approvals(city, state);

-- Verify schema created successfully
SELECT 'Schema migration completed successfully' AS status;
