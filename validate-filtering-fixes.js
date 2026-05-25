#!/usr/bin/env node

/**
 * THINAVA Filtering & Search - Validation Script
 * Run this to verify all fixes are working correctly
 */

const http = require('http')

const API_BASE = 'http://localhost:3000/api'

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
}

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`)
}

async function testAPI(method, endpoint) {
  return new Promise((resolve) => {
    const options = new URL(API_BASE + endpoint)
    
    const req = http.request(options, { method }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) })
        } catch {
          resolve({ status: res.statusCode, data: null })
        }
      })
    })
    
    req.on('error', () => resolve({ status: 0, data: null }))
    req.end()
  })
}

async function runValidation() {
  console.log(`\n${colors.blue}╔════════════════════════════════════════════════╗${colors.reset}`)
  console.log(`${colors.blue}║    THINAVA Filtering & Search Validation       ║${colors.reset}`)
  console.log(`${colors.blue}╚════════════════════════════════════════════════╝${colors.reset}\n`)

  let passed = 0
  let failed = 0

  // Test 1: Categories Endpoint
  console.log(`${colors.blue}Test 1: Categories Endpoint${colors.reset}`)
  try {
    const result = await testAPI('GET', '/search/categories')
    if (result.status === 200 && result.data?.success && Array.isArray(result.data?.categories)) {
      log.success('Categories endpoint returns valid response')
      passed++
    } else {
      log.error('Categories endpoint failed')
      failed++
    }
  } catch (err) {
    log.error(`Categories endpoint error: ${err.message}`)
    failed++
  }

  // Test 2: Category Search - Safe Response Format
  console.log(`\n${colors.blue}Test 2: Category Search - Response Format${colors.reset}`)
  try {
    const result = await testAPI('GET', '/search/by-category/Biryani')
    if (result.data && 'success' in result.data && Array.isArray(result.data.restaurants)) {
      log.success('Category search response has safe format')
      if (result.data.restaurants.length === 0 && !result.data.message) {
        log.warn('No restaurants found, but message field is present')
      }
      passed++
    } else {
      log.error('Category search response format is invalid')
      failed++
    }
  } catch (err) {
    log.error(`Category search error: ${err.message}`)
    failed++
  }

  // Test 3: Category Search - No Undefined Values
  console.log(`\n${colors.blue}Test 3: Category Search - No Undefined Values${colors.reset}`)
  try {
    const result = await testAPI('GET', '/search/by-category/Biryani')
    const hasUndefined = JSON.stringify(result.data).includes('undefined')
    if (!hasUndefined) {
      log.success('No undefined values in response')
      passed++
    } else {
      log.error('Response contains undefined values')
      failed++
    }
  } catch (err) {
    log.error(`Check failed: ${err.message}`)
    failed++
  }

  // Test 4: Search Endpoint - Returns Restaurants AND Menu Items
  console.log(`\n${colors.blue}Test 4: Search - Returns Both Restaurants & Menu Items${colors.reset}`)
  try {
    const result = await testAPI('GET', '/search?q=biryani')
    if (result.data && Array.isArray(result.data.restaurants) && Array.isArray(result.data.menuItems)) {
      log.success('Search returns both restaurants and menu items')
      passed++
    } else {
      log.error('Search response missing restaurants or menuItems')
      failed++
    }
  } catch (err) {
    log.error(`Search error: ${err.message}`)
    failed++
  }

  // Test 5: Search with Filters - Safe Query Building
  console.log(`\n${colors.blue}Test 5: Search with Filters - Safe Query Building${colors.reset}`)
  try {
    const result = await testAPI('GET', '/search?q=rice&veg=false&maxPrice=300&rating=4')
    if (result.status === 200 && result.data?.success) {
      log.success('Search with multiple filters works safely')
      passed++
    } else {
      log.error('Search with filters failed')
      failed++
    }
  } catch (err) {
    log.error(`Search with filters error: ${err.message}`)
    failed++
  }

  // Summary
  console.log(`\n${colors.blue}╔════════════════════════════════════════════════╗${colors.reset}`)
  console.log(`${colors.blue}║              Validation Summary                ║${colors.reset}`)
  console.log(`${colors.blue}╠════════════════════════════════════════════════╣${colors.reset}`)
  console.log(`${colors.blue}║${colors.reset} Total Tests: ${passed + failed}`)
  console.log(`${colors.blue}║${colors.reset} ${colors.green}Passed: ${passed}${colors.reset}`)
  console.log(`${colors.blue}║${colors.reset} ${passed === 5 ? colors.green : colors.red}Failed: ${failed}${colors.reset}`)
  console.log(`${colors.blue}╚════════════════════════════════════════════════╝${colors.reset}\n`)

  if (failed === 0) {
    log.success('All validations passed! ✓')
    process.exit(0)
  } else {
    log.error(`${failed} validation(s) failed. Please check the API.`)
    process.exit(1)
  }
}

// Run validation
runValidation().catch(err => {
  log.error(`Validation failed: ${err.message}`)
  process.exit(1)
})
