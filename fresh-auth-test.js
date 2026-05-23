const axios = require('axios')

async function test() {
  const testEmail = 'working-' + Date.now() + '@thinava.com'
  const testPass = 'TestPass123!'
  
  console.log('Creating test restaurant with complete data...')
  try {
    const create = await axios.post('http://localhost:5000/api/admin-extended/restaurants/register-manual', {
      restaurantName: 'Working Test Restaurant',
      ownerName: 'Test Owner',
      ownerEmail: testEmail,
      ownerPhone: '9999999999',
      password: testPass,
      address: '123 Main Street',
      city: 'Test City',
      state: 'Test State',
      pincode: '123456',
      cuisineType: 'multi-cuisine',
      deliveryMode: 'both',
      openingTime: '10:00',
      closingTime: '22:00',
      rating: 5.0
    })
    console.log('? Created ID:', create.data.restaurantId)
    
    console.log('\nLogging in...')
    const login = await axios.post('http://localhost:5000/api/restaurant/auth/login', {
      email: testEmail,
      password: testPass
    })
    console.log('? Token:', login.data.token.substring(0,40) + '...')
    console.log('? Name:', login.data.owner.full_name)
  } catch(e) {
    console.log('? Error:', e.response?.data?.error || e.message)
  }
}
test()
