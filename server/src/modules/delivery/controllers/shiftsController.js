const shiftService = require('../services/shiftService')

const listShifts = async (req, res, next) => {
  try {
    const shifts = await shiftService.listShifts(req.deliveryPartner.id)

    res.json({
      success: true,
      shifts,
    })
  } catch (error) {
    next(error)
  }
}

const bookShift = async (req, res, next) => {
  try {
    const shift = await shiftService.bookShift(req.deliveryPartner.id, req.body)

    res.status(201).json({
      success: true,
      shift,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  bookShift,
  listShifts,
}
