-- ============================================================
-- PASSWORD RESET TOKENS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS restaurant_password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_user_id UUID NOT NULL REFERENCES restaurant_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_restaurant_password_reset_tokens_user_id 
  ON restaurant_password_reset_tokens(restaurant_user_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_password_reset_tokens_expires_at 
  ON restaurant_password_reset_tokens(expires_at);

-- Clean up expired tokens periodically
CREATE INDEX IF NOT EXISTS idx_restaurant_password_reset_tokens_used_at 
  ON restaurant_password_reset_tokens(used_at) 
  WHERE used_at IS NULL;

SELECT 'Password reset schema created successfully' AS status;
