const crypto = require('crypto')
const { logger } = require('./logger')
const { getCloudinaryConfig } = require('./cloudinaryConfig')

const CLOUDINARY_HOST = 'res.cloudinary.com'

const isCloudinaryUrl = (value) => {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === CLOUDINARY_HOST
  } catch {
    return false
  }
}

const isAllowedCloudinaryImageUrl = (value) => {
  if (!value) return true
  return isCloudinaryUrl(value)
}

const getPublicIdFromUrl = (value) => {
  if (!isCloudinaryUrl(value)) return null

  const marker = '/upload/'
  const [, imagePath] = value.split(marker)
  if (!imagePath) return null

  const segments = imagePath.split('/').filter(Boolean)
  while (segments.length > 0) {
    const segment = segments[0]
    if (/^v\d+$/i.test(segment)) {
      segments.shift()
      break
    }

    if (segment.includes(',') || /^(?:c|dpr|e|f|fl|g|h|q|r|w|x|y|z)_/i.test(segment)) {
      segments.shift()
      continue
    }

    break
  }

  if (segments.length === 0) return null

  const publicIdWithExt = decodeURIComponent(segments.join('/'))
  return publicIdWithExt.replace(/\.[a-z0-9]+$/i, '')
}

const sign = (params, apiSecret) => {
  const serialized = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')

  return crypto.createHash('sha1').update(`${serialized}${apiSecret}`).digest('hex')
}

const deleteImageByPublicId = async (publicId) => {
  if (!publicId) return
  const config = getCloudinaryConfig()
  if (!config.cloudName || !config.apiKey || !config.apiSecret) return

  const timestamp = Math.round(Date.now() / 1000)
  const signature = sign({ public_id: publicId, timestamp }, config.apiSecret)
  const formData = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: config.apiKey,
    signature,
    invalidate: 'true',
  })

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    logger.warn('Cloudinary image deletion failed', { tag: 'cloudinary', publicId, status: response.status })
  }
}

const deleteImageByUrl = async (value) => {
  const publicId = getPublicIdFromUrl(value)
  await deleteImageByPublicId(publicId)
}

const deleteReplacedImages = async (pairs) => {
  for (const pair of pairs) {
    const previousUrl = pair?.previousUrl
    const nextUrl = pair?.nextUrl
    if (!previousUrl || previousUrl === nextUrl || !isCloudinaryUrl(previousUrl)) continue

    try {
      await deleteImageByUrl(previousUrl)
    } catch (error) {
      logger.warn('Unable to delete replaced Cloudinary image', {
        tag: 'cloudinary',
        error,
        previousUrl,
      })
    }
  }
}

const assertCloudinaryImageUrl = (value, fieldName = 'image') => {
  if (isAllowedCloudinaryImageUrl(value)) return
  const error = new Error(`${fieldName} must be a Cloudinary secure URL.`)
  error.status = 400
  throw error
}

module.exports = {
  assertCloudinaryImageUrl,
  deleteImageByPublicId,
  deleteImageByUrl,
  deleteReplacedImages,
  getPublicIdFromUrl,
  isAllowedCloudinaryImageUrl,
  isCloudinaryUrl,
}
