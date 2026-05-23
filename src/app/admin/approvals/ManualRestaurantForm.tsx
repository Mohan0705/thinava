'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Building2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { adminApi } from '@/features/admin/api'
import { useAdminAuthStore } from '@/features/admin/auth-store'

export function ManualRestaurantForm({ onSuccess }: { onSuccess: () => void }) {
  const token = useAdminAuthStore((state) => state.token) || ''
  const [form, setForm] = useState({
    restaurantName: '', ownerName: '', ownerPhone: '', ownerEmail: '', address: '', password: ''
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await adminApi.registerManualRestaurant(token, {
        ...form,
        latitude: '17.3850', // Mock for manual admin entry default
        longitude: '78.4867'
      })
      toast.success('Restaurant registered manually & approved!')
      setForm({ restaurantName: '', ownerName: '', ownerPhone: '', ownerEmail: '', address: '', password: '' })
      onSuccess()
    } catch (error) {
      toast.error('Failed to register restaurant')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700 p-6 rounded-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-indigo-500/20 p-2 rounded-lg"><Building2 className="w-5 h-5 text-indigo-400" /></div>
        <h3 className="text-xl font-bold text-white">Manual Restaurant</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" placeholder="Restaurant Name" required className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white" value={form.restaurantName} onChange={e => setForm({...form, restaurantName: e.target.value})} />
        <input type="text" placeholder="Owner Name" required className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white" value={form.ownerName} onChange={e => setForm({...form, ownerName: e.target.value})} />
        <div className="grid grid-cols-2 gap-4">
          <input type="text" placeholder="Phone" required className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white" value={form.ownerPhone} onChange={e => setForm({...form, ownerPhone: e.target.value})} />
          <input type="email" placeholder="Email" required className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white" value={form.ownerEmail} onChange={e => setForm({...form, ownerEmail: e.target.value})} />
        </div>
        <input type="text" placeholder="Full Address" required className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
        <input type="password" placeholder="Initial Password" required className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
        <Button type="submit" disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register & Approve'}
        </Button>
      </form>
    </div>
  )
}
