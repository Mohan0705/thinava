'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Truck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { adminApi } from '@/features/admin/api'
import { useAdminAuthStore } from '@/features/admin/auth-store'

export function ManualRiderForm({ onSuccess }: { onSuccess: () => void }) {
  const token = useAdminAuthStore((state) => state.token) || ''
  const [form, setForm] = useState({
    fullName: '', phone: '', email: '', vehicleType: 'BIKE', vehicleNumber: '', zone: '', password: ''
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await adminApi.registerManualRider(token, form)
      toast.success('Rider registered manually & approved!')
      setForm({ fullName: '', phone: '', email: '', vehicleType: 'BIKE', vehicleNumber: '', zone: '', password: '' })
      onSuccess()
    } catch (error) {
      toast.error('Failed to register rider')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700 p-6 rounded-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-indigo-500/20 p-2 rounded-lg"><Truck className="w-5 h-5 text-indigo-400" /></div>
        <h3 className="text-xl font-bold text-white">Manual Rider</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" placeholder="Full Name" required className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} />
        <div className="grid grid-cols-2 gap-4">
          <input type="text" placeholder="Phone" required className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
          <input type="email" placeholder="Email (Optional)" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <select className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white" value={form.vehicleType} onChange={e => setForm({...form, vehicleType: e.target.value})}>
            <option value="BIKE">Bike</option>
            <option value="SCOOTER">Scooter</option>
            <option value="CYCLE">Cycle</option>
          </select>
          <input type="text" placeholder="Vehicle No." required className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white" value={form.vehicleNumber} onChange={e => setForm({...form, vehicleNumber: e.target.value})} />
        </div>
        <input type="text" placeholder="Zone" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white" value={form.zone} onChange={e => setForm({...form, zone: e.target.value})} />
        <input type="password" placeholder="Initial Password" required className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
        <Button type="submit" disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register & Approve'}
        </Button>
      </form>
    </div>
  )
}
