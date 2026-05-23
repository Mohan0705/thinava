const { verifyRiderToken } = require('../../../lib/auth/tokenService')
const { logger } = require('../../../lib/logger')

const authenticateDeliveryPartner = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
        code: 'NO_TOKEN',
      })
    }

    const decoded = verifyRiderToken(token)

    req.deliveryPartner = {
      id: decoded.sub,
      email: decoded.email,
      phone: decoded.phone,
      full_name: decoded.fullName,
    }

    logger.debug('Delivery partner authenticated', {
      tag: 'auth',
      riderId: decoded.sub,
      requestId: req.id,
    })

    next()
  } catch (error) {
    logger.warn('Delivery partner auth failed', {
      tag: 'auth',
      error: error.message,
      requestId: req?.id,
    })
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
    })
  }
}

module.exports = {
  authenticateDeliveryPartner,
}
