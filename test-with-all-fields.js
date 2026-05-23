const axios = require('axios')

async function test() {
  const API = 'http://localhost:5000/api'
  const testEmail = 'fulltest-' + Date.now() + '@thinava.com'
  const testPassword = 'TestPass123!'
  
  console.log('Creating restaurant with all required fields...')
  
  try {
    const createRes = await axios.post(`${API}/admin-extended/restaurants/register-manual`, {
      restaurantName: 'Complete Test Restaurant',
      ownerName: 'Complete Test Owner',
      ownerEmail: testEmail,
      ownerPhone: '9876543210',
      address: '456 Complete Street',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
      password: testPassword,
      category: 'multi-cuisine',
      vegNonVeg: 'both',
      latitude: '13.0827',
      longitude: '80.2707',
      openingTime: '09:00',
      closingTime: '23:00',
      deliveryRadius: '10',
      cuisines: ['Multi-Cuisine', 'North Indian'],
      gstNumber: 'GST123456',
      fssaiLicense: 'FSSAI123456'
    })
    
    console.log('? Restaurant created successfully')
    console.log('Restaurant ID:', createRes.data.restaurantId)
    
    // Immediately test login
    console.log('\nTesting login...')
    const loginRes = await axios.post(`${API}/restaurant/auth/login`, {
      email: testEmail,
      password: testPassword
    })
    
    console.log('? LOGIN SUCCESS!')
    console.log('Token:', loginRes.data.token.substring(0, 50) + '...')
    console.log('Owner:', loginRes.data.owner.full_name)
    
  } catch (error) {
    console.log('? Error:', error.response?.data || error.message)
  }
}

test()
