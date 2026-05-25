import type { CloudinaryImageFolder } from '@/lib/cloudinary-service'

export type UploadAuthScope = 'admin' | 'restaurant' | 'customer' | 'delivery'

export interface CloudinaryUploadResponse {
  success: boolean
  secure_url: string
  imageUrl: string
  optimized_url?: string
  public_id: string
  width?: number
  height?: number
  format?: string
  bytes?: number
}

export interface UploadImageOptions {
  file: File
  token: string | null
  folder: CloudinaryImageFolder
  scope: UploadAuthScope
  onProgress?: (progress: number) => void
}

export const uploadImageToCloudinary = ({
  file,
  token,
  folder,
  scope,
  onProgress,
}: UploadImageOptions) =>
  new Promise<CloudinaryUploadResponse>((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', folder)
    formData.append('scope', scope)

    const request = new XMLHttpRequest()
    request.open('POST', '/api/upload')
    request.responseType = 'text'

    if (token) {
      request.setRequestHeader('Authorization', `Bearer ${token}`)
    }

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
    }

    request.onload = () => {
      let payload: Partial<CloudinaryUploadResponse> & { error?: string; message?: string } = {}

      if (request.responseText) {
        try {
          payload = JSON.parse(request.responseText)
        } catch {
          payload = { message: request.responseText }
        }
      }

      if (request.status < 200 || request.status >= 300 || !payload.success || !payload.secure_url || !payload.public_id) {
        reject(new Error(payload.error || payload.message || 'Image upload failed'))
        return
      }

      onProgress?.(100)
      resolve(payload as CloudinaryUploadResponse)
    }

    request.onerror = () => reject(new Error('Network error while uploading image.'))
    request.ontimeout = () => reject(new Error('Image upload timed out. Please try again.'))
    request.timeout = 60000
    request.send(formData)
  })
