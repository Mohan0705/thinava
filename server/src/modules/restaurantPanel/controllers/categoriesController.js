const categoryService = require('../services/categoryService')

const listCategories = async (req, res, next) => {
  try {
    const categories = await categoryService.listCategories(req.restaurantOwner.restaurantId)
    res.json({ success: true, categories })
  } catch (error) {
    next(error)
  }
}

const createCategory = async (req, res, next) => {
  try {
    const category = await categoryService.createCategory(req.restaurantOwner.restaurantId, req.body)
    res.status(201).json({ success: true, category })
  } catch (error) {
    next(error)
  }
}

const updateCategory = async (req, res, next) => {
  try {
    const category = await categoryService.updateCategory(
      req.restaurantOwner.restaurantId,
      req.params.categoryId,
      req.body
    )
    res.json({ success: true, category })
  } catch (error) {
    next(error)
  }
}

const reorderCategories = async (req, res, next) => {
  try {
    const categories = await categoryService.reorderCategories(
      req.restaurantOwner.restaurantId,
      req.body.category_ids
    )
    res.json({ success: true, categories })
  } catch (error) {
    next(error)
  }
}

const deleteCategory = async (req, res, next) => {
  try {
    await categoryService.deleteCategory(req.restaurantOwner.restaurantId, req.params.categoryId)
    res.json({ success: true, message: 'Category deleted successfully' })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  createCategory,
  deleteCategory,
  listCategories,
  reorderCategories,
  updateCategory,
}
