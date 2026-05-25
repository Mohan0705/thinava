import { v2 as cloudinary } from 'cloudinary'

type CloudinaryServerConfig = {
  cloud_name?: string
  api_key?: string
  api_secret?: string
}

const parseCloudinaryUrl = (value?: string): CloudinaryServerConfig => {
  if (!value) return {}

  try {
    const url = new URL(value)
    if (url.protocol !== 'cloudinary:') return {}

    return {
      cloud_name: url.hostname,
      api_key: decodeURIComponent(url.username || ''),
      api_secret: decodeURIComponent(url.password || ''),
    }
  } catch {
    return {}
  }
}

export const getCloudinaryServerConfig = (): CloudinaryServerConfig => {
  const urlConfig = parseCloudinaryUrl(process.env.CLOUDINARY_URL)

  return {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || urlConfig.cloud_name,
    api_key: process.env.CLOUDINARY_API_KEY || urlConfig.api_key,
    api_secret: process.env.CLOUDINARY_API_SECRET || urlConfig.api_secret,
  }
}

export const hasCloudinaryServerCredentials = () => {
  const config = getCloudinaryServerConfig()
  return Boolean(config.cloud_name && config.api_key && config.api_secret)
}

const cloudinaryConfig = getCloudinaryServerConfig()

cloudinary.config({
  cloud_name: cloudinaryConfig.cloud_name,
  api_key: cloudinaryConfig.api_key,
  api_secret: cloudinaryConfig.api_secret,
  secure: true,
})

export default cloudinary
