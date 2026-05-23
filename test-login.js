const axios = require('axios')

const API_URL = 'http://localhost:5000/api'

async function testLogin() {
  try {
    console.log('Testing restaurant login flow...\n')
    
    // Test 1: Try to login with known admin-created restaurant
    console.log('Test 1: Login with admin-created restaurant')
    const email = 'naveenfoods@gmail.com'
    const password = 'AdminTest123'
    
    const response = await axios.post(`${API_URL}/restaurant/auth/login`, {
      email,
      password
    })
    
    console.log('? Login successful!')
    console.log('Token:', response.data.token.substring(0, 50) + '...')
    console.log('Owner:', response.data.owner.full_name)
    
  } catch (error) {
    const msg = error.response?.data?.error || error.message
    console.log('? Login failed:', msg)
  }
}

testLogin()
