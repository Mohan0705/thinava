const axios = require("axios")

async function test() {
  try {
    const res = await axios.post("http://localhost:5000/api/restaurant/auth/login", {
      email: "browsertest-1779357185497@thinava.com",
      password: "BrowserTest123!"
    })
    
    if (res.data.success) {
      console.log("? Endpoint responds successfully!")
      console.log("Token:", res.data.token.substring(0, 40) + "...")
      console.log("Owner:", res.data.owner.full_name)
    } else {
      console.log("? Endpoint returned:", res.data)
    }
  } catch(e) {
    console.log("? Error:", e.response?.data || e.message)
  }
}

test()
