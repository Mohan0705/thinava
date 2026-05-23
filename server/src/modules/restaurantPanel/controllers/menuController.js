const menuService = require('../services/menuService')

const emitMenuUpdate = (req, type, action, data) => {
  const io = req.app?.get?.('io')
  if (io && req.restaurantOwner?.restaurantId) {
    io.to(`restaurant:${req.restaurantOwner.restaurantId}`).emit('menuUpdated', { type, action, data })
  }
}

const listMenuItems = async (req, res, next) => {
  try {
    const menuItems = await menuService.listMenuItems(req.restaurantOwner.restaurantId)
    res.json({ success: true, menuItems })
  } catch (error) {
    next(error)
  }
}

const createMenuItem = async (req, res, next) => {
  try {
    const menuItem = await menuService.createMenuItem(req.restaurantOwner.restaurantId, req.body)
    emitMenuUpdate(req, 'item', 'created', menuItem)
    res.status(201).json({ success: true, menuItem })
  } catch (error) {
    next(error)
  }
}

const updateMenuItem = async (req, res, next) => {
  try {
    const menuItem = await menuService.updateMenuItem(
      req.restaurantOwner.restaurantId,
      req.params.menuItemId,
      req.body
    )
    emitMenuUpdate(req, 'item', 'updated', menuItem)
    res.json({ success: true, menuItem })
  } catch (error) {
    next(error)
  }
}

const updateStock = async (req, res, next) => {
  try {
    const menuItem = await menuService.updateMenuItemStock(
      req.restaurantOwner.restaurantId,
      req.params.menuItemId,
      req.body.in_stock
    )
    emitMenuUpdate(req, 'item', 'stock', menuItem)
    res.json({ success: true, menuItem })
  } catch (error) {
    next(error)
  }
}

const deleteMenuItem = async (req, res, next) => {
  try {
    await menuService.deleteMenuItem(req.restaurantOwner.restaurantId, req.params.menuItemId)
    emitMenuUpdate(req, 'item', 'deleted', { id: req.params.menuItemId })
    res.json({ success: true, message: 'Menu item deleted successfully' })
  } catch (error) {
    next(error)
  }
}

// Variant handlers
const createVariant = async (req, res, next) => {
  try {
    const variant = await menuService.createVariant(
      req.restaurantOwner.restaurantId,
      req.params.menuItemId,
      req.body
    )
    emitMenuUpdate(req, 'variant', 'created', variant)
    res.status(201).json({ success: true, variant })
  } catch (error) {
    next(error)
  }
}

const updateVariant = async (req, res, next) => {
  try {
    const variant = await menuService.updateVariant(
      req.restaurantOwner.restaurantId,
      req.params.menuItemId,
      req.params.variantId,
      req.body
    )
    emitMenuUpdate(req, 'variant', 'updated', variant)
    res.json({ success: true, variant })
  } catch (error) {
    next(error)
  }
}

const deleteVariant = async (req, res, next) => {
  try {
    await menuService.deleteVariant(
      req.restaurantOwner.restaurantId,
      req.params.menuItemId,
      req.params.variantId
    )
    emitMenuUpdate(req, 'variant', 'deleted', { id: req.params.variantId })
    res.json({ success: true, message: 'Variant deleted' })
  } catch (error) {
    next(error)
  }
}

// Addon handlers
const createAddon = async (req, res, next) => {
  try {
    const addon = await menuService.createAddon(
      req.restaurantOwner.restaurantId,
      req.params.menuItemId,
      req.body
    )
    emitMenuUpdate(req, 'addon', 'created', addon)
    res.status(201).json({ success: true, addon })
  } catch (error) {
    next(error)
  }
}

const updateAddon = async (req, res, next) => {
  try {
    const addon = await menuService.updateAddon(
      req.restaurantOwner.restaurantId,
      req.params.menuItemId,
      req.params.addonId,
      req.body
    )
    emitMenuUpdate(req, 'addon', 'updated', addon)
    res.json({ success: true, addon })
  } catch (error) {
    next(error)
  }
}

const deleteAddon = async (req, res, next) => {
  try {
    await menuService.deleteAddon(
      req.restaurantOwner.restaurantId,
      req.params.menuItemId,
      req.params.addonId
    )
    emitMenuUpdate(req, 'addon', 'deleted', { id: req.params.addonId })
    res.json({ success: true, message: 'Addon deleted' })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  createMenuItem,
  deleteMenuItem,
  listMenuItems,
  updateMenuItem,
  updateStock,
  createVariant,
  updateVariant,
  deleteVariant,
  createAddon,
  updateAddon,
  deleteAddon,
}
