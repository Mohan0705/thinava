require('dotenv').config({ path: './server/.env.local' })
const bcrypt = require('bcryptjs')
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
})

async function seedDeliveryPartner() {
  try {
    // Hash password for test account
    const password = 'Test@1234'
    const passwordHash = await bcrypt.hash(password, 10)

    // Insert test delivery partner
    const result = await pool.query(
      `INSERT INTO delivery_partners (full_name, phone, email, password_hash, vehicle_type, vehicle_number, is_active, current_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (phone) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         password_hash = EXCLUDED.password_hash
       RETURNING id, full_name, phone, email`,
      [
        'Test Delivery Partner',
        '9876543210',
        'delivery@thinava.com',
        passwordHash,
        'Bike',
        'TEST-001',
        true,
        'AVAILABLE',
      ]
    )

    console.log('CREATED:', result.rows[0])
    console.log('PHONE: 9876543210')
    console.log('PASSWORD:', password)
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await pool.end()
  }
}

seedDeliveryPartner()
