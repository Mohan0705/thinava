type CloudinaryImageOptions = {
  width?: number
  height?: number
  crop?: 'fill' | 'fit' | 'limit' | 'scale'
  quality?: string
}

const CLOUDINARY_UPLOAD_PATH = '/upload/'
const DEFAULT_BANNER_WIDTHS = [640, 960, 1280, 1600, 1920]

export const getPublicCloudinaryCloudName = () =>
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || ''

export const isCloudinaryImageUrl = (url: string) =>
  /^https:\/\/res\.cloudinary\.com\//i.test(url) && url.includes(CLOUDINARY_UPLOAD_PATH)

const isRemoteImageUrl = (url: string) => /^https?:\/\//i.test(url)

const normalizeDimension = (value?: number) => {
  if (!value || !Number.isFinite(value)) return null
  return Math.max(1, Math.round(value))
}

const removeExistingTransformation = (path: string) => {
  const segments = path.split('/')
  const firstSegment = segments[0] || ''
  const looksLikeTransformation =
    firstSegment.includes(',') ||
    /^(?:c|dpr|e|f|fl|g|h|q|r|w|x|y|z)_/i.test(firstSegment)

  return looksLikeTransformation ? segments.slice(1).join('/') : path
}

export const getOptimizedCloudinaryImageUrl = (
  url: string,
  options: CloudinaryImageOptions = {}
): string => {
  if (!url) {
    return ''
  }

  if (!isCloudinaryImageUrl(url)) {
    return getCloudinaryFetchImageUrl(url, options)
  }

  const width = normalizeDimension(options.width)
  const height = normalizeDimension(options.height)
  const transformations = [
    'f_auto',
    `q_${options.quality || 'auto'}`,
    width ? `w_${width}` : null,
    height ? `h_${height}` : null,
    options.crop ? `c_${options.crop}` : null,
  ].filter(Boolean)

  const [prefix, imagePath] = url.split(CLOUDINARY_UPLOAD_PATH)
  const cleanPath = removeExistingTransformation(imagePath)

  return `${prefix}${CLOUDINARY_UPLOAD_PATH}${transformations.join(',')}/${cleanPath}`
}

export const getCloudinaryBannerSrcSet = (
  url: string,
  widths = DEFAULT_BANNER_WIDTHS
): string | undefined => {
  if (!url) {
    return undefined
  }

  return widths
    .map((width) => `${getOptimizedCloudinaryImageUrl(url, { width, crop: 'limit' })} ${width}w`)
    .join(', ')
}

export const getCloudinaryFetchImageUrl = (
  url: string,
  options: CloudinaryImageOptions = {}
): string => {
  if (!url || !isRemoteImageUrl(url)) {
    return ''
  }

  if (isCloudinaryImageUrl(url)) {
    return getOptimizedCloudinaryImageUrl(url, options)
  }

  const cloudName = getPublicCloudinaryCloudName()
  if (!cloudName) {
    return url
  }

  const width = normalizeDimension(options.width)
  const height = normalizeDimension(options.height)
  const transformations = [
    'f_auto',
    `q_${options.quality || 'auto'}`,
    width ? `w_${width}` : null,
    height ? `h_${height}` : null,
    options.crop ? `c_${options.crop}` : null,
  ].filter(Boolean)

  return `https://res.cloudinary.com/${cloudName}/image/fetch/${transformations.join(',')}/${encodeURIComponent(url)}`
}
