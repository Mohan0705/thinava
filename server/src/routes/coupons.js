const express = require('express')
const router = express.Router()
const pool = require('../database/connection')
const { asyncHandler } = require('../utils/asyncHandler')
const { logger } = require('../utils/logger')

router.get('/active', asyncHandler(async (req, res) => {
    // Query legacy coupons table
    const legacyResult = await pool.query(
      `SELECT code, description, discount_type, discount_value,
              min_order AS minimum_order_amount, max_discount AS max_discount_amount,
              active AS is_active, expires_at, created_at
       FROM coupons
       WHERE active = TRUE
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC`
    )

    // Query admin coupon_codes table (map to same shape)
    const adminResult = await pool.query(
      `SELECT code, COALESCE(description, title) AS description,
              CASE
                WHEN LOWER(discount_type) = 'percentage' THEN 'PERCENTAGE'
                ELSE 'FLAT'
              END AS discount_type,
              discount_value,
              minimum_order_amount,
              max_discount_amount,
              is_active,
              ends_at AS expires_at,
              created_at
       FROM coupon_codes
       WHERE is_active = TRUE
         AND (ends_at IS NULL OR ends_at > NOW())
         AND (usage_limit = 0 OR used_count < usage_limit)
       ORDER BY created_at DESC`
    )

    // Merge and deduplicate by code (admin-created wins on conflict)
    const couponMap = new Map()
    for (const c of legacyResult.rows) {
      couponMap.set(c.code, c)
    }
    for (const c of adminResult.rows) {
      couponMap.set(c.code, c) // overwrites legacy with admin version
    }

    const coupons = Array.from(couponMap.values())

    res.json({ success: true, coupons })
}))

router.post('/validate', asyncHandler(async (req, res) => {
  const { code, subtotal, deliveryFee } = req.body

  if (!code || typeof subtotal !== 'number') {
    return res.status(400).json({ error: 'code and numeric subtotal are required' })
  }

  const normalizedCode = code.trim().toUpperCase()

  let result = await pool.query(
      `SELECT * FROM coupons
       WHERE code = $1 AND active = TRUE
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [normalizedCode]
    )

    let coupon = null
    let source = 'legacy'

    if (result.rows.length === 0) {
      // Fall back to admin coupon_codes table
      result = await pool.query(
        `SELECT *, title AS description,
                minimum_order_amount AS min_order,
                max_discount_amount AS max_discount,
                'FLAT' AS discount_type_fixed,
                'PERCENTAGE' AS discount_type_pct
         FROM coupon_codes
         WHERE code = $1 AND is_active = TRUE
           AND (ends_at IS NULL OR ends_at > NOW())
           AND (usage_limit = 0 OR used_count < usage_limit)`,
        [normalizedCode]
      )
      source = 'admin'

      if (result.rows.length > 0) {
        coupon = result.rows[0]
      }
    } else {
      coupon = result.rows[0]
    }

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon code is invalid or has expired' })
    }

    const subtotalVal = parseFloat(subtotal)
    const minOrderVal = parseFloat(
      source === 'legacy' ? coupon.min_order : coupon.minimum_order_amount
    )

    if (subtotalVal < minOrderVal) {
      return res.status(400).json({
        error: `${coupon.code} requires a minimum order of ₹${minOrderVal}. Your current subtotal is ₹${subtotalVal}.`
      })
    }

    const discountType = source === 'legacy'
      ? coupon.discount_type
      : (coupon.discount_type === 'percentage' ? 'PERCENTAGE' : 'FLAT')

    const discountValue = parseFloat(coupon.discount_value)

    let discount = 0
    if (discountType === 'PERCENTAGE') {
      discount = (subtotalVal * discountValue) / 100
      const maxDiscount = source === 'legacy'
        ? parseFloat(coupon.max_discount || 0)
        : parseFloat(coupon.max_discount_amount || 0)
      if (maxDiscount > 0) {
        discount = Math.min(discount, maxDiscount)
      }
    } else if (discountType === 'FLAT') {
      discount = discountValue
      if (coupon.code === 'FREEDEL') {
        discount = typeof deliveryFee === 'number' ? deliveryFee : 0
      }
    }

    if (source === 'admin' && coupon.usage_limit > 0) {
      await pool.query(
        'UPDATE coupon_codes SET used_count = used_count + 1 WHERE code = $1',
        [normalizedCode]
      )
    }

    res.json({
      success: true,
      valid: true,
      coupon: {
        code: coupon.code,
        description: source === 'legacy' ? coupon.description : coupon.title || coupon.description,
        discount_type: discountType,
        discount_value: discountValue,
      },
      discountAmount: discount
    })
}))

module.exports = router
