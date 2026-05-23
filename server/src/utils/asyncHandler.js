/**
 * Centralized async error handler for Express routes.
 * Ensures all unhandled promise rejections are passed to the global error handler.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

module.exports = { asyncHandler }
