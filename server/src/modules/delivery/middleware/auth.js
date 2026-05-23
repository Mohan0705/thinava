const jwt = require('jsonwebtoken')

const authenticateDeliveryPartner = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]

    if (!token) {
      return res.status(401).json({
        error: 'No token provided',
        status: 401,
      })
    }

    const decoded = jwt.verify(token, process.env.DELIVERY_JWT_SECRET || 'delivery-secret-key')

    req.deliveryPartner = {
      id: decoded.id,
      email: decoded.email,
      phone: decoded.phone,
      full_name: decoded.full_name,
    }

    next()
  } catch (error) {
    res.status(401).json({
      error: 'Invalid or expired token',
      status: 401,
    })
  }
}

module.exports = {
  authenticateDeliveryPartner,
}
