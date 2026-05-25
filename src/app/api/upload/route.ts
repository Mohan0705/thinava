import { NextRequest, NextResponse } from 'next/server'
import {
  CloudinaryImageError,
  buildUploadResponse,
  deleteImage,
  hasCloudinaryCredentials,
  hasValidImageSignature,
  normalizeImageFolder,
  uploadImage,
  validateImageFile,
  type CloudinaryImageFolder,
} from '@/lib/cloudinary-service'

export const runtime = 'nodejs'

type UploadScope = 'admin' | 'restaurant' | 'customer' | 'delivery'

const UPLOAD_FOLDER_PERMISSIONS: Record<UploadScope, CloudinaryImageFolder[]> = {
  admin: ['banners', 'restaurants', 'menuItems', 'categories', 'profiles', 'offers'],
  restaurant: ['restaurants', 'menuItems', 'profiles'],
  customer: ['profiles'],
  delivery: ['profiles'],
}

const AUTH_PROFILES: Record<UploadScope, string> = {
  admin: '/admin/auth/profile',
  restaurant: '/restaurant/auth/me',
  customer: '/auth/profile',
  delivery: '/delivery/auth/profile',
}

const jsonError = (error: unknown) => {
  const imageError = error instanceof CloudinaryImageError
    ? error
    : new CloudinaryImageError('Unable to upload image. Please try again.', 500, 'UPLOAD_FAILED')

  return NextResponse.json(
    {
      success: false,
      error: imageError.message,
      code: imageError.code,
    },
    { status: imageError.status }
  )
}

const getApiBaseUrl = () => (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')

const getRequestedScope = (scope: FormDataEntryValue | null): UploadScope | null => {
  if (typeof scope !== 'string' || !scope) return null
  if (scope === 'admin' || scope === 'restaurant' || scope === 'customer' || scope === 'delivery') {
    return scope
  }

  throw new CloudinaryImageError('Unsupported upload auth scope.', 400, 'INVALID_UPLOAD_SCOPE')
}

const verifyScope = async (authorization: string, scope: UploadScope) => {
  const apiBaseUrl = getApiBaseUrl()
  if (!apiBaseUrl) {
    throw new CloudinaryImageError(
      'Upload authorization is not configured. Set NEXT_PUBLIC_API_URL and restart Next.js.',
      500,
      'UPLOAD_AUTH_NOT_CONFIGURED'
    )
  }

  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${AUTH_PROFILES[scope]}`, {
      headers: { Authorization: authorization },
      cache: 'no-store',
    })
  } catch {
    throw new CloudinaryImageError(
      'Unable to verify the signed-in session. Please try again after the API server is running.',
      503,
      'UPLOAD_AUTH_UNAVAILABLE'
    )
  }

  if (!response.ok) {
    return false
  }

  if (scope === 'admin') {
    const payload = await response.json().catch(() => null)
    const permissions = payload?.admin?.permissions
    return Array.isArray(permissions) && (
      permissions.includes('promotions:manage') ||
      permissions.includes('restaurants:manage') ||
      permissions.includes('settings:manage')
    )
  }

  return true
}

const requireUploadSession = async (
  request: NextRequest,
  folder: CloudinaryImageFolder,
  requestedScope: UploadScope | null
) => {
  const authorization = request.headers.get('authorization')

  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    throw new CloudinaryImageError('Please sign in to upload images.', 401, 'UNAUTHORIZED')
  }

  const scopesToTry: UploadScope[] = requestedScope
    ? [requestedScope]
    : ['admin', 'restaurant', 'customer', 'delivery']

  for (const scope of scopesToTry) {
    const allowedFolders = UPLOAD_FOLDER_PERMISSIONS[scope]
    if (!allowedFolders.includes(folder)) {
      continue
    }

    const verified = await verifyScope(authorization, scope)
    if (verified) {
      return scope
    }
  }

  throw new CloudinaryImageError('Your account cannot upload images to this folder.', 403, 'FORBIDDEN')
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const folder = normalizeImageFolder(formData.get('folder'))
    const scope = getRequestedScope(formData.get('scope'))
    await requireUploadSession(request, folder, scope)

    if (!hasCloudinaryCredentials()) {
      throw new CloudinaryImageError(
        'Image uploads are temporarily unavailable.',
        503,
        'IMAGE_UPLOADS_UNAVAILABLE'
      )
    }

    const file = formData.get('file')
    if (!(file instanceof File)) {
      throw new CloudinaryImageError('No image file was provided.', 400, 'NO_FILE')
    }

    validateImageFile(file)

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!hasValidImageSignature(buffer, file.type)) {
      throw new CloudinaryImageError(
        'The selected file is not a valid JPG, PNG, or WebP image.',
        400,
        'INVALID_IMAGE_DATA'
      )
    }

    const upload = await uploadImage({
      buffer,
      filename: file.name || 'thinava-image',
      folder,
    })

    return NextResponse.json(buildUploadResponse(upload))
  } catch (error) {
    if (!(error instanceof CloudinaryImageError)) {
      console.error('[CLOUDINARY_UPLOAD_ERROR]', error)
    }

    return jsonError(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const publicId = typeof body?.publicId === 'string' ? body.publicId.trim() : ''
    const folder = normalizeImageFolder(typeof body?.folder === 'string' ? body.folder : 'profiles')
    const scope = getRequestedScope(typeof body?.scope === 'string' ? body.scope : null)

    if (!publicId) {
      throw new CloudinaryImageError('A Cloudinary public id is required.', 400, 'PUBLIC_ID_REQUIRED')
    }

    await requireUploadSession(request, folder, scope)
    await deleteImage(publicId)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (!(error instanceof CloudinaryImageError)) {
      console.error('[CLOUDINARY_DELETE_ERROR]', error)
    }

    return jsonError(error)
  }
}
