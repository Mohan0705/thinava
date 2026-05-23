const axios = require('axios')

async function test() {
  try {
    // These are from the admin manual creation - password is AdminTest123 but we need to verify
    console.log('Testing with email: admin-created-1779354280271@thinava.com')
    
    // Try with the password used in admin creation
    const response = await axios.post('http://localhost:5000/api/restaurant/auth/login', {
      email: 'admin-created-1779354280271@thinava.com',
      password: 'AdminTest123'
    })
    
    console.log('? Login successful!')
    console.log('Token:', response.data.token.substring(0, 50) + '...')
    console.log('Owner:', response.data.owner.full_name)
    
  } catch (error) {
    const status = error.response?.status
    const msg = error.response?.data?.message || error.message
    console.log(`? Failed with status ${status}: ${msg}`)
    
    // Try with a different password
    if (status === 401) {
      console.log('\nTrying with different password...')
      try {
        const response2 = await axios.post('http://localhost:5000/api/restaurant/auth/login', {
          email: 'admin-created-1779354280271@thinava.com',
          password: 'Test123456'
        })
        console.log('? Login successful with password: Test123456')
      } catch (e2) {
        console.log('? Still failed')
      }
    }
  }
}

test()
