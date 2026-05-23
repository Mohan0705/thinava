const authService = require('../services/authService')

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

module.exports = {
  login,
  me,
  refresh,
}
