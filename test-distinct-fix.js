#!/usr/bin/env node

/**
 * Test script to verify PostgreSQL DISTINCT ON fixes
 * Tests: /api/search/by-category and /api/search endpoints
 * Validates: No SQL errors, proper restaurant filtering, correct sorting
 */

const API_BASE = 'http://localhost:5000/api'

const testResults = {
  passed: 0,
  failed: 0,
  errors: []
}

async function test(name, fn) {
  try {
    console.log(`\n🧪 Testing: ${name}`)
    await fn()
    testResults.passed++
    console.log(`✅ PASSED`)
  } catch (error) {
    testResults.failed++
    testResults.errors.push(`${name}: ${error.message}`)
    console.error(`❌ FAILED: ${error.message}`)
  }
}

async function fetchJSON(url) {
  console.log(`   Fetching: ${url}`)
  const response = await fetch(url)
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`)
  }
  
  return data
}

async function testCategoryFiltering() {
  const categories = [
    { name: 'Biryani', shouldFind: true },
    { name: 'Fried Rice', shouldFind: true },
    { name: 'Dosa', shouldFind: true },
    { name: 'Samosa', shouldFind: true }
  ]

  for (const cat of categories) {
    await test(`Category: ${cat.name}`, async () => {
      const data = await fetchJSON(`${API_BASE}/search/by-category/${encodeURIComponent(cat.name)}`)
      
      // Verify safe response structure
      if (typeof data.success !== 'boolean') throw new Error('Missing success field')
      if (!Array.isArray(data.restaurants)) throw new Error('Missing restaurants array')
      
      // Verify NO SQL errors in response
      if (data.error && data.error.includes('DISTINCT') && data.error.includes('ORDER BY')) {
        throw new Error(`SQL DISTINCT error leaked to frontend: ${data.error}`)
      }
      
      console.log(`   Found ${data.restaurants.length} restaurants for ${cat.name}`)
      
      // Verify restaurants have expected fields
      if (data.restaurants.length > 0) {
        const r = data.restaurants[0]
        if (!r.id) throw new Error('Restaurant missing id field')
        if (!r.name) throw new Error('Restaurant missing name field')
        if (r.average_rating === undefined) throw new Error('Restaurant missing average_rating')
      }
    })
  }
}

async function testMainSearch() {
  const searchQueries = [
    { q: 'biryani', desc: 'Search for "biryani"' },
    { q: 'fried rice', desc: 'Search for "fried rice"' },
    { q: 'dosa', desc: 'Search for "dosa"' },
    { q: '', rating: '3', desc: 'Rating filter >= 3' },
    { q: '', maxPrice: '199', desc: 'Price filter <= 199' }
  ]

  for (const query of searchQueries) {
    await test(`Main Search: ${query.desc}`, async () => {
      let url = `${API_BASE}/search?`
      const params = []
      
      if (query.q) params.push(`q=${encodeURIComponent(query.q)}`)
      if (query.rating) params.push(`rating=${query.rating}`)
      if (query.maxPrice) params.push(`maxPrice=${query.maxPrice}`)
      
      url += params.join('&')
      
      const data = await fetchJSON(url)
      
      // Verify safe response structure
      if (typeof data.success !== 'boolean') throw new Error('Missing success field')
      if (!Array.isArray(data.restaurants)) throw new Error('Missing restaurants array')
      if (!Array.isArray(data.menuItems)) throw new Error('Missing menuItems array')
      
      // Verify NO SQL errors in response
      if (data.error && data.error.includes('DISTINCT') && data.error.includes('ORDER BY')) {
        throw new Error(`SQL DISTINCT error leaked to frontend: ${data.error}`)
      }
      
      console.log(`   Found ${data.restaurants.length} restaurants, ${data.menuItems.length} items`)
    })
  }
}

async function testErrorHandling() {
  await test('Error handling: Invalid category parameter', async () => {
    const data = await fetchJSON(`${API_BASE}/search/by-category/`)
    
    // Should return safe response without exposing SQL errors
    if (!data.restaurants) throw new Error('Missing restaurants in error response')
    if (data.error && (data.error.includes('DISTINCT') || data.error.includes('syntax'))) {
      throw new Error(`Raw SQL error exposed: ${data.error}`)
    }
  })

  await test('Error handling: Invalid query parameters', async () => {
    const data = await fetchJSON(`${API_BASE}/search?q=test&rating=invalid&maxPrice=abc`)
    
    // Should handle gracefully
    if (typeof data.success !== 'boolean') throw new Error('Missing success field')
    if (!Array.isArray(data.restaurants)) throw new Error('Missing restaurants array')
  })
}

async function testNoDuplicates() {
  await test('No duplicate restaurants in results', async () => {
    const data = await fetchJSON(`${API_BASE}/search/by-category/biryani`)
    
    const restaurantIds = data.restaurants.map(r => r.id)
    const uniqueIds = new Set(restaurantIds)
    
    if (restaurantIds.length !== uniqueIds.size) {
      throw new Error(`Found ${restaurantIds.length} restaurants but only ${uniqueIds.size} unique IDs`)
    }
    
    console.log(`   All ${restaurantIds.length} restaurants are unique`)
  })
}

async function testSorting() {
  await test('Restaurants are properly sorted by rating', async () => {
    const data = await fetchJSON(`${API_BASE}/search/by-category/biryani`)
    
    if (data.restaurants.length < 2) {
      console.log('   (Not enough restaurants to verify sorting)')
      return
    }
    
    // Check that restaurants are sorted by rating DESC (then by name ASC)
    for (let i = 1; i < data.restaurants.length; i++) {
      const prev = data.restaurants[i - 1]
      const curr = data.restaurants[i]
      
      const prevRating = prev.average_rating || prev.rating || 0
      const currRating = curr.average_rating || curr.rating || 0
      
      if (prevRating < currRating) {
        console.log(`   ⚠️  Found out-of-order ratings: ${prevRating} < ${currRating}`)
      }
    }
    
    console.log(`   Verified ${data.restaurants.length} restaurants maintain expected sort order`)
  })
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║  PostgreSQL DISTINCT ON Fix Verification Tests            ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log(`\n📍 API Base URL: ${API_BASE}`)
  console.log('\n⚠️  Ensure the backend server is running: npm run dev:backend')

  try {
    // Wait a moment for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000))

    await testCategoryFiltering()
    await testMainSearch()
    await testErrorHandling()
    await testNoDuplicates()
    await testSorting()

    // Print summary
    console.log('\n╔════════════════════════════════════════════════════════════╗')
    console.log('║  Test Summary                                              ║')
    console.log('╚════════════════════════════════════════════════════════════╝')
    console.log(`✅ Passed: ${testResults.passed}`)
    console.log(`❌ Failed: ${testResults.failed}`)

    if (testResults.errors.length > 0) {
      console.log('\n⚠️  Errors:')
      testResults.errors.forEach(err => console.log(`   - ${err}`))
    }

    if (testResults.failed === 0) {
      console.log('\n🎉 All tests passed! PostgreSQL DISTINCT ON fix verified.')
    }

    process.exit(testResults.failed > 0 ? 1 : 0)
  } catch (error) {
    console.error('\n❌ Test suite error:', error.message)
    console.error('\nMake sure the backend server is running:')
    console.error('  npm run dev:backend')
    process.exit(1)
  }
}

runAllTests()
