const axios = require("axios")

async function createTestAccount() {
  const testEmail = "browsertest-" + Date.now() + "@thinava.com"
  const testPassword = "BrowserTest123!"
  
  try {
    const res = await axios.post("http://localhost:5000/api/admin-extended/restaurants/register-manual", {
      restaurantName: "Browser Test Restaurant",
      ownerName: "Browser Test Owner",
      ownerEmail: testEmail,
      ownerPhone: "9876543210",
      password: testPassword,
      address: "123 Test Avenue",
      city: "Test City",
      state: "Test State",
      pincode: "123456",
      latitude: "13.0827",
      longitude: "80.2707",
      openingTime: "09:00",
      closingTime: "23:00",
      deliveryRadius: "10",
      cuisines: ["Multi-Cuisine"],
      gstNumber: "GST123456",
      fssaiLicense: "FSSAI123456"
    })
    
    console.log("? ACCOUNT CREATED")
    console.log("Email:", testEmail)
    console.log("Password:", testPassword)
  } catch(e) {
    console.log("? Error:", e.response?.data?.error || e.message)
  }
}

createTestAccount()
