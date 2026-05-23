'use client'

import Image from 'next/image'
import { UploadCloud } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { fileToDataUrl } from '@/lib/file-utils'

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
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const dataUrl = await fileToDataUrl(file)
    onChange(dataUrl)
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
          <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-orange-400 hover:bg-orange-50">
            Upload image
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>
        </div>
      </div>
    </div>
  )
}
