const authService = require('../services/authService')
const passwordResetService = require('../services/passwordResetService')

const login = async (req, res, next) => {
  try {
    const result = await authService.loginRestaurantOwner(req.body)
    res.json({ success: true, ...result })
  } catch (error) {
    next(error)
  }
}

const me = async (req, res, next) => {
  try {
    const owner = await authService.getCurrentRestaurantOwner(req.restaurantOwner.id)
    res.json({ success: true, owner })
  } catch (error) {
    next(error)
  }
}

const refresh = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    const result = await authService.refreshRestaurantOwnerSession(token)
    res.json({ success: true, ...result })
  } catch (error) {
    next(error)
  }
}

const requestPasswordReset = async (req, res, next) => {
  try {
    const result = await passwordResetService.requestPasswordReset(req.body.email)
    res.json(result)
  } catch (error) {
    next(error)
  }
}

const verifyResetToken = async (req, res, next) => {
  try {
    const token = req.query.token || req.params.token
    const result = await passwordResetService.verifyResetToken(token)
    res.json({
      success: true,
      valid: true,
      message: 'Token is valid',
      email: result.email,
      fullName: result.fullName,
    })
  } catch (error) {
    next(error)
  }
}

const confirmPasswordReset = async (req, res, next) => {
  try {
    const { token, newPassword, confirmPassword } = req.body
    const result = await passwordResetService.resetPassword(token, newPassword, confirmPassword)
    res.json(result)
  } catch (error) {
    next(error)
  }
}

module.exports = {
  confirmPasswordReset,
  login,
  me,
  requestPasswordReset,
  refresh,
  verifyResetToken,
}
