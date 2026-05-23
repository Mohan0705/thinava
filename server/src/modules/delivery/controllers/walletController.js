const walletService = require('../services/walletService')
const supportService = require('../services/supportService')

const getWallet = async (req, res, next) => {
  try {
    const wallet = await walletService.getWallet(req.deliveryPartner.id)
    res.json({ success: true, wallet })
  } catch (error) {
    next(error)
  }
}

const getFloatingCashStatus = async (req, res, next) => {
  try {
    const status = await walletService.getFloatingCashStatus(req.deliveryPartner.id)
    res.json({ success: true, ...status })
  } catch (error) {
    next(error)
  }
}

const requestCashPickup = async (req, res, next) => {
  try {
    const { notes } = req.body
    const result = await walletService.requestCashPickup(req.deliveryPartner.id, notes)
    await supportService.notifyAdminCashPickupRequest(req.deliveryPartner.id, result.id, result.amount)
    res.json({ success: true, request: result })
  } catch (error) {
    next(error)
  }
}

const getCashPickupRequests = async (req, res, next) => {
  try {
    const requests = await walletService.getCashPickupRequests(req.deliveryPartner.id)
    res.json({ success: true, requests })
  } catch (error) {
    next(error)
  }
}

const getSupportInfo = async (req, res, next) => {
  try {
    const info = await supportService.getSupportInfo()
    res.json({ success: true, ...info })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getWallet,
  getFloatingCashStatus,
  requestCashPickup,
  getCashPickupRequests,
  getSupportInfo,
}
