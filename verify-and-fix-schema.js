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

async function verifyAndApplyMigrations() {
  const client = await pool.connect()
  try {
    console.log('🔍 Checking current restaurant schema...\n')
    
    // Check current columns in restaurants table
    const restaurantsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'restaurants'
      ORDER BY ordinal_position
    `)
    console.log('📋 Current restaurants table columns:')
    restaurantsResult.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`)
    })
    
    const hasAddressColumn = restaurantsResult.rows.some(r => r.column_name === 'address')
    const hasPhoneColumn = restaurantsResult.rows.some(r => r.column_name === 'phone')
    const hasCategoryColumn = restaurantsResult.rows.some(r => r.column_name === 'category')
    
    console.log(`\n✓ Has address column: ${hasAddressColumn ? '✅ YES' : '❌ NO'}`)
    console.log(`✓ Has phone column: ${hasPhoneColumn ? '✅ YES' : '❌ NO'}`)
    console.log(`✓ Has category column: ${hasCategoryColumn ? '✅ YES' : '❌ NO'}`)
    
    if (!hasAddressColumn || !hasPhoneColumn || !hasCategoryColumn) {
      console.log('\n🔧 Applying missing columns...\n')
      
      // Apply migrations
      const migrations = [
        `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`,
        `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'multi-cuisine'`,
        `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS veg_non_veg VARCHAR(50) DEFAULT 'both'`,
        `CREATE INDEX IF NOT EXISTS idx_restaurants_phone ON restaurants(phone)`,
        `ALTER TABLE restaurant_users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`,
        `CREATE INDEX IF NOT EXISTS idx_restaurant_users_phone ON restaurant_users(phone)`,
        `ALTER TABLE restaurant_details ADD COLUMN IF NOT EXISTS address TEXT`,
        `ALTER TABLE restaurant_details ADD COLUMN IF NOT EXISTS city VARCHAR(100)`,
        `ALTER TABLE restaurant_details ADD COLUMN IF NOT EXISTS state VARCHAR(100)`,
        `ALTER TABLE restaurant_details ADD COLUMN IF NOT EXISTS pincode VARCHAR(10)`,
        `CREATE INDEX IF NOT EXISTS idx_restaurant_details_location ON restaurant_details(city, state, pincode)`,
        `ALTER TABLE restaurant_approvals ADD COLUMN IF NOT EXISTS city VARCHAR(100)`,
        `ALTER TABLE restaurant_approvals ADD COLUMN IF NOT EXISTS state VARCHAR(100)`,
        `ALTER TABLE restaurant_approvals ADD COLUMN IF NOT EXISTS pincode VARCHAR(10)`,
        `ALTER TABLE restaurant_approvals ADD COLUMN IF NOT EXISTS category VARCHAR(100)`,
        `ALTER TABLE restaurant_approvals ADD COLUMN IF NOT EXISTS veg_non_veg VARCHAR(50)`,
        `ALTER TABLE restaurant_approvals ADD COLUMN IF NOT EXISTS opening_time VARCHAR(20)`,
        `ALTER TABLE restaurant_approvals ADD COLUMN IF NOT EXISTS closing_time VARCHAR(20)`,
        `ALTER TABLE restaurant_approvals ADD COLUMN IF NOT EXISTS delivery_radius_km DECIMAL(5, 2)`,
        `CREATE INDEX IF NOT EXISTS idx_restaurant_approvals_address ON restaurant_approvals(city, state)`,
      ]
      
      let successCount = 0
      let errorCount = 0
      
      for (const migration of migrations) {
        try {
          await client.query(migration)
          console.log(`✅ ${migration.substring(0, 60)}...`)
          successCount++
        } catch (err) {
          // Only log real errors, not IF NOT EXISTS conflicts
          if (!err.message.includes('already exists')) {
            console.log(`⚠️  ${migration.substring(0, 60)}... (${err.message.substring(0, 50)})`)
            errorCount++
          } else {
            console.log(`✅ ${migration.substring(0, 60)}... (already exists)`)
            successCount++
          }
        }
      }
      
      console.log(`\n📊 Migration results: ${successCount} successful, ${errorCount} errors`)
      
      // Verify again
      console.log('\n🔍 Verifying schema after migration...\n')
      const restaurantsResult2 = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'restaurants'
        ORDER BY ordinal_position
      `)
      console.log('📋 Updated restaurants table columns:')
      restaurantsResult2.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type}`)
      })
      
      const hasAddressNow = restaurantsResult2.rows.some(r => r.column_name === 'address')
      const hasPhoneNow = restaurantsResult2.rows.some(r => r.column_name === 'phone')
      const hasCategoryNow = restaurantsResult2.rows.some(r => r.column_name === 'category')
      
      console.log(`\n✓ Has address column: ${hasAddressNow ? '✅ YES' : '❌ NO'}`)
      console.log(`✓ Has phone column: ${hasPhoneNow ? '✅ YES' : '❌ NO'}`)
      console.log(`✓ Has category column: ${hasCategoryNow ? '✅ YES' : '❌ NO'}`)
      
      if (hasAddressNow && hasPhoneNow && hasCategoryNow) {
        console.log('\n🎉 Schema migration SUCCESSFUL!')
      } else {
        console.log('\n⚠️  Some columns still missing!')
      }
    } else {
      console.log('\n✅ All required columns already exist!')
    }
    
  } catch (error) {
    console.error('❌ Error during verification:', error.message)
  } finally {
    await client.release()
    await pool.end()
  }
}

verifyAndApplyMigrations().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
