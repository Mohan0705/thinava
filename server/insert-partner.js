require('dotenv').config({ path: require('path').join(__dirname, '.env.local') })
const bcrypt = require('bcryptjs')
const pool = require('./src/database/connection')

async function run() {
  try {
    const password = 'Test@1234'
    const hash = await bcrypt.hash(password, 10)
    const res = await pool.query(`INSERT INTO delivery_partners (full_name, phone, email, password_hash, vehicle_type, vehicle_number, is_active, current_status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id, full_name, phone, email`, ['Test Delivery Partner', '9876543210', 'delivery@thinava.com', hash, 'Bike', 'TEST-001', true, 'AVAILABLE'])
    console.log('Inserted:', res.rows[0])
  } catch (err) {
    console.error('ERROR', err && err.message ? err.message : err)
  } finally {
    await pool.end()
  }
}

run()
