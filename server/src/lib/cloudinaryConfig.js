const parseCloudinaryUrl = (value) => {
  if (!value) return {}

  try {
    const url = new URL(value)
    if (url.protocol !== 'cloudinary:') return {}

    return {
      cloudName: url.hostname,
      apiKey: decodeURIComponent(url.username || ''),
      apiSecret: decodeURIComponent(url.password || ''),
    }
  } catch {
    return {}
  }
}

const getCloudinaryConfig = () => {
  const urlConfig = parseCloudinaryUrl(process.env.CLOUDINARY_URL)

  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || urlConfig.cloudName || '',
    apiKey: process.env.CLOUDINARY_API_KEY || urlConfig.apiKey || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || urlConfig.apiSecret || '',
  }
}

const hasCloudinaryConfig = () => {
  const config = getCloudinaryConfig()
  return Boolean(config.cloudName && config.apiKey && config.apiSecret)
}

module.exports = {
  getCloudinaryConfig,
  hasCloudinaryConfig,
}
