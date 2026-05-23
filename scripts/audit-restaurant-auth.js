#!/usr/bin/env node
/**
 * Restaurant Auth Deep Audit
 * 
 * Compares self-created vs admin-created restaurants
 * Verifies password hashing, status, approval flags
 */

const pool = require('../server/src/database/connection')

const audit = async () => {
  try {
    console.log('\n========================================')
    console.log('RESTAURANT AUTH DEEP AUDIT')
    console.log('========================================\n')

    // 1. Get all restaurants with their users
    console.log('📊 Fetching restaurants...\n')
    const restaurantsRes = await pool.query(`
      SELECT 
        r.id,
        r.name,
        r.status as restaurant_status,
        r.is_open,
        rd.owner_email,
        ru.id as user_id,
        ru.email as user_email,
        ru.password_hash,
        ru.role,
        ru.created_at,
        ra.status as approval_status,
        ra.approved_at,
        ra.created_at as approval_created_at
      FROM restaurants r
      LEFT JOIN restaurant_details rd ON r.id = rd.restaurant_id
      LEFT JOIN restaurant_users ru ON r.id = ru.restaurant_id
      LEFT JOIN restaurant_approvals ra ON r.id = ra.restaurant_id
      ORDER BY r.created_at DESC
      LIMIT 10
    `)

    if (restaurantsRes.rows.length === 0) {
      console.log('❌ No restaurants found')
      process.exit(1)
    }

    console.log(`Found ${restaurantsRes.rows.length} restaurants:\n`)

    restaurantsRes.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.name}`)
      console.log(`   Restaurant ID: ${row.id}`)
      console.log(`   Status: ${row.restaurant_status} | Is Open: ${row.is_open}`)
      console.log(`   Approval Status: ${row.approval_status}`)
      console.log(`   User Email: ${row.user_email}`)
      console.log(`   Password Hash Exists: ${row.password_hash ? '✅ YES' : '❌ NO'}`)
      if (row.password_hash) {
        console.log(`   Password Hash Length: ${row.password_hash.length} chars`)
        console.log(`   Hash Starts With: ${row.password_hash.substring(0, 10)}...`)
      }
      console.log(`   Created: ${row.created_at}`)
      console.log(`   Approved At: ${row.approved_at || 'NOT APPROVED'}`)
      console.log()
    })

    // 2. Check for password hash issues
    console.log('\n========================================')
    console.log('PASSWORD HASH VERIFICATION')
    console.log('========================================\n')

    const noHashRes = await pool.query(`
      SELECT ru.id, ru.email, ru.restaurant_id, r.name, r.status
      FROM restaurant_users ru
      JOIN restaurants r ON r.id = ru.restaurant_id
      WHERE ru.password_hash IS NULL OR ru.password_hash = ''
    `)

    if (noHashRes.rows.length > 0) {
      console.log(`⚠️  ${noHashRes.rows.length} users have NULL/empty password hashes:`)
      noHashRes.rows.forEach(row => {
        console.log(`   - ${row.email} (${row.name}) [${row.status}]`)
      })
    } else {
      console.log('✅ All users have password hashes')
    }

    // 3. Compare PENDING_APPROVAL vs OPEN restaurants
    console.log('\n========================================')
    console.log('STATUS BREAKDOWN')
    console.log('========================================\n')

    const statusRes = await pool.query(`
      SELECT 
        r.status,
        COUNT(*) as count,
        COUNT(CASE WHEN ru.id IS NOT NULL THEN 1 END) as with_users,
        COUNT(CASE WHEN ru.password_hash IS NOT NULL THEN 1 END) as with_passwords
      FROM restaurants r
      LEFT JOIN restaurant_users ru ON r.id = ru.restaurant_id
      GROUP BY r.status
      ORDER BY count DESC
    `)

    statusRes.rows.forEach(row => {
      console.log(`${row.status}: ${row.count} restaurants`)
      console.log(`  - With users: ${row.with_users}`)
      console.log(`  - With passwords: ${row.with_passwords}`)
    })

    // 4. Test bcrypt on a sample password (skipped in this context)
    console.log('\n========================================')
    console.log('BCRYPT VERIFICATION TEST')
    console.log('========================================\n')
    console.log('(Bcrypt test would be run in server context)')

    // 5. Get login query execution plan
    console.log('\n========================================')
    console.log('LOGIN QUERY ANALYSIS')
    console.log('========================================\n')

    // Test the exact login query
    const testEmail = restaurantsRes.rows[0]?.user_email
    if (testEmail) {
      console.log(`Testing with email: ${testEmail}\n`)
      
      const loginRes = await pool.query(
        `SELECT ru.*, r.id as restaurant_id, r.status as restaurant_status
         FROM restaurant_users ru
         JOIN restaurants r ON r.id = ru.restaurant_id
         WHERE ru.email = $1`,
        [testEmail]
      )

      if (loginRes.rows.length > 0) {
        const user = loginRes.rows[0]
        console.log('✅ User found by email')
        console.log(`   ID: ${user.id}`)
        console.log(`   Email: ${user.email}`)
        console.log(`   Restaurant Status: ${user.restaurant_status}`)
        console.log(`   Password Hash: ${user.password_hash ? '✅ EXISTS' : '❌ MISSING'}`)
        console.log(`   Role: ${user.role}`)
        console.log(`   Is Active: ${user.is_active}`)
      } else {
        console.log('❌ User NOT found by email')
      }
    }

    // 6. Summary
    console.log('\n========================================')
    console.log('SUMMARY & RECOMMENDATIONS')
    console.log('========================================\n')

    const totalRes = await pool.query(`
      SELECT 
        COUNT(*) as total_restaurants,
        COUNT(CASE WHEN status = 'PENDING_APPROVAL' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as open,
        COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved
      FROM restaurants
    `)

    const stats = totalRes.rows[0]
    console.log(`Total Restaurants: ${stats.total_restaurants}`)
    console.log(`  - PENDING_APPROVAL: ${stats.pending}`)
    console.log(`  - OPEN: ${stats.open}`)
    console.log(`  - APPROVED: ${stats.approved}`)

    // Check for mismatches
    const mismatchRes = await pool.query(`
      SELECT 
        r.id,
        r.name,
        r.status as r_status,
        ra.status as ra_status,
        ru.email
      FROM restaurants r
      LEFT JOIN restaurant_approvals ra ON r.id = ra.restaurant_id
      LEFT JOIN restaurant_users ru ON r.id = ru.restaurant_id
      WHERE r.status != ra.status
      LIMIT 5
    `)

    if (mismatchRes.rows.length > 0) {
      console.log(`\n⚠️  STATUS MISMATCH FOUND (${mismatchRes.rows.length})`)
      mismatchRes.rows.forEach(row => {
        console.log(`   ${row.name}: restaurant=${row.r_status}, approval=${row.ra_status}`)
      })
    } else {
      console.log('\n✅ No status mismatches found')
    }

    console.log('\n========================================')
    console.log('AUDIT COMPLETE')
    console.log('========================================\n')

    process.exit(0)

  } catch (error) {
    console.error('❌ Audit failed:', error)
    process.exit(1)
  }
}

audit()
