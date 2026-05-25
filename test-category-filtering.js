#!/usr/bin/env node

/**
 * Test Script for Category Filtering & Search
 * Validates new /api/search endpoints
 */

const http = require('http')

const BASE_URL = process.env.API_URL || 'http://localhost:3000/api'

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    console.log(`\n📡 Testing: ${url.toString()}`)
    
    http.get(url.toString(), (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve({ status: res.statusCode, data: json })
        } catch (e) {
          resolve({ status: res.statusCode, data })
        }
      })
    }).on('error', reject)
  })
}

async function runTests() {
  console.log('🧪 Starting Category Filtering Tests...')
  console.log(`   Base URL: ${BASE_URL}`)
  console.log('=' .repeat(60))

  try {
    // Test 1: Get all categories
    console.log('\n✓ Test 1: GET /search/categories')
    const categoriesRes = await makeRequest('/search/categories')
    console.log(`  Status: ${categoriesRes.status}`)
    console.log(`  Categories found: ${categoriesRes.data.categories?.length || 0}`)
    if (categoriesRes.data.categories?.length > 0) {
      console.log(`  Sample: ${categoriesRes.data.categories.slice(0, 3).map(c => c.name).join(', ')}`)
    }

    // Test 2: Filter by Biryani category
    console.log('\n✓ Test 2: GET /search/by-category/biryani')
    const biryaniRes = await makeRequest('/search/by-category/biryani')
    console.log(`  Status: ${biryaniRes.status}`)
    console.log(`  Restaurants found: ${biryaniRes.data.count || 0}`)
    console.log(`  Message: ${biryaniRes.data.message}`)
    if (biryaniRes.data.restaurants?.length > 0) {
      console.log(`  Sample restaurant: ${biryaniRes.data.restaurants[0].name}`)
    }

    // Test 3: Filter by Dosa category
    console.log('\n✓ Test 3: GET /search/by-category/dosa')
    const dosaRes = await makeRequest('/search/by-category/dosa')
    console.log(`  Status: ${dosaRes.status}`)
    console.log(`  Restaurants found: ${dosaRes.data.count || 0}`)
    if (dosaRes.data.restaurants?.length > 0) {
      console.log(`  Sample restaurant: ${dosaRes.data.restaurants[0].name}`)
    }

    // Test 4: Filter by Fried Rice category
    console.log('\n✓ Test 4: GET /search/by-category/fried%20rice')
    const friedRiceRes = await makeRequest('/search/by-category/fried%20rice')
    console.log(`  Status: ${friedRiceRes.status}`)
    console.log(`  Restaurants found: ${friedRiceRes.data.count || 0}`)
    if (friedRiceRes.data.restaurants?.length > 0) {
      console.log(`  Sample restaurant: ${friedRiceRes.data.restaurants[0].name}`)
    }

    // Test 5: Search with query
    console.log('\n✓ Test 5: GET /search?q=biryani')
    const searchRes = await makeRequest('/search?q=biryani')
    console.log(`  Status: ${searchRes.status}`)
    console.log(`  Restaurants found: ${searchRes.data.summary?.restaurantCount || 0}`)
    console.log(`  Menu items found: ${searchRes.data.summary?.menuItemCount || 0}`)

    // Test 6: Error case - empty category
    console.log('\n✓ Test 6: GET /search/by-category/ (invalid)')
    const errorRes = await makeRequest('/search/by-category/')
    console.log(`  Status: ${errorRes.status}`)
    console.log(`  Error: ${errorRes.data.error || 'N/A'}`)

    console.log('\n' + '='.repeat(60))
    console.log('✅ All tests completed!')
    console.log('\n📊 Summary:')
    console.log(`  - Categories found: ${categoriesRes.data.categories?.length || 0}`)
    console.log(`  - Biryani restaurants: ${biryaniRes.data.count || 0}`)
    console.log(`  - Dosa restaurants: ${dosaRes.data.count || 0}`)
    console.log(`  - Fried rice restaurants: ${friedRiceRes.data.count || 0}`)

  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    console.error('\n💡 Make sure the API server is running:')
    console.error('   cd server && npm run dev')
    process.exit(1)
  }
}

runTests()
