#!/usr/bin/env node
/**
 * THINAVA Database Migration Script
 * Applies all schema extensions for production-grade functionality
 */

const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.local') })
const pool = require('./connection')

const migrateDatabase = async () => {
  const client = await pool.connect()
  
  try {
    console.log('Starting THINAVA database migration...')
    
    // Read the schema extensions file
    const schemaPath = path.join(__dirname, 'schema-extensions.sql')
    const schemaSql = fs.readFileSync(schemaPath, 'utf8')
    
    // Execute the schema
    console.log('Executing schema extensions...')
    await client.query(schemaSql)
    
    console.log('✓ Schema extensions applied successfully')
    
    // Verify critical tables exist
    const criticalTables = [
      'restaurant_approvals',
      'delivery_partners',
      'rider_details',
      'restaurant_details',
      'admin_menu_categories',
      'admin_food_items',
      'restaurant_menu_mappings',
      'delivery_locations',
      'active_delivery_sessions',
      'order_status_history',
      'socket_events_log'
    ]
    
    console.log('\nVerifying critical tables...')
    for (const table of criticalTables) {
      const result = await client.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`,
        [table]
      )
      
      if (result.rows[0].exists) {
        console.log(`✓ ${table}`)
      } else {
        throw new Error(`Table ${table} not created!`)
      }
    }
    
    console.log('\n✓ All tables verified successfully')
    
    // Log migration completion
    console.log('\n================================================')
    console.log('✓ THINAVA Database Migration Complete!')
    console.log('================================================')
    console.log('\nNew Tables Created:')
    console.log('  • restaurant_approvals')
    console.log('  • delivery_partners')
    console.log('  • rider_details')
    console.log('  • rider_approval_logs')
    console.log('  • restaurant_status_logs')
    console.log('  • restaurant_details')
    console.log('  • admin_menu_categories')
    console.log('  • admin_food_items')
    console.log('  • restaurant_menu_mappings')
    console.log('  • delivery_locations')
    console.log('  • active_delivery_sessions')
    console.log('  • socket_events_log')
    console.log('  • restaurant_approval_history')
    console.log('  • order_status_history')
    console.log('\nColumns Added to Existing Tables:')
    console.log('  • orders: delivery_partner_id, rider_name, rider_phone, rider_image, etc.')
    console.log('\nDatabase is ready for THINAVA production features!')
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.error(error)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

// Run migration
migrateDatabase().catch((error) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
