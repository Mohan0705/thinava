'use client'

import { DragEvent, FormEvent, useMemo, useState } from 'react'
import { ImagePlus, Pencil, Plus, Trash2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { AdminPageShell } from '@/components/admin/AdminPageShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { adminApi } from '@/features/admin/api'
import { useAdminAuthStore } from '@/features/admin/auth-store'
import { adminPermissions } from '@/features/admin/permissions'
import type { BannerRedirectType, MarketingBanner } from '@/features/admin/types'
import { useAdminQuery } from '@/features/admin/use-admin-query'
import { getOptimizedCloudinaryImageUrl } from '@/lib/cloudinary-image'

const EMPTY_FORM = {
  title: '',
  subtitle: '',
  imageUrl: '',
  cloudinaryPublicId: '',
  redirectType: 'restaurants' as BannerRedirectType,
  redirectTarget: '',
  isActive: true,
  priority: '10',
  startsAt: '',
  endsAt: '',
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export default function AdminMarketingBannersPage() {
  const token = useAdminAuthStore((state) => state.token)
  const admin = useAdminAuthStore((state) => state.admin)
  const canManage = admin?.permissions.includes('promotions:manage') ?? false

  const { data, loading, setData, refetch } = useAdminQuery(
    async () => {
      const response = await adminApi.getBanners(token || '')
      return response.banners
    },
    [token],
    15000
  )

  const [form, setForm] = useState(EMPTY_FORM)
  const [previewUrl, setPreviewUrl] = useState('')
  const [editingBanner, setEditingBanner] = useState<MarketingBanner | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [draggingUpload, setDraggingUpload] = useState(false)
  const [saving, setSaving] = useState(false)

  const activeBanner = useMemo(
    () => data?.find((banner) => banner.isActive) || null,
    [data]
  )

  const openCreateModal = () => {
    setForm(EMPTY_FORM)
    setPreviewUrl('')
    setEditingBanner(null)
    setModalOpen(true)
  }

  const openEditModal = (banner: MarketingBanner) => {
    setForm({
      title: banner.title,
      subtitle: banner.subtitle || '',
      imageUrl: banner.imageUrl,
      cloudinaryPublicId: banner.cloudinaryPublicId || '',
      redirectType: banner.redirectType,
      redirectTarget: banner.redirectTarget || '',
      isActive: banner.isActive,
      priority: String(banner.priority),
      startsAt: banner.startsAt ? banner.startsAt.slice(0, 16) : '',
      endsAt: banner.endsAt ? banner.endsAt.slice(0, 16) : '',
    })
    setPreviewUrl(getOptimizedCloudinaryImageUrl(banner.imageUrl, { width: 640, crop: 'limit' }))
    setEditingBanner(banner)
    setModalOpen(true)
  }

  const handleFileSelect = async (file: File | null) => {
    if (!file) return

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Upload a JPG, PNG, or WebP banner image.')
      return
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Banner image must be under 5MB.')
      return
    }

    const localPreviewUrl = URL.createObjectURL(file)
    setPreviewUrl(localPreviewUrl)
    setUploading(true)
    setUploadProgress(0)

    try {
      const upload = await adminApi.uploadBannerImage(token || '', file, setUploadProgress)
      setForm((current) => ({
        ...current,
        imageUrl: upload.secure_url,
        cloudinaryPublicId: upload.public_id,
      }))
      setPreviewUrl(getOptimizedCloudinaryImageUrl(upload.secure_url, { width: 640, crop: 'limit' }))
      toast.success('Banner image uploaded')
    } catch (error) {
      setPreviewUrl('')
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      URL.revokeObjectURL(localPreviewUrl)
      setUploading(false)
    }
  }

  const handleDropUpload = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDraggingUpload(false)
    handleFileSelect(event.dataTransfer.files?.[0] || null)
  }

  const handleImageUrlChange = (imageUrl: string) => {
    setForm((current) => ({ ...current, imageUrl }))
    setPreviewUrl(imageUrl ? getOptimizedCloudinaryImageUrl(imageUrl, { width: 640, crop: 'limit' }) : '')
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()

    if (uploading) {
      toast.error('Please wait for the banner image upload to finish.')
      return
    }

    if (!form.imageUrl.trim()) {
      toast.error('Upload a banner image or paste a Cloudinary image URL.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        title: form.title,
        subtitle: form.subtitle,
        imageUrl: form.imageUrl.trim(),
        cloudinaryPublicId: form.cloudinaryPublicId,
        redirectType: form.redirectType,
        redirectTarget: form.redirectTarget,
        isActive: form.isActive,
        priority: Number(form.priority || 0),
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
      }

      if (editingBanner) {
        await adminApi.updateBanner(token || '', editingBanner.id, payload)
        toast.success('Banner updated')
      } else {
        await adminApi.createBanner(token || '', payload)
        toast.success('Banner created')
      }

      const refreshed = await adminApi.getBanners(token || '')
      setData(refreshed.banners)
      setModalOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save banner')
    } finally {
      setSaving(false)
    }
  }

  const toggleBanner = async (banner: MarketingBanner) => {
    try {
      await adminApi.updateBanner(token || '', banner.id, { isActive: !banner.isActive })
      const refreshed = await adminApi.getBanners(token || '')
      setData(refreshed.banners)
      toast.success(banner.isActive ? 'Banner paused' : 'Banner activated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update banner')
    }
  }

  const deleteBanner = async (banner: MarketingBanner) => {
    if (!window.confirm(`Delete "${banner.title}"? This also attempts to remove its Cloudinary asset.`)) {
      return
    }

    try {
      await adminApi.deleteBanner(token || '', banner.id)
      setData((data || []).filter((item) => item.id !== banner.id))
      toast.success('Banner deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete banner')
    }
  }

  return (
    <AdminPageShell
      title="Marketing Banners"
      description="Upload, schedule, activate, and route marketplace hero banners from one dashboard surface."
      permission={adminPermissions.marketing}
      actions={
        canManage ? (
          <Button onClick={openCreateModal} className="rounded-2xl">
            <Plus className="mr-2 h-4 w-4" />
            New Banner
          </Button>
        ) : null
      }
    >
      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <Card className="border border-white/70 bg-white/90">
          <CardHeader>
            <CardTitle>Current Hero</CardTitle>
          </CardHeader>
          <CardContent>
            {activeBanner ? (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-[24px] border border-orange-100 bg-orange-50">
                  <img
                    src={getOptimizedCloudinaryImageUrl(activeBanner.imageUrl, { width: 800, crop: 'limit' })}
                    alt={activeBanner.title}
                    className="h-56 w-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success">Live</Badge>
                    <Badge variant="secondary">{activeBanner.redirectType}</Badge>
                    <Badge variant="outline">Priority {activeBanner.priority}</Badge>
                  </div>
                  <h2 className="mt-3 text-xl font-black text-slate-950">{activeBanner.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{activeBanner.subtitle || 'No subtitle'}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-orange-200 bg-orange-50/60 p-8 text-center">
                <ImagePlus className="mx-auto h-10 w-10 text-orange-500" />
                <p className="mt-4 font-bold text-slate-950">No active hero banner</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Create or activate a banner to publish it on the customer homepage.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-white/70 bg-white/90">
          <CardHeader>
            <CardTitle>Banner Library</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="rounded-[24px] bg-slate-100 p-6 text-sm text-slate-500">Loading banners...</div>
            ) : data && data.length > 0 ? (
              data.map((banner) => (
                <div
                  key={banner.id}
                  className="grid gap-4 rounded-[26px] border border-slate-100 bg-slate-50/80 p-4 lg:grid-cols-[220px_1fr]"
                >
                  <div className="overflow-hidden rounded-[20px] bg-orange-50">
                    <img
                      src={getOptimizedCloudinaryImageUrl(banner.imageUrl, { width: 480, crop: 'limit' })}
                      alt={banner.title}
                      className="h-36 w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={banner.isActive ? 'success' : 'secondary'}>
                          {banner.isActive ? 'Active' : 'Paused'}
                        </Badge>
                        <Badge variant="outline">{banner.redirectType}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => toggleBanner(banner)} disabled={!canManage}>
                          {banner.isActive ? 'Pause' : 'Activate'}
                        </Button>
                        <Button size="icon" variant="outline" onClick={() => openEditModal(banner)} disabled={!canManage}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" onClick={() => deleteBanner(banner)} disabled={!canManage}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    <h3 className="mt-3 truncate text-lg font-black text-slate-950">{banner.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{banner.subtitle || 'No subtitle'}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      <span>Priority {banner.priority}</span>
                      {banner.redirectTarget ? <span>Target {banner.redirectTarget}</span> : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No banners have been created yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} className="max-w-3xl">
        <form onSubmit={handleSave} className="space-y-5 pr-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-600">Marketing</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              {editingBanner ? 'Edit Banner' : 'Create Banner'}
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input required placeholder="Banner title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            <Input type="number" placeholder="Priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} />
          </div>

          <Textarea placeholder="Subtitle" value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} />

          <div className="grid gap-4 md:grid-cols-[240px_1fr]">
            <div className="overflow-hidden rounded-[24px] border border-slate-100 bg-slate-50">
              {previewUrl ? (
                <img src={previewUrl} alt="Banner preview" className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-40 items-center justify-center text-slate-400">
                  <UploadCloud className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="space-y-3">
              <Input
                type="url"
                value={form.imageUrl}
                onChange={(event) => handleImageUrlChange(event.target.value)}
                placeholder="Cloudinary image URL"
              />
              <label
                onDragOver={(event) => {
                  event.preventDefault()
                  setDraggingUpload(true)
                }}
                onDragLeave={() => setDraggingUpload(false)}
                onDrop={handleDropUpload}
                className={`flex cursor-pointer items-center justify-center rounded-xl border border-dashed px-4 py-3 text-sm font-bold transition ${
                  draggingUpload
                    ? 'border-orange-400 bg-orange-50 text-orange-700'
                    : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-orange-400 hover:bg-orange-50'
                } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
              >
                {uploading ? `Uploading ${uploadProgress}%` : 'Upload or drop JPG, PNG, or WebP'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploading}
                  onChange={(event) => handleFileSelect(event.target.files?.[0] || null)}
                />
              </label>
              <p className="text-xs leading-5 text-slate-500">
                Recommended minimum: 1280x640. Max file size: 5MB. Images are delivered from Cloudinary CDN.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <select
              value={form.redirectType}
              onChange={(event) => setForm({ ...form, redirectType: event.target.value as BannerRedirectType })}
              className="h-12 rounded-xl border-2 border-gray-200 bg-white px-4 text-base transition-all duration-200 focus-visible:border-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/20"
            >
              <option value="restaurants">Restaurants section</option>
              <option value="restaurant">Specific restaurant</option>
              <option value="category">Category page</option>
              <option value="offers">Offers page</option>
              <option value="custom">Custom route</option>
            </select>
            <Input placeholder="Redirect target" value={form.redirectTarget} onChange={(event) => setForm({ ...form, redirectTarget: event.target.value })} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} />
            <Input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              className="h-5 w-5 accent-orange-500"
            />
            Publish as active banner
          </label>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || uploading}>
              {uploading ? 'Uploading...' : saving ? 'Saving...' : 'Save Banner'}
            </Button>
          </div>
        </form>
      </Modal>
    </AdminPageShell>
  )
}
