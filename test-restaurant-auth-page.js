const axios = require('axios')

async function simulateBrowserLogin() {
  // Use the account we just successfully created
  const email = 'fulltest-1779354289234@thinava.com'
  const password = 'TestPass123!'
  
  console.log('?? Simulating /restaurant-auth page form submission')
  console.log('Email:', email)
  console.log('Password:', password)
  console.log('')
  
  try {
    console.log('Step 1: Frontend calls restaurantPanelApi.login()')
    console.log('  -> Which calls POST /api/restaurant/auth/login')
    console.log('')
    
    const response = await axios.post('http://localhost:5000/api/restaurant/auth/login', {
      email: email,
      password: password
    })
    
    console.log('? SUCCESS! Page received response:')
    console.log('  - success:', response.data.success)
    console.log('  - token:', response.data.token.substring(0, 50) + '...')
    console.log('  - owner:', response.data.owner.full_name)
    console.log('  - email:', response.data.owner.email)
    console.log('')
    console.log('Frontend would now:')
    console.log('  1. Call setSession() with owner and token')
    console.log('  2. Show toast: "Welcome back, ' + response.data.owner.full_name + '"')
    console.log('  3. Redirect to /restaurant/dashboard')
    
  } catch (error) {
    const status = error.response?.status
    const msg = error.response?.data?.message || error.message
    console.log(`? FAILED with status ${status}: ${msg}`)
  }
}

simulateBrowserLogin()
