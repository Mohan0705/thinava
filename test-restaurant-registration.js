#!/usr/bin/env node

/**
 * Comprehensive THINAVA Restaurant Registration Flow Test
 * Tests all critical flows:
 * 1. Restaurant Signup
 * 2. Admin Manual Registration  
 * 3. Verification
 */

const axios = require('axios')

const BASE_URL = 'http://localhost:5000/api'

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

const log = {
  test: (msg) => console.log(`${colors.cyan}📝 TEST${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅ SUCCESS${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌ ERROR${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  INFO${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.yellow}${'='.repeat(60)}${colors.reset}\n${colors.yellow}${msg}${colors.reset}\n${colors.yellow}${'='.repeat(60)}${colors.reset}\n`)
}

async function testRestaurantSignup() {
  log.section('TEST 1: Restaurant Signup Flow')
  
  const restaurantData = {
    restaurantName: `Test Restaurant ${Date.now()}`,
    ownerName: 'John Test Owner',
    ownerPhone: '9876543210',
    ownerEmail: `test-signup-${Date.now()}@thinava.com`,
    password: 'SecurePass123!',
    confirmPassword: 'SecurePass123!',
    address: '123 Restaurant Street',
    latitude: '17.3850',
    longitude: '78.4867',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500001',
    category: 'multi-cuisine',
    vegNonVeg: 'both',
    openingTime: '10:00',
    closingTime: '22:00',
    deliveryRadius: '5',
    gstNumber: 'TEST123GST',
    fssaiLicense: 'TEST123FSSAI'
  }

  try {
    log.test(`Submitting restaurant signup with email: ${restaurantData.ownerEmail}`)
    
    const response = await axios.post(
      `${BASE_URL}/restaurant-auth/register`,
      restaurantData,
      { timeout: 10000 }
    )

    if (response.data.success) {
      log.success(`Restaurant signup completed`)
      log.info(`Response: ${JSON.stringify(response.data, null, 2)}`)
      return {
        success: true,
        restaurantId: response.data.restaurantId,
        email: restaurantData.ownerEmail,
        password: restaurantData.password
      }
    } else {
      log.error(`Signup failed: ${response.data.error}`)
      return { success: false, error: response.data.error }
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message
    log.error(`Signup request failed: ${errorMsg}`)
    log.info(`Full error:${JSON.stringify({
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    }, null, 2)}`)
    return { success: false, error: errorMsg }
  }
}

async function testRestaurantLogin(email, password) {
  log.section('TEST 2: Restaurant Login (Should Fail - Pending Approval)')
  
  try {
    log.test(`Attempting login with email: ${email}`)
    
    const response = await axios.post(
      `${BASE_URL}/restaurant-auth/login`,
      { email, password },
      { timeout: 10000, validateStatus: () => true }
    )

    if (response.status === 403 && response.data.status === 'PENDING_APPROVAL') {
      log.success(`Correctly blocked login - Restaurant status is PENDING_APPROVAL`)
      log.info(`Response: ${response.data.error}`)
      return { success: true, blocked: true }
    } else if (response.data.success) {
      log.error(`Login should have been blocked but succeeded!`)
      return { success: false, error: 'Login not blocked for pending restaurant' }
    } else {
      log.error(`Login failed as expected: ${response.data.error}`)
      return { success: true, blocked: true }
    }
  } catch (error) {
    log.error(`Login test failed: ${error.message}`)
    return { success: false, error: error.message }
  }
}

async function testAdminManualRegistration() {
  log.section('TEST 3: Admin Manual Restaurant Creation')
  
  const adminToken = process.env.ADMIN_TOKEN || 'test-admin-token'
  
  const restaurantData = {
    restaurantName: `Manual Test Restaurant ${Date.now()}`,
    ownerName: 'Admin Created Owner',
    ownerPhone: '9123456789',
    ownerEmail: `admin-created-${Date.now()}@thinava.com`,
    address: '456 Admin Street',
    latitude: '17.3850',
    longitude: '78.4867',
    cuisines: ['Multi-Cuisine', 'Chinese'],
    password: 'AdminPass123!'
  }

  try {
    log.test(`Creating restaurant via admin endpoint: ${restaurantData.restaurantName}`)
    
    const response = await axios.post(
      `${BASE_URL}/admin-extended/restaurants/register-manual`,
      restaurantData,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        timeout: 10000,
        validateStatus: () => true
      }
    )

    if (response.status === 201 && response.data.success) {
      log.success(`Admin manual registration successful`)
      log.info(`Status: ${response.data.status}`)
      log.info(`Restaurant ID: ${response.data.restaurantId}`)
      log.info(`Response: ${JSON.stringify(response.data, null, 2)}`)
      
      // Now try to login with the created restaurant
      return {
        success: true,
        restaurantId: response.data.restaurantId,
        email: restaurantData.ownerEmail,
        password: restaurantData.password,
        isApproved: response.data.status === 'APPROVED' || response.data.status === 'ACTIVE'
      }
    } else {
      const errorMsg = response.data.error || 'Unknown error'
      log.error(`Manual registration failed: ${errorMsg}`)
      log.info(`Status: ${response.status}, Data: ${JSON.stringify(response.data)}`)
      return { success: false, error: errorMsg }
    }
  } catch (error) {
    log.error(`Manual registration request failed: ${error.message}`)
    return { success: false, error: error.message }
  }
}

async function testAdminApprovedRestaurantLogin(email, password) {
  log.section('TEST 4: Admin-Created Restaurant Login (Should Succeed)')
  
  try {
    log.test(`Attempting login with admin-created restaurant email: ${email}`)
    
    const response = await axios.post(
      `${BASE_URL}/restaurant-auth/login`,
      { email, password },
      { timeout: 10000, validateStatus: () => true }
    )

    if (response.data.success) {
      log.success(`Admin-created restaurant login successful`)
      log.info(`Token: ${response.data.token?.substring(0, 20)}...`)
      log.info(`User: ${response.data.user?.fullName}`)
      return { success: true, token: response.data.token }
    } else {
      log.error(`Login failed: ${response.data.error}`)
      return { success: false, error: response.data.error }
    }
  } catch (error) {
    log.error(`Login request failed: ${error.message}`)
    return { success: false, error: error.message }
  }
}

async function runAllTests() {
  console.log(`${colors.cyan}${colors.blue}
╔═══════════════════════════════════════════════════════════╗
║   THINAVA Restaurant Registration System - Test Suite     ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}\n`)

  const results = {
    test1_signup: null,
    test2_login_pending: null,
    test3_admin_manual: null,
    test4_admin_login: null
  }

  // TEST 1: Signup
  results.test1_signup = await testRestaurantSignup()
  
  // TEST 2: Try login (should be blocked)
  if (results.test1_signup.success) {
    results.test2_login_pending = await testRestaurantLogin(
      results.test1_signup.email,
      results.test1_signup.password
    )
  }

  // TEST 3: Admin manual creation
  results.test3_admin_manual = await testAdminManualRegistration()

  // TEST 4: Try login with admin-created restaurant
  if (results.test3_admin_manual.success && results.test3_admin_manual.isApproved) {
    results.test4_admin_login = await testAdminApprovedRestaurantLogin(
      results.test3_admin_manual.email,
      results.test3_admin_manual.password
    )
  }

  // Print summary
  log.section('TEST SUMMARY')
  
  const allPassed = Object.values(results).every(r => r?.success)
  
  console.log(`Test 1 - Restaurant Signup: ${results.test1_signup?.success ? colors.green + '✅ PASS' : colors.red + '❌ FAIL'}${colors.reset}`)
  console.log(`Test 2 - Login (Pending): ${results.test2_login_pending?.success ? colors.green + '✅ PASS' : colors.red + '❌ FAIL'}${colors.reset}`)
  console.log(`Test 3 - Admin Manual: ${results.test3_admin_manual?.success ? colors.green + '✅ PASS' : colors.red + '❌ FAIL'}${colors.reset}`)
  console.log(`Test 4 - Approved Login: ${results.test4_admin_login?.success ? colors.green + '✅ PASS' : colors.red + '❌ FAIL'}${colors.reset}`)
  
  console.log(`\n${allPassed ? colors.green + '🎉 ALL TESTS PASSED!' : colors.red + '⚠️  SOME TESTS FAILED'}${colors.reset}`)
  
  return { allPassed, results }
}

// Run tests
runAllTests().then(result => {
  process.exit(result.allPassed ? 0 : 1)
}).catch(err => {
  console.error('Test suite error:', err)
  process.exit(1)
})
