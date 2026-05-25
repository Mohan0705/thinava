'use client'

import { DragEvent, useState } from 'react'
import Image from 'next/image'
import { CheckCircle2, ImageIcon, UploadCloud } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { getOptimizedCloudinaryImageUrl } from '@/lib/cloudinary-image'
import { uploadImageToCloudinary, type UploadAuthScope } from '@/lib/image-upload'
import type { CloudinaryImageFolder } from '@/lib/cloudinary-service'
import { useRestaurantOwnerAuthStore } from '@/store/restaurantOwnerAuthStore'
import { toast } from 'sonner'

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export function ImageUploadField({
  label,
  value,
  onChange,
  placeholder,
  folder = 'restaurants',
  scope = 'restaurant',
  token,
  theme = 'light',
}: {
  label: string
  value: string
  onChange: (value: string) => void | Promise<void>
  placeholder: string
  folder?: CloudinaryImageFolder
  scope?: UploadAuthScope
  token?: string | null
  theme?: 'light' | 'dark'
}) {
  const restaurantToken = useRestaurantOwnerAuthStore((state) => state.token)
  const resolvedToken = token ?? restaurantToken
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [uploaded, setUploaded] = useState(false)

  const validateFile = (file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Upload a JPG, PNG, or WebP image.')
      return false
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Image must be under 5MB.')
      return false
    }

    return true
  }

  const uploadFile = async (file: File) => {
    if (!validateFile(file)) return

    if (!resolvedToken) {
      toast.error('Please sign in before uploading images.')
      return
    }

    setUploading(true)
    setProgress(0)
    setUploaded(false)

    try {
      const upload = await uploadImageToCloudinary({
        file,
        token: resolvedToken,
        folder,
        scope,
        onProgress: setProgress,
      })

      await onChange(upload.secure_url)
      setUploaded(true)
      toast.success('Image uploaded to Cloudinary')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) {
      await uploadFile(file)
    }
  }

  const handleDrop = async (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) {
      await uploadFile(file)
    }
  }

  const previewUrl = value
    ? getOptimizedCloudinaryImageUrl(value, { width: 360, height: 360, crop: 'fill' })
    : ''
  const isDark = theme === 'dark'

  return (
    <div className="space-y-3">
      <label className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{label}</label>
      <div className="grid gap-3 md:grid-cols-[120px_1fr]">
        <div className={`relative h-[120px] overflow-hidden rounded-2xl border ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-100'}`}>
          {previewUrl ? (
            <Image src={previewUrl} alt={label} fill sizes="120px" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              <ImageIcon className="h-8 w-8" />
            </div>
          )}
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 text-sm font-bold text-white">
              {progress}%
            </div>
          ) : null}
        </div>
        <div className="space-y-3">
          <Input
            type="url"
            value={value}
            onChange={(event) => {
              onChange(event.target.value)
              setUploaded(false)
            }}
            placeholder={placeholder}
          />
          <label
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`flex cursor-pointer items-center justify-center rounded-xl border border-dashed px-4 py-3 text-sm font-medium transition ${
              dragging
                ? 'border-orange-400 bg-orange-50 text-orange-700'
                : isDark
                  ? 'border-slate-700 bg-slate-800 text-slate-300 hover:border-orange-400 hover:bg-slate-800/80'
                  : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-orange-400 hover:bg-orange-50'
            } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
          >
            {uploaded ? (
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Uploaded
              </span>
            ) : uploading ? (
              `Uploading ${progress}%`
            ) : (
              <span className="inline-flex items-center gap-2">
                <UploadCloud className="h-4 w-4" />
                Upload or drop image
              </span>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
          <p className={`text-xs leading-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            JPG, PNG, or WebP. Max 5MB. Images are delivered through Cloudinary CDN.
          </p>
        </div>
      </div>
    </div>
  )
}
