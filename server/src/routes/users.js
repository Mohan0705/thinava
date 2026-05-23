const express = require('express')
const router = express.Router()
const pool = require('../database/connection')
const { asyncHandler } = require('../utils/asyncHandler')
const { logger } = require('../lib/logger')
const { authenticateCustomer } = require('../modules/auth/middleware/auth')

// All customer routes require authentication
router.use(authenticateCustomer)

// Verify user is accessing their own data
router.use((req, res, next) => {
  if (req.params.userId && parseInt(req.params.userId) !== req.customer.id) {
    return res.status(403).json({ success: false, error: 'Forbidden' })
  }
  next()
})

router.get('/:userId/addresses', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC',
    [req.params.userId]
  )
  res.json({ success: true, addresses: result.rows })
}))

router.post('/:userId/addresses', asyncHandler(async (req, res) => {
  const { label, full_address, landmark, is_default } = req.body

  if (is_default) {
    await pool.query(
      'UPDATE addresses SET is_default = false WHERE user_id = $1',
      [req.params.userId]
    )
  }

  const result = await pool.query(
    'INSERT INTO addresses (user_id, label, full_address, landmark, is_default) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [req.params.userId, label, full_address, landmark, is_default || false]
  )

  res.status(201).json({ success: true, address: result.rows[0] })
}))

router.put('/:userId/addresses/:addressId', asyncHandler(async (req, res) => {
  const { label, full_address, landmark, is_default } = req.body

  if (is_default) {
    await pool.query(
      'UPDATE addresses SET is_default = false WHERE user_id = $1',
      [req.params.userId]
    )
  }

  const result = await pool.query(
    'UPDATE addresses SET label = $1, full_address = $2, landmark = $3, is_default = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 AND user_id = $6 RETURNING *',
    [label, full_address, landmark, is_default || false, req.params.addressId, req.params.userId]
  )

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Address not found' })
  }

  res.json({ success: true, address: result.rows[0] })
}))

router.delete('/:userId/addresses/:addressId', asyncHandler(async (req, res) => {
  await pool.query(
    'DELETE FROM addresses WHERE id = $1 AND user_id = $2',
    [req.params.addressId, req.params.userId]
  )
  res.json({ success: true, message: 'Address deleted successfully' })
}))

router.put('/:userId', asyncHandler(async (req, res) => {
  const { name, email } = req.body

  const result = await pool.query(
    'UPDATE users SET name = $1, email = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
    [name, email, req.params.userId]
  )

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' })
  }

  res.json({ success: true, user: result.rows[0] })
}))

module.exports = router
