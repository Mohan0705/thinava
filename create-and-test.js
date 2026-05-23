const axios = require('axios')

async function test() {
  const API = 'http://localhost:5000/api'
  const testEmail = 'freshtest-' + Date.now() + '@thinava.com'
  const testPassword = 'TestPass123!'
  
  console.log('?? Step 1: Create restaurant via admin endpoint')
  console.log('Email:', testEmail)
  console.log('Password:', testPassword)
  
  try {
    const createRes = await axios.post(`${API}/admin-extended/restaurants/register-manual`, {
      restaurantName: 'Fresh Test Restaurant',
      ownerName: 'Test Owner',
      ownerEmail: testEmail,
      ownerPhone: '9999999999',
      address: '123 Test Street',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500001',
      password: testPassword,
      category: 'multi-cuisine',
      vegNonVeg: 'both'
    })
    
    console.log('? Restaurant created successfully')
    console.log('Restaurant ID:', createRes.data.restaurantId)
    console.log('Status:', createRes.data.status)
    
    // Now immediately test login
    console.log('\n?? Step 2: Attempt login right after creation')
    console.log('Calling: POST /api/restaurant/auth/login')
    
    const loginRes = await axios.post(`${API}/restaurant/auth/login`, {
      email: testEmail,
      password: testPassword
    })
    
    console.log('? LOGIN SUCCESSFUL!')
    console.log('Token:', loginRes.data.token.substring(0, 50) + '...')
    console.log('Owner:', loginRes.data.owner.full_name)
    
  } catch (error) {
    const status = error.response?.status
    const msg = error.response?.data?.message || error.message
    console.log(`? Error (status ${status}): ${msg}`)
    console.log('\nFull error:', error.response?.data)
  }
}

test()
