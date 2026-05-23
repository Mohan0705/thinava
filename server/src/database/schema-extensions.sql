-- ============================================================
-- THINAVA EXTENDED SCHEMA - Production-Grade Additions
-- ============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. RESTAURANT APPROVAL SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS restaurant_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  owner_name VARCHAR(255) NOT NULL,
  owner_phone VARCHAR(20) NOT NULL,
  owner_email VARCHAR(255) NOT NULL,
  gst_number VARCHAR(50),
  fssai_license VARCHAR(50),
  fssai_image TEXT,
  restaurant_image TEXT NOT NULL,
  address_full TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, SUSPENDED
  approval_notes TEXT,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  rejected_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restaurant_approvals_status ON restaurant_approvals(status);
CREATE INDEX IF NOT EXISTS idx_restaurant_approvals_restaurant_id ON restaurant_approvals(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_approvals_created_at ON restaurant_approvals(created_at DESC);

-- ============================================================
-- 2. RIDER (DELIVERY PARTNER) APPROVAL SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  profile_image TEXT,
  aadhar_number VARCHAR(50),
  aadhar_image TEXT,
  driving_license VARCHAR(50),
  driving_license_image TEXT,
  status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, SUSPENDED, ACTIVE, INACTIVE
  approval_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
  approval_notes TEXT,
  is_online BOOLEAN DEFAULT FALSE,
  is_on_duty BOOLEAN DEFAULT FALSE,
  has_active_order BOOLEAN DEFAULT FALSE,
  last_active_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure all necessary columns exist on delivery_partners
ALTER TABLE delivery_partners 
ADD COLUMN IF NOT EXISTS aadhar_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS aadhar_image TEXT,
ADD COLUMN IF NOT EXISTS driving_license_image TEXT,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS approval_notes TEXT,
ADD COLUMN IF NOT EXISTS is_on_duty BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_active_order BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_delivery_partners_phone ON delivery_partners(phone);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_status ON delivery_partners(status);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_approval_status ON delivery_partners(approval_status);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_is_online ON delivery_partners(is_online);

CREATE TABLE IF NOT EXISTS rider_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_partner_id UUID NOT NULL UNIQUE REFERENCES delivery_partners(id) ON DELETE CASCADE,
  vehicle_type VARCHAR(50) NOT NULL, -- BIKE, SCOOTER, CYCLE
  vehicle_number VARCHAR(50) NOT NULL UNIQUE,
  vehicle_image TEXT,
  zone VARCHAR(100) NOT NULL,
  shift_start TIME,
  shift_end TIME,
  documents_verified BOOLEAN DEFAULT FALSE,
  bank_account_verified BOOLEAN DEFAULT FALSE,
  total_deliveries INTEGER DEFAULT 0,
  total_earnings DECIMAL(12, 2) DEFAULT 0,
  rating DECIMAL(3, 2) DEFAULT 5.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rider_details_delivery_partner_id ON rider_details(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_rider_details_zone ON rider_details(zone);

CREATE TABLE IF NOT EXISTS rider_approval_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_partner_id UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- APPROVED, REJECTED, SUSPENDED, REACTIVATED
  action_by UUID NULL REFERENCES admin_users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rider_approval_logs_delivery_partner_id ON rider_approval_logs(delivery_partner_id);

-- ============================================================
-- 3. RESTAURANT STATUS & MANAGEMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS restaurant_status_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL, -- OPEN, TEMPORARILY_UNAVAILABLE, CLOSED
  changed_by UUID NOT NULL REFERENCES restaurant_users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restaurant_status_logs_restaurant_id ON restaurant_status_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_status_logs_status ON restaurant_status_logs(status);
CREATE INDEX IF NOT EXISTS idx_restaurant_status_logs_created_at ON restaurant_status_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS restaurant_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  owner_name VARCHAR(255) NOT NULL,
  owner_phone VARCHAR(20) NOT NULL,
  owner_email VARCHAR(255) NOT NULL,
  gst_number VARCHAR(50),
  fssai_license VARCHAR(50),
  fssai_expiry DATE,
  bank_account_verified BOOLEAN DEFAULT FALSE,
  documents_verified BOOLEAN DEFAULT FALSE,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restaurant_details_restaurant_id ON restaurant_details(restaurant_id);

-- ============================================================
-- 4. ADMIN MENU MANAGEMENT SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_menu_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_menu_categories_is_active ON admin_menu_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_menu_categories_display_order ON admin_menu_categories(display_order);

CREATE TABLE IF NOT EXISTS admin_food_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_category_id UUID NOT NULL REFERENCES admin_menu_categories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  base_price DECIMAL(10, 2) NOT NULL,
  image TEXT,
  is_veg BOOLEAN DEFAULT TRUE,
  is_available BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  is_trending BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_food_items_category_id ON admin_food_items(admin_category_id);
CREATE INDEX IF NOT EXISTS idx_admin_food_items_is_available ON admin_food_items(is_available);

CREATE TABLE IF NOT EXISTS restaurant_menu_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  admin_food_item_id UUID NOT NULL REFERENCES admin_food_items(id) ON DELETE CASCADE,
  restaurant_price DECIMAL(10, 2) NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  stock_quantity INTEGER DEFAULT 999,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (restaurant_id, admin_food_item_id)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_menu_mappings_restaurant_id ON restaurant_menu_mappings(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_mappings_admin_item_id ON restaurant_menu_mappings(admin_food_item_id);

-- ============================================================
-- 5. ORDER TRACKING & FLOW
-- ============================================================

-- Update orders table with new columns
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivery_partner_id UUID REFERENCES delivery_partners(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS rider_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS rider_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS rider_image TEXT,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_partner_id ON orders(delivery_partner_id);

CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  updated_by VARCHAR(50), -- 'restaurant', 'delivery_partner', 'admin', 'system'
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_created_at ON order_status_history(created_at DESC);

-- ============================================================
-- 6. REAL-TIME RIDER LOCATION TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_partner_id UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(5, 2),
  speed DECIMAL(5, 2),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_locations_rider_timestamp 
  ON delivery_locations(delivery_partner_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_locations_order_id ON delivery_locations(order_id);

-- ============================================================
-- 7. ACTIVE DELIVERY SESSIONS & ORDER LOCKS
-- ============================================================

CREATE TABLE IF NOT EXISTS active_delivery_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_partner_id UUID NOT NULL UNIQUE REFERENCES delivery_partners(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  pickup_lat DECIMAL(10, 8) NOT NULL,
  pickup_lon DECIMAL(11, 8) NOT NULL,
  delivery_lat DECIMAL(10, 8) NOT NULL,
  delivery_lon DECIMAL(11, 8) NOT NULL,
  estimated_eta TIMESTAMP,
  distance_km DECIMAL(7, 2),
  session_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  session_ended_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_active_delivery_sessions_rider_id ON active_delivery_sessions(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_active_delivery_sessions_is_active ON active_delivery_sessions(is_active);

-- ============================================================
-- 8. SOCKET EVENTS AUDIT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS socket_events_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_name VARCHAR(100) NOT NULL,
  subject_id UUID,
  subject_type VARCHAR(50), -- 'restaurant', 'rider', 'order', 'customer'
  payload JSONB,
  error_details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_socket_events_log_event_name ON socket_events_log(event_name);
CREATE INDEX IF NOT EXISTS idx_socket_events_log_subject_id ON socket_events_log(subject_id);
CREATE INDEX IF NOT EXISTS idx_socket_events_log_created_at ON socket_events_log(created_at DESC);

-- ============================================================
-- 9. RESTAURANT APPROVAL HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS restaurant_approval_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- SUBMITTED, APPROVED, REJECTED, SUSPENDED, REACTIVATED
  action_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restaurant_approval_history_restaurant_id ON restaurant_approval_history(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_approval_history_created_at ON restaurant_approval_history(created_at DESC);

-- ============================================================
-- COMPLETION FLAG
-- ============================================================

COMMENT ON SCHEMA public IS 'THINAVA Production Database - Last updated with complete schema extensions';
