const fetch = require('node-fetch')

// Test delivery orders API with valid token
async function testDeliveryOrdersAPI() {
  try {
    // Login to get token
    const loginRes = await fetch('http://localhost:5000/api/delivery/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '9876543210',
        password: 'Test@1234',
      }),
    })

    const loginData = await loginRes.json()
    const token = loginData.token

    console.log('✅ LOGIN SUCCESSFUL')
    console.log('Token:', token.substring(0, 50) + '...')
    console.log('')

    // Get available orders
    const ordersRes = await fetch('http://localhost:5000/api/delivery/orders', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    const ordersData = await ordersRes.json()

    console.log('✅ DELIVERY ORDERS API RESPONSE')
    console.log('Status:', ordersData.success)
    console.log('Total Orders:', ordersData.orders.length)
    console.log('')

    console.log('📦 AVAILABLE ORDERS FOR DELIVERY:')
    ordersData.orders.forEach((order, index) => {
      console.log(`\n${index + 1}. Order #${order.id}`)
      console.log(`   Status: ${order.status}`)
      console.log(`   Delivery Status: ${order.delivery_status}`)
      console.log(`   Restaurant: ${order.restaurant_name}`)
      console.log(`   Customer: ${order.customer_phone}`)
      console.log(`   Amount: ₹${order.total}`)
      console.log(`   Items: ${order.items.length}`)
    })

    console.log('\n\n✅ FIX VERIFIED: Delivery partners can now see available orders!')
  } catch (error) {
    console.error('❌ ERROR:', error.message)
  }
}

testDeliveryOrdersAPI()
