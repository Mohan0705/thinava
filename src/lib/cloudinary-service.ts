import type { UploadApiResponse } from 'cloudinary'
import cloudinary, { hasCloudinaryServerCredentials } from '@/lib/cloudinary'
import { getOptimizedCloudinaryImageUrl } from '@/lib/cloudinary-image'

export const CLOUDINARY_IMAGE_FOLDERS = {
  banners: 'thinava/banners',
  restaurants: 'thinava/restaurants',
  menuItems: 'thinava/menu-items',
  categories: 'thinava/categories',
  profiles: 'thinava/profiles',
  offers: 'thinava/banners',
} as const

export type CloudinaryImageFolder = keyof typeof CLOUDINARY_IMAGE_FOLDERS

export const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export class CloudinaryImageError extends Error {
  status: number
  code: string

  constructor(message: string, status = 400, code = 'IMAGE_UPLOAD_ERROR') {
    super(message)
    this.name = 'CloudinaryImageError'
    this.status = status
    this.code = code
  }
}

export const hasCloudinaryCredentials = hasCloudinaryServerCredentials

export const normalizeImageFolder = (folder: FormDataEntryValue | null): CloudinaryImageFolder => {
  if (typeof folder !== 'string' || !folder) {
    return 'restaurants'
  }

  if (folder === 'menu-items') return 'menuItems'
  if (folder in CLOUDINARY_IMAGE_FOLDERS) return folder as CloudinaryImageFolder

  throw new CloudinaryImageError('Unsupported image folder.', 400, 'INVALID_IMAGE_FOLDER')
}

export const validateImageFile = (file: File) => {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new CloudinaryImageError('Upload a JPG, PNG, or WebP image.', 400, 'INVALID_FILE_TYPE')
  }

  if (file.size <= 0) {
    throw new CloudinaryImageError('The selected image is empty. Choose a valid image.', 400, 'EMPTY_FILE')
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new CloudinaryImageError('Image must be under 5MB.', 400, 'FILE_TOO_LARGE')
  }
}

export const hasValidImageSignature = (buffer: Buffer, mimeType: string) => {
  if (mimeType === 'image/jpeg') {
    return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }

  if (mimeType === 'image/png') {
    return (
      buffer.length > 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    )
  }

  if (mimeType === 'image/webp') {
    return (
      buffer.length > 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    )
  }

  return false
}

export const uploadImage = ({
  buffer,
  filename,
  folder,
}: {
  buffer: Buffer
  filename: string
  folder: CloudinaryImageFolder
}) =>
  new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_IMAGE_FOLDERS[folder],
        resource_type: 'image',
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        filename_override: filename,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error('Cloudinary did not return an upload result.'))
          return
        }

        resolve(result)
      }
    )

    stream.end(buffer)
  })

export const deleteImage = async (publicId: string) => {
  if (!publicId || !hasCloudinaryCredentials()) {
    return
  }

  await cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
    invalidate: true,
  })
}

export const buildUploadResponse = (upload: UploadApiResponse) => ({
  success: true,
  secure_url: upload.secure_url,
  imageUrl: upload.secure_url,
  optimized_url: getOptimizedCloudinaryImageUrl(upload.secure_url, {
    width: 1600,
    crop: 'limit',
    quality: 'auto:good',
  }),
  public_id: upload.public_id,
  width: upload.width,
  height: upload.height,
  format: upload.format,
  bytes: upload.bytes,
})
