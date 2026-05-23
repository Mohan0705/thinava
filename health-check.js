const axios = require('axios')
axios.get('http://localhost:5000/api/health', { timeout: 2000 })
  .then(() => console.log('? Server is running'))
  .catch(() => console.log('? Server is NOT running'))
