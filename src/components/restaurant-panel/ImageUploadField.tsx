'use client'

import { useState } from 'react'
import Image from 'next/image'
import { UploadCloud } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'

export function ImageUploadField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  const [uploading, setUploading] = useState(false)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!data.success) {
        toast.error(data.error || 'Upload failed')
        return
      }

      console.log('[IMAGE UPLOAD RESPONSE]', data)
      onChange(data.imageUrl)
      toast.success('Image uploaded successfully')
    } catch (error) {
      console.error('[IMAGE UPLOAD ERROR]', error)
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <div className="grid gap-3 md:grid-cols-[120px_1fr]">
        <div className="relative h-[120px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          {value ? (
            <Image src={value} alt={label} fill className="object-cover" unoptimized />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              <UploadCloud className="h-8 w-8" />
            </div>
          )}
        </div>
        <div className="space-y-3">
          <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
          <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-orange-400 hover:bg-orange-50 disabled:opacity-50">
            {uploading ? 'Uploading...' : 'Upload image'}
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
          </label>
        </div>
      </div>
    </div>
  )
}
