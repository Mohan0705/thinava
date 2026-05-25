-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Addresses table
CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(100) NOT NULL,
  address_type VARCHAR(40),
  full_address TEXT NOT NULL,
  landmark VARCHAR(255),
  receiver_name VARCHAR(255),
  receiver_phone VARCHAR(40),
  use_account_details BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Restaurants table
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

-- Menu items table
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image TEXT NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Uncategorized',
  is_veg BOOLEAN DEFAULT TRUE,
  is_bestseller BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
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

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_featured ON restaurants(featured);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Restaurant panel: owner accounts
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

-- Restaurant panel: category management
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

-- Restaurant panel: restaurant settings
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS banner_image TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS opening_time VARCHAR(20),
ADD COLUMN IF NOT EXISTS closing_time VARCHAR(20),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) DEFAULT 'Asia/Kolkata',
ADD COLUMN IF NOT EXISTS is_manually_closed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS minimum_order DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_radius_km INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS status VARCHAR(40) DEFAULT 'OPEN';

UPDATE restaurants
SET timezone = 'Asia/Kolkata'
WHERE timezone IS NULL OR TRIM(timezone) = '';

UPDATE restaurants
SET is_manually_closed = TRUE
WHERE UPPER(COALESCE(status, '')) IN ('CLOSED', 'TEMPORARILY_UNAVAILABLE')
  AND COALESCE(is_manually_closed, FALSE) = FALSE;

CREATE INDEX IF NOT EXISTS idx_restaurants_manual_closed ON restaurants(is_manually_closed);

-- Restaurant panel: menu stock/category support
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS in_stock BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES restaurant_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_users_restaurant_id ON restaurant_users(restaurant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_users_supabase_user_id
ON restaurant_users(supabase_user_id)
WHERE supabase_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_restaurant_users_reset_token
ON restaurant_users(reset_token)
WHERE reset_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_restaurant_categories_restaurant_id ON restaurant_categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);

-- Marketing banners
CREATE TABLE IF NOT EXISTS marketing_banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(160) NOT NULL,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  cloudinary_public_id TEXT,
  redirect_type VARCHAR(40) NOT NULL DEFAULT 'restaurants',
  redirect_target TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMP,
  ends_at TIMESTAMP,
  created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT marketing_banners_redirect_type_check CHECK (
    redirect_type IN ('restaurants', 'restaurant', 'category', 'offers', 'custom')
  )
);

CREATE INDEX IF NOT EXISTS idx_marketing_banners_active_priority
  ON marketing_banners (is_active, priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_banners_schedule
  ON marketing_banners (starts_at, ends_at);
