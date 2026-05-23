'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Truck, CheckCircle, XCircle, Trash2, Edit, Loader2, Navigation } from 'lucide-react'
import { AdminPageShell } from '@/components/admin/AdminPageShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { adminApi } from '@/features/admin/api'
import { useAdminAuthStore } from '@/features/admin/auth-store'
import { adminPermissions } from '@/features/admin/permissions'
import { getRealtimeSocket } from '@/lib/realtime'
import { ManualRiderForm } from '@/app/admin/approvals/ManualRiderForm' // Reuse existing manual form

export default function AdminDeliveryPartnersPage() {
  const token = useAdminAuthStore((state) => state.token)
  const [riders, setRiders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const fetchRiders = async () => {
    try {
      if (!token) return
      const res = await adminApi.getDeliveryPartners(token)
      if (res.success) setRiders(res.riders)
    } catch (error) {
      toast.error('Failed to load riders')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRiders()
    if (!token) return

    const socket = getRealtimeSocket('admin', token)

    const handleStatusChange = (data: any) => {
      setRiders(prev => prev.map(r => 
        r.id === data.riderId ? { ...r, status: data.status } : r
      ))
    }

    socket.on('riderStatusChanged', handleStatusChange)
    return () => {
      socket.off('riderStatusChanged', handleStatusChange)
    }
  }, [token])

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await adminApi.updateDeliveryPartner(token || '', id, { status })
      toast.success('Rider status updated')
      fetchRiders()
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  const handleUpdateApproval = async (id: string, approval_status: string) => {
    try {
      await adminApi.updateDeliveryPartner(token || '', id, { approval_status })
      toast.success('Approval status updated')
      fetchRiders()
    } catch (error) {
      toast.error('Failed to update approval')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rider? This cannot be undone.')) return
    try {
      await adminApi.deleteDeliveryPartner(token || '', id)
      toast.success('Rider deleted successfully')
      fetchRiders()
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Failed to delete rider'
      toast.error(message)
    }
  }

  return (
    <AdminPageShell
      title="Rider Management"
      description="Directly onboard delivery partners, manage approvals, and monitor fleet availability."
      permission={adminPermissions.delivery}
    >
      <div className="space-y-6">
        
        {/* Header Actions */}
        <div className="flex justify-between items-center bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-indigo-500" />
              Fleet Roster ({riders.length})
            </h2>
          </div>
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-indigo-500 hover:bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Rider
          </Button>
        </div>

        {/* Riders Table */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/50 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Rider</th>
                  <th className="px-6 py-4">Vehicle & Zone</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Availability</th>
                  <th className="px-6 py-4">Earnings</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
                    </td>
                  </tr>
                ) : riders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No delivery partners found on the platform.
                    </td>
                  </tr>
                ) : (
                  riders.map((rider) => (
                    <tr key={rider.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-white text-base">{rider.full_name}</div>
                        <div className="text-xs text-slate-500 mt-1">{rider.phone}</div>
                        {rider.email && <div className="text-xs text-slate-500">{rider.email}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-200">{rider.vehicle_type || 'N/A'}</span>
                          {rider.vehicle_number && <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{rider.vehicle_number}</span>}
                        </div>
                        <div className="text-xs text-indigo-400 mt-1 flex items-center gap-1">
                          <Navigation className="w-3 h-3" /> {rider.zone || 'Unassigned'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2 items-start">
                          <Badge variant={rider.status === 'ACTIVE' ? 'success' : rider.status === 'SUSPENDED' ? 'destructive' : 'secondary'}>
                            {rider.status}
                          </Badge>
                          <Badge variant={rider.approval_status === 'APPROVED' ? 'default' : 'secondary'} className={rider.approval_status === 'APPROVED' ? 'bg-slate-700' : ''}>
                            {rider.approval_status || 'UNKNOWN'}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${rider.is_online ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                          <span className={rider.is_online ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                            {rider.is_online ? 'Online' : 'Offline'}
                          </span>
                        </div>
                        {rider.has_active_order && (
                          <div className="mt-1 text-xs text-orange-400 font-medium bg-orange-400/10 inline-block px-2 py-0.5 rounded">
                            On Delivery
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono font-medium text-emerald-400">
                        ₹{Number(rider.total_earnings || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {rider.status === 'ACTIVE' ? (
                          <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(rider.id, 'SUSPENDED')} className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10">
                            Suspend
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(rider.id, 'ACTIVE')} className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                            Reactivate
                          </Button>
                        )}
                        {rider.approval_status !== 'APPROVED' && (
                          <Button size="sm" onClick={() => handleUpdateApproval(rider.id, 'APPROVED')} className="bg-emerald-600 hover:bg-emerald-500 text-white border-none shadow-[0_0_10px_rgba(5,150,105,0.2)]">
                            <CheckCircle className="w-4 h-4 mr-2" /> Approve
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(rider.id)} className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Add Rider Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl relative my-8">
            <div className="sticky top-0 bg-slate-900/90 backdrop-blur border-b border-slate-800 p-6 flex justify-between items-center rounded-t-2xl z-10">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Truck className="w-6 h-6 text-indigo-500" /> Direct Rider Creation
              </h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white transition-colors bg-slate-800 p-2 rounded-lg">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-6">
                <p className="text-sm text-slate-300">
                  <span className="text-indigo-400 font-semibold">Note:</span> Delivery partners created here are <span className="font-bold text-white">auto-approved</span> and can log in immediately. The default password field allows you to manually set their initial login credentials.
                </p>
              </div>
              
              <ManualRiderForm onSuccess={() => {
                setIsAddModalOpen(false)
                fetchRiders()
              }} />
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  )
}
