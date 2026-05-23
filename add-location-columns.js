require('dotenv').config({ path: require('path').join(__dirname, '.env.local') })
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: require('path').join(__dirname, 'server', '.env.local') })
}

const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function addLocationColumnsToRestaurants() {
  const client = await pool.connect()
  try {
    console.log('🔧 Adding location columns (city, state, pincode) to restaurants table...\n')
    
    const migrations = [
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS city VARCHAR(100)`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS state VARCHAR(100)`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS pincode VARCHAR(10)`,
      `CREATE INDEX IF NOT EXISTS idx_restaurants_location ON restaurants(city, state, pincode)`,
    ]
    
    for (const migration of migrations) {
      try {
        await client.query(migration)
        console.log(`✅ ${migration}`)
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`✅ ${migration} (already exists)`)
        } else {
          console.log(`⚠️  ${migration} - Error: ${err.message.substring(0, 50)}`)
        }
      }
    }
    
    // Verify all required columns exist
    console.log('\n🔍 Verifying restaurants table schema...\n')
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'restaurants'
      ORDER BY ordinal_position
    `)
    
    console.log('📋 Restaurants table columns:')
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`)
    })
    
    const requiredColumns = {
      address: result.rows.some(r => r.column_name === 'address'),
      city: result.rows.some(r => r.column_name === 'city'),
      state: result.rows.some(r => r.column_name === 'state'),
      pincode: result.rows.some(r => r.column_name === 'pincode'),
      phone: result.rows.some(r => r.column_name === 'phone'),
      category: result.rows.some(r => r.column_name === 'category'),
      veg_non_veg: result.rows.some(r => r.column_name === 'veg_non_veg'),
    }
    
    console.log(`\n✓ Has address column: ${requiredColumns.address ? '✅ YES' : '❌ NO'}`)
    console.log(`✓ Has city column: ${requiredColumns.city ? '✅ YES' : '❌ NO'}`)
    console.log(`✓ Has state column: ${requiredColumns.state ? '✅ YES' : '❌ NO'}`)
    console.log(`✓ Has pincode column: ${requiredColumns.pincode ? '✅ YES' : '❌ NO'}`)
    console.log(`✓ Has phone column: ${requiredColumns.phone ? '✅ YES' : '❌ NO'}`)
    console.log(`✓ Has category column: ${requiredColumns.category ? '✅ YES' : '❌ NO'}`)
    console.log(`✓ Has veg_non_veg column: ${requiredColumns.veg_non_veg ? '✅ YES' : '❌ NO'}`)
    
    const allPresent = Object.values(requiredColumns).every(v => v)
    if (allPresent) {
      console.log('\n🎉 All required columns are now present!')
      process.exit(0)
    } else {
      console.log('\n⚠️  Some columns still missing!')
      process.exit(1)
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await client.release()
    await pool.end()
  }
}

addLocationColumnsToRestaurants()
