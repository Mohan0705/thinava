'use client'

import { FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { AdminPageShell } from '@/components/admin/AdminPageShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { adminApi } from '@/features/admin/api'
import { useAdminAuthStore } from '@/features/admin/auth-store'
import { adminPermissions } from '@/features/admin/permissions'
import { useAdminQuery } from '@/features/admin/use-admin-query'
import { formatPrice } from '@/lib/utils'

export default function AdminPromotionsPage() {
  const token = useAdminAuthStore((state) => state.token)
  const admin = useAdminAuthStore((state) => state.admin)
  const { data, setData } = useAdminQuery(
    async () => {
      const response = await adminApi.getPromotions(token || '')
      return response.promotions
    },
    [token],
    20000
  )
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [discountValue, setDiscountValue] = useState('50')
  const canManagePromotions = admin?.permissions.includes('promotions:manage') ?? false

  const handleCreateCoupon = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await adminApi.createCoupon(token || '', {
        code,
        title,
        description,
        discount_value: Number(discountValue),
        minimum_order_amount: 249,
        max_discount_amount: Number(discountValue),
        usage_limit: 300,
      })
      toast.success('Promotion created')
      setCode('')
      setTitle('')
      setDescription('')
      const refreshed = await adminApi.getPromotions(token || '')
      setData(refreshed.promotions)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create promotion')
    }
  }

  return (
    <AdminPageShell
      title="Promotions and Growth"
      description="Manage coupon drops, featured restaurant boosts, seasonal offers, and marketplace demand stimulation."
      permission={adminPermissions.promotions}
    >
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        {canManagePromotions ? (
          <Card className="border border-white/70 bg-white/90">
            <CardHeader><CardTitle>Create Coupon</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCoupon} className="space-y-4">
                <Input placeholder="Code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
                <Input placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
                <Input placeholder="Discount value" type="number" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} />
                <Textarea placeholder="Describe the offer" value={description} onChange={(event) => setDescription(event.target.value)} />
                <Button type="submit" className="w-full">Launch Promotion</Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-white/70 bg-white/90">
            <CardHeader><CardTitle>Promotion Overview</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p>Promotion creation is restricted for your role.</p>
              <p>Use this space to monitor coupon performance, featured inventory, and offer uptake across the marketplace.</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          <Card className="border border-white/70 bg-white/90">
            <CardHeader><CardTitle>Active Coupons</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {data?.coupons.map((coupon) => (
                <div key={coupon.id} className="rounded-[26px] border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-semibold text-slate-950">{coupon.code}</p>
                    <Badge variant={coupon.is_active ? 'success' : 'secondary'}>{coupon.is_active ? 'Active' : 'Paused'}</Badge>
                  </div>
                  <p className="mt-2 font-medium text-slate-700">{coupon.title}</p>
                  <p className="mt-2 text-sm text-slate-500">{coupon.description}</p>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
                    <span>{coupon.discount_type}</span>
                    <span>{formatPrice(coupon.discount_value)}</span>
                    <span>{coupon.used_count}/{coupon.usage_limit} used</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-white/70 bg-white/90">
            <CardHeader><CardTitle>Featured Restaurants</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {data?.featured_restaurants.map((restaurant) => (
                <div key={restaurant.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <p className="font-semibold text-slate-900">{restaurant.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{restaurant.zone_name}</p>
                  <p className="mt-2 text-sm font-medium text-orange-700">{formatPrice(restaurant.revenue)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminPageShell>
  )
}
