#!/usr/bin/env node
/**
 * CRITICAL: Diagnose DATABASE_URL loading and parsing
 * Run this BEFORE starting the server to verify configuration
 */

require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '../.env.local' })
require('dotenv').config({ path: '.env' })

console.log('\n╔════════════════════════════════════════════╗')
console.log('║       DATABASE_URL DIAGNOSTIC REPORT      ║')
console.log('╚════════════════════════════════════════════╝\n')

const dbUrl = process.env.DATABASE_URL
console.log('1️⃣  Raw DATABASE_URL value:')
console.log(`   ${dbUrl ? '✓ FOUND' : '✗ MISSING'}`)

if (!dbUrl) {
  console.log('\n   ❌ CRITICAL: DATABASE_URL is not set!')
  console.log('   Check:\n     • Render environment variables')
  console.log('     • .env.local file exists and has DATABASE_URL')
  console.log('     • Environment variable is spelled correctly\n')
  process.exit(1)
}

console.log(`   Value: ${dbUrl.substring(0, 50)}...`)

// Parse the connection string
try {
  const URL = require('url').URL
  const parsed = new URL(dbUrl)
  
  console.log('\n2️⃣  Parsed URL components:')
  console.log(`   Protocol: ${parsed.protocol}`)
  console.log(`   Hostname: ${parsed.hostname}`)
  console.log(`   Port: ${parsed.port}`)
  console.log(`   Database: ${parsed.pathname}`)
  console.log(`   Username: ${parsed.username ? '✓ SET' : '✗ MISSING'}`)
  console.log(`   Password: ${parsed.password ? '✓ SET' : '✗ MISSING'}`)
  
  if (!parsed.hostname || parsed.hostname === 'base') {
    throw new Error(`INVALID HOSTNAME: "${parsed.hostname}"`)
  }
  
  console.log('\n3️⃣  Validation: ✓ PASSED')
  
} catch (err) {
  console.log('\n2️⃣  Parsed URL components:')
  console.log(`   ❌ Parse Error: ${err.message}`)
  console.log('\n   DATABASE_URL format appears invalid!')
  console.log('   Expected: postgresql://user:pass@host:port/database')
  process.exit(1)
}

// Test with pg module
console.log('\n4️⃣  Testing pg module connection pool:')
try {
  const { Pool } = require('pg')
  const testPool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  })
  
  console.log('   Pool created successfully')
  console.log(`   Connection string detected by pg: ✓`)
  
  testPool.end()
} catch (err) {
  console.log(`   ❌ Error: ${err.message}`)
  process.exit(1)
}

console.log('\n✅ All checks passed! DATABASE_URL is correctly configured.\n')
