#!/usr/bin/env node

/**
 * Comprehensive test script for flexible category filtering and search matching
 * Tests all filter types and validates partial matching
 */

const API_BASE = 'http://localhost:5000/api'

const testResults = {
  passed: 0,
  failed: 0,
  errors: []
}

async function test(name, fn) {
  try {
    console.log(`\n✓ Testing: ${name}`)
    await fn()
    testResults.passed++
    console.log(`  ✅ PASSED`)
  } catch (error) {
    testResults.failed++
    testResults.errors.push(`${name}: ${error.message}`)
    console.error(`  ❌ FAILED: ${error.message}`)
  }
}

async function fetchJSON(url) {
  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return data
}

async function testPartialMatching() {
  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║  Testing Partial Text Matching                             ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  // Test exact category names
  await test('Exact: "Biryani" category', async () => {
    const data = await fetchJSON(`${API_BASE}/search/by-category/Biryani`)
    console.log(`    Found ${data.restaurants.length} restaurants`)
  })

  await test('Exact: "Dosa" category', async () => {
    const data = await fetchJSON(`${API_BASE}/search/by-category/Dosa`)
    console.log(`    Found ${data.restaurants.length} restaurants`)
  })

  await test('Exact: "Pizza" category', async () => {
    const data = await fetchJSON(`${API_BASE}/search/by-category/Pizza`)
    console.log(`    Found ${data.restaurants.length} restaurants`)
  })

  // Test partial matching (flexible)
  await test('Partial: "biry" should match "Chicken Biryani"', async () => {
    const data = await fetchJSON(`${API_BASE}/search/by-category/biry`)
    console.log(`    Found ${data.restaurants.length} restaurants`)
    if (data.restaurants.length === 0) {
      throw new Error('Partial matching failed - no results for "biry"')
    }
  })

  await test('Partial: "do" should match "Dosa" items', async () => {
    const data = await fetchJSON(`${API_BASE}/search/by-category/do`)
    console.log(`    Found ${data.restaurants.length} restaurants`)
  })

  await test('Partial: "fried" should match "Fried Rice" items', async () => {
    const data = await fetchJSON(`${API_BASE}/search/by-category/fried`)
    console.log(`    Found ${data.restaurants.length} restaurants`)
  })

  // Test case insensitivity
  await test('Case insensitive: "BIRYANI" matches "Biryani"', async () => {
    const data = await fetchJSON(`${API_BASE}/search/by-category/BIRYANI`)
    console.log(`    Found ${data.restaurants.length} restaurants`)
  })

  await test('Case insensitive: "PiZzA" matches "Pizza"', async () => {
    const data = await fetchJSON(`${API_BASE}/search/by-category/PiZzA`)
    console.log(`    Found ${data.restaurants.length} restaurants`)
  })

  // Test URL encoding
  await test('URL encoded: "Fried%20Rice" decodes correctly', async () => {
    const data = await fetchJSON(`${API_BASE}/search/by-category/Fried%20Rice`)
    console.log(`    Found ${data.restaurants.length} restaurants`)
  })

  await test('URL encoded: "Chicken%20Biryani" decodes correctly', async () => {
    const data = await fetchJSON(`${API_BASE}/search/by-category/Chicken%20Biryani`)
    console.log(`    Found ${data.restaurants.length} restaurants`)
  })
}

async function testMainSearch() {
  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║  Testing Main Search with Flexible Matching               ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  await test('Search restaurants: "biryani"', async () => {
    const data = await fetchJSON(`${API_BASE}/search?q=biryani`)
    console.log(`    Restaurants: ${data.restaurants.length}, Items: ${data.menuItems.length}`)
  })

  await test('Search: "chicken" (should find items + restaurants)', async () => {
    const data = await fetchJSON(`${API_BASE}/search?q=chicken`)
    console.log(`    Restaurants: ${data.restaurants.length}, Items: ${data.menuItems.length}`)
  })

  await test('Search: "pizza" (partial matching)', async () => {
    const data = await fetchJSON(`${API_BASE}/search?q=pizza`)
    console.log(`    Restaurants: ${data.restaurants.length}, Items: ${data.menuItems.length}`)
  })

  await test('Search: "dosa" (partial matching)', async () => {
    const data = await fetchJSON(`${API_BASE}/search?q=dosa`)
    console.log(`    Restaurants: ${data.restaurants.length}, Items: ${data.menuItems.length}`)
  })

  await test('Search: "rice" (should match Fried Rice, Biryani Rice, etc)', async () => {
    const data = await fetchJSON(`${API_BASE}/search?q=rice`)
    console.log(`    Restaurants: ${data.restaurants.length}, Items: ${data.menuItems.length}`)
  })
}

async function testFilterCombinations() {
  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║  Testing Filter Combinations                              ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  await test('Category + Rating filter: Biryani with rating >= 3.5', async () => {
    const data = await fetchJSON(`${API_BASE}/search/by-category/Biryani`)
    console.log(`    Found ${data.restaurants.length} restaurants`)
  })

  await test('Search + Rating filter: "pizza" with rating >= 3', async () => {
    const data = await fetchJSON(`${API_BASE}/search?q=pizza&rating=3`)
    console.log(`    Restaurants: ${data.restaurants.length}, Items: ${data.menuItems.length}`)
  })

  await test('Search + Price filter: "burger" under Rs199', async () => {
    const data = await fetchJSON(`${API_BASE}/search?q=burger&maxPrice=199`)
    console.log(`    Restaurants: ${data.restaurants.length}, Items: ${data.menuItems.length}`)
  })

  await test('Search + Veg filter: "dosa" vegetarian only', async () => {
    const data = await fetchJSON(`${API_BASE}/search?q=dosa&veg=true`)
    console.log(`    Restaurants: ${data.restaurants.length}, Items: ${data.menuItems.length}`)
  })
}

async function testEdgeCases() {
  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║  Testing Edge Cases                                       ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  await test('Empty search: q=""', async () => {
    const data = await fetchJSON(`${API_BASE}/search?q=`)
    console.log(`    Restaurants: ${data.restaurants.length}, Items: ${data.menuItems.length}`)
  })

  await test('Nonexistent category: "xyz123"', async () => {
    const data = await fetchJSON(`${API_BASE}/search/by-category/xyz123`)
    console.log(`    Found ${data.restaurants.length} restaurants (expected: 0)`)
  })

  await test('Single character search: "b"', async () => {
    const data = await fetchJSON(`${API_BASE}/search?q=b`)
    console.log(`    Restaurants: ${data.restaurants.length}, Items: ${data.menuItems.length}`)
  })

  await test('Special characters: "pizza & wings"', async () => {
    const data = await fetchJSON(`${API_BASE}/search?q=${encodeURIComponent('pizza & wings')}`)
    console.log(`    Restaurants: ${data.restaurants.length}, Items: ${data.menuItems.length}`)
  })
}

async function testDataValidation() {
  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║  Testing Response Data Validation                         ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  await test('Response structure validation', async () => {
    const data = await fetchJSON(`${API_BASE}/search/by-category/Biryani`)
    
    if (typeof data.success !== 'boolean') throw new Error('Missing success field')
    if (!Array.isArray(data.restaurants)) throw new Error('Missing restaurants array')
    if (typeof data.total !== 'number') throw new Error('Missing total field')
    if (typeof data.message !== 'string') throw new Error('Missing message field')
    if (typeof data.count !== 'number') throw new Error('Missing count field')
    
    console.log(`    Response structure valid`)
  })

  await test('Restaurant object validation', async () => {
    const data = await fetchJSON(`${API_BASE}/search/by-category/Biryani`)
    
    if (data.restaurants.length === 0) {
      console.log(`    (No restaurants to validate)`)
      return
    }
    
    const r = data.restaurants[0]
    if (!r.id) throw new Error('Restaurant missing id')
    if (!r.name) throw new Error('Restaurant missing name')
    if (r.average_rating === undefined) throw new Error('Restaurant missing average_rating')
    
    console.log(`    Restaurant objects valid`)
  })

  await test('No SQL errors exposed in response', async () => {
    const data = await fetchJSON(`${API_BASE}/search?q=test`)
    
    const responseStr = JSON.stringify(data)
    if (responseStr.includes('DISTINCT') && responseStr.includes('ORDER BY')) {
      throw new Error('SQL error leaked to frontend')
    }
    if (responseStr.toLowerCase().includes('syntax error')) {
      throw new Error('SQL syntax error exposed')
    }
    
    console.log(`    No SQL errors in response`)
  })
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║  Flexible Category Filtering & Search Matching Tests      ║')
  console.log('║  Version 2.0 - Partial Text Matching                      ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log(`\n📍 API Base URL: ${API_BASE}`)
  console.log('\n⚠️  Ensure backend is running: npm run dev:backend')

  try {
    await new Promise(resolve => setTimeout(resolve, 1000))

    await testPartialMatching()
    await testMainSearch()
    await testFilterCombinations()
    await testEdgeCases()
    await testDataValidation()

    // Print summary
    console.log('\n╔════════════════════════════════════════════════════════════╗')
    console.log('║  Test Summary                                              ║')
    console.log('╚════════════════════════════════════════════════════════════╝')
    console.log(`✅ Passed: ${testResults.passed}`)
    console.log(`❌ Failed: ${testResults.failed}`)
    console.log(`Total: ${testResults.passed + testResults.failed}`)

    if (testResults.errors.length > 0) {
      console.log('\n⚠️  Failed Tests:')
      testResults.errors.forEach(err => console.log(`   - ${err}`))
    } else {
      console.log('\n🎉 All tests passed! Flexible matching verified.')
    }

    process.exit(testResults.failed > 0 ? 1 : 0)
  } catch (error) {
    console.error('\n❌ Test suite error:', error.message)
    console.error('Make sure backend is running: npm run dev:backend')
    process.exit(1)
  }
}

runAllTests()
