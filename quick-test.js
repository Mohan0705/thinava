const axios = require('axios')

async function test() {
  try {
    console.log('Testing POST /api/restaurant/auth/login')
    console.log('Email: admin-created-1779354280271@thinava.com')
    console.log('Password: AdminPass123!\n')
    
    const response = await axios.post('http://localhost:5000/api/restaurant/auth/login', {
      email: 'admin-created-1779354280271@thinava.com',
      password: 'AdminPass123!'
    })
    
    console.log('? LOGIN SUCCESSFUL!')
    console.log('\nResponse:')
    console.log('- Token:', response.data.token.substring(0, 50) + '...')
    console.log('- Owner:', response.data.owner.full_name)
    console.log('- Email:', response.data.owner.email)
    console.log('- Success:', response.data.success)
    
  } catch (error) {
    const status = error.response?.status
    const msg = error.response?.data?.message || error.message
    console.log(`? Login failed with status ${status}: ${msg}`)
  }
}

test()
