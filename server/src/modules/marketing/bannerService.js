const crypto = require('crypto')
const pool = require('../../database/connection')
const { logger } = require('../../lib/logger')
const { assertCloudinaryImageUrl, deleteImageByUrl, deleteReplacedImages } = require('../../lib/cloudinaryService')

const REDIRECT_TYPES = new Set(['restaurants', 'restaurant', 'category', 'offers', 'custom'])
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MIN_WIDTH = 900
const MIN_HEIGHT = 300

const getCloudinaryConfig = () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
  folder: process.env.CLOUDINARY_BANNER_FOLDER || 'thinava/banners',
})

const requireCloudinaryConfig = () => {
  const config = getCloudinaryConfig()
  if (!config.cloudName || !config.apiKey || !config.apiSecret) {
    const error = new Error('Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.')
    error.status = 500
    throw error
  }
  return config
}

const signCloudinaryParams = (params, apiSecret) => {
  const serialized = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')

  return crypto.createHash('sha1').update(`${serialized}${apiSecret}`).digest('hex')
}

const validateUploadRequest = ({ fileType, fileSize, width, height }) => {
  if (!IMAGE_TYPES.has(fileType)) {
    const error = new Error('Only JPG, PNG, and WebP banner images are allowed.')
    error.status = 400
    throw error
  }

  if (!Number.isFinite(Number(fileSize)) || Number(fileSize) <= 0 || Number(fileSize) > MAX_IMAGE_BYTES) {
    const error = new Error('Banner image must be under 5MB.')
    error.status = 400
    throw error
  }

  if (width !== undefined && height !== undefined) {
    const parsedWidth = Number(width)
    const parsedHeight = Number(height)
    if (Number.isFinite(parsedWidth) && Number.isFinite(parsedHeight)) {
      if (parsedWidth < MIN_WIDTH || parsedHeight < MIN_HEIGHT) {
        const error = new Error(`Banner image should be at least ${MIN_WIDTH}x${MIN_HEIGHT}px.`)
        error.status = 400
        throw error
      }
    }
  }
}

const getUploadSignature = (payload = {}) => {
  validateUploadRequest(payload)
  const config = requireCloudinaryConfig()
  const timestamp = Math.round(Date.now() / 1000)
  const params = {
    folder: config.folder,
    timestamp,
  }

  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    folder: config.folder,
    timestamp,
    signature: signCloudinaryParams(params, config.apiSecret),
  }
}

const normalizeBanner = (row) => ({
  id: row.id,
  title: row.title,
  subtitle: row.subtitle,
  imageUrl: row.image_url,
  cloudinaryPublicId: row.cloudinary_public_id,
  redirectType: row.redirect_type,
  redirectTarget: row.redirect_target,
  isActive: Boolean(row.is_active),
  priority: Number(row.priority || 0),
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const validateBannerPayload = (payload, { partial = false } = {}) => {
  const next = {}

  if (!partial || payload.title !== undefined) {
    const title = String(payload.title || '').trim()
    if (!title) {
      const error = new Error('Banner title is required.')
      error.status = 400
      throw error
    }
    next.title = title
  }

  if (!partial || payload.imageUrl !== undefined || payload.image_url !== undefined) {
    const imageUrl = String(payload.imageUrl || payload.image_url || '').trim()
    if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
      const error = new Error('A valid CDN image URL is required.')
      error.status = 400
      throw error
    }
    assertCloudinaryImageUrl(imageUrl, 'Banner image URL')
    next.imageUrl = imageUrl
  }

  if (payload.subtitle !== undefined) {
    next.subtitle = String(payload.subtitle || '').trim() || null
  }

  if (payload.cloudinaryPublicId !== undefined || payload.cloudinary_public_id !== undefined) {
    next.cloudinaryPublicId = String(payload.cloudinaryPublicId || payload.cloudinary_public_id || '').trim() || null
  }

  if (!partial || payload.redirectType !== undefined || payload.redirect_type !== undefined) {
    const redirectType = String(payload.redirectType || payload.redirect_type || 'restaurants').trim()
    if (!REDIRECT_TYPES.has(redirectType)) {
      const error = new Error('Invalid banner redirect type.')
      error.status = 400
      throw error
    }
    next.redirectType = redirectType
  }

  if (payload.redirectTarget !== undefined || payload.redirect_target !== undefined) {
    next.redirectTarget = String(payload.redirectTarget || payload.redirect_target || '').trim() || null
  }

  if (payload.isActive !== undefined || payload.is_active !== undefined) {
    next.isActive = Boolean(payload.isActive ?? payload.is_active)
  }

  if (payload.priority !== undefined) {
    const priority = Number(payload.priority)
    next.priority = Number.isFinite(priority) ? Math.round(priority) : 0
  }

  if (payload.startsAt !== undefined || payload.starts_at !== undefined) {
    next.startsAt = payload.startsAt || payload.starts_at || null
  }

  if (payload.endsAt !== undefined || payload.ends_at !== undefined) {
    next.endsAt = payload.endsAt || payload.ends_at || null
  }

  return next
}

const listBanners = async () => {
  const result = await pool.query(`
    SELECT *
    FROM marketing_banners
    ORDER BY priority DESC, created_at DESC
  `)

  return result.rows.map(normalizeBanner)
}

const getActiveBanner = async () => {
  const result = await pool.query(`
    SELECT *
    FROM marketing_banners
    WHERE is_active = TRUE
      AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
      AND (ends_at IS NULL OR ends_at >= CURRENT_TIMESTAMP)
    ORDER BY priority DESC, created_at DESC
    LIMIT 1
  `)

  return result.rows[0] ? normalizeBanner(result.rows[0]) : null
}

const createBanner = async (payload, adminUser) => {
  const banner = validateBannerPayload(payload)
  const result = await pool.query(
    `INSERT INTO marketing_banners (
       title, subtitle, image_url, cloudinary_public_id, redirect_type, redirect_target,
       is_active, priority, starts_at, ends_at, created_by, updated_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, TRUE), COALESCE($8, 0), $9, $10, $11, $11)
     RETURNING *`,
    [
      banner.title,
      banner.subtitle || null,
      banner.imageUrl,
      banner.cloudinaryPublicId || null,
      banner.redirectType,
      banner.redirectTarget || null,
      banner.isActive,
      banner.priority,
      banner.startsAt || null,
      banner.endsAt || null,
      adminUser.id,
    ]
  )

  return normalizeBanner(result.rows[0])
}

const updateBanner = async (bannerId, payload, adminUser) => {
  const banner = validateBannerPayload(payload, { partial: true })
  const fieldMap = {
    title: 'title',
    subtitle: 'subtitle',
    imageUrl: 'image_url',
    cloudinaryPublicId: 'cloudinary_public_id',
    redirectType: 'redirect_type',
    redirectTarget: 'redirect_target',
    isActive: 'is_active',
    priority: 'priority',
    startsAt: 'starts_at',
    endsAt: 'ends_at',
  }

  const entries = Object.entries(banner).filter(([key]) => fieldMap[key])
  if (entries.length === 0) {
    const error = new Error('No banner updates provided.')
    error.status = 400
    throw error
  }

  const values = []
  const setters = entries.map(([key, value], index) => {
    values.push(value)
    return `${fieldMap[key]} = $${index + 1}`
  })

  const oldResult = await pool.query('SELECT image_url FROM marketing_banners WHERE id = $1', [bannerId])
  const oldImageUrl = oldResult.rows[0]?.image_url

  values.push(adminUser.id, bannerId)
  const result = await pool.query(
    `UPDATE marketing_banners
     SET ${setters.join(', ')}, updated_by = $${values.length - 1}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${values.length}
     RETURNING *`,
    values
  )

  if (!result.rows[0]) {
    const error = new Error('Banner not found.')
    error.status = 404
    throw error
  }

  const updatedBanner = normalizeBanner(result.rows[0])
  await deleteReplacedImages([{ previousUrl: oldImageUrl, nextUrl: updatedBanner.imageUrl }])
  return updatedBanner
}

const deleteCloudinaryImage = async (publicId) => {
  if (!publicId) return
  const config = getCloudinaryConfig()
  if (!config.cloudName || !config.apiKey || !config.apiSecret) return

  const timestamp = Math.round(Date.now() / 1000)
  const signature = signCloudinaryParams({ public_id: publicId, timestamp }, config.apiSecret)
  const formData = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: config.apiKey,
    signature,
  })

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    logger.warn('Cloudinary banner deletion failed', { tag: 'marketing', publicId, status: response.status })
  }
}

const deleteBanner = async (bannerId) => {
  const result = await pool.query(
    `DELETE FROM marketing_banners
     WHERE id = $1
     RETURNING *`,
    [bannerId]
  )

  if (!result.rows[0]) {
    const error = new Error('Banner not found.')
    error.status = 404
    throw error
  }

  const banner = normalizeBanner(result.rows[0])
  if (banner.cloudinaryPublicId) {
    await deleteCloudinaryImage(banner.cloudinaryPublicId)
  } else {
    await deleteImageByUrl(banner.imageUrl)
  }
  return banner
}

module.exports = {
  getUploadSignature,
  listBanners,
  getActiveBanner,
  createBanner,
  updateBanner,
  deleteBanner,
}
