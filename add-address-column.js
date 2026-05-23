require('dotenv').config({ path: require('path').join(__dirname, '.env.local') })
// If DATABASE_URL not found in root, try server/.env.local
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: require('path').join(__dirname, 'server', '.env.local') })
}

const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function addAddressToRestaurants() {
  const client = await pool.connect()
  try {
    console.log('🔧 Adding address column to restaurants table...\n')
    
    // Add address column to restaurants table if it doesn't exist
    const addAddressQuery = `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS address TEXT`
    
    try {
      await client.query(addAddressQuery)
      console.log('✅ Successfully added address column to restaurants table')
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('✅ address column already exists in restaurants table')
      } else {
        throw err
      }
    }
    
    // Verify it was added
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
    
    const hasAddress = result.rows.some(r => r.column_name === 'address')
    const hasPhone = result.rows.some(r => r.column_name === 'phone')
    const hasCategory = result.rows.some(r => r.column_name === 'category')
    
    console.log(`\n✓ Has address column: ${hasAddress ? '✅ YES' : '❌ NO'}`)
    console.log(`✓ Has phone column: ${hasPhone ? '✅ YES' : '❌ NO'}`)
    console.log(`✓ Has category column: ${hasCategory ? '✅ YES' : '❌ NO'}`)
    
    if (hasAddress && hasPhone && hasCategory) {
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

addAddressToRestaurants()
