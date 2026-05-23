'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, Building2, Truck, Plus, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { adminApi } from '@/features/admin/api'
import { useAdminAuthStore } from '@/features/admin/auth-store'
import { ManualRestaurantForm } from './ManualRestaurantForm'
import { ManualRiderForm } from './ManualRiderForm'

export default function AdminApprovalsPage() {
  const token = useAdminAuthStore((state) => state.token) || ''
  const [activeTab, setActiveTab] = useState<'RESTAURANTS' | 'RIDERS' | 'MANUAL'>('RESTAURANTS')
  const [pendingRestaurants, setPendingRestaurants] = useState<any[]>([])
  const [pendingRiders, setPendingRiders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchPending = async () => {
    setIsLoading(true)
    try {
      const [restRes, riderRes] = await Promise.all([
        adminApi.getPendingRestaurants(token),
        adminApi.getPendingRiders(token)
      ])
      if (restRes.success) setPendingRestaurants(restRes.pending)
      if (riderRes.success) setPendingRiders(riderRes.pending)
    } catch (error) {
      toast.error('Failed to fetch pending approvals')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      fetchPending()
    }
  }, [token])

  const handleApproveRestaurant = async (id: number) => {
    try {
      await adminApi.approveRestaurant(token, id, { notes: 'Approved via admin panel' })
      toast.success('Restaurant approved!')
      fetchPending()
    } catch (error) {
      toast.error('Approval failed')
    }
  }

  const handleRejectRestaurant = async (id: number) => {
    try {
      await adminApi.rejectRestaurant(token, id, { rejectionReason: 'Rejected via admin panel' })
      toast.success('Restaurant rejected')
      fetchPending()
    } catch (error) {
      toast.error('Rejection failed')
    }
  }

  const handleApproveRider = async (id: number) => {
    try {
      await adminApi.approveRider(token, id, { notes: 'Approved via admin panel' })
      toast.success('Rider approved!')
      fetchPending()
    } catch (error) {
      toast.error('Approval failed')
    }
  }

  const handleRejectRider = async (id: number) => {
    try {
      await adminApi.rejectRider(token, id, { rejectionReason: 'Rejected via admin panel' })
      toast.success('Rider rejected')
      fetchPending()
    } catch (error) {
      toast.error('Rejection failed')
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Governance & Approvals</h1>
          <p className="text-slate-400 mt-1">Review pending registrations and manually onboard partners.</p>
        </div>
        <Button onClick={fetchPending} variant="outline" className="gap-2 bg-slate-800 border-slate-700 text-slate-300 hover:text-white">
          <RefreshCw className="w-4 h-4" /> Refresh Lists
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-800/50 p-1.5 rounded-xl border border-slate-700 backdrop-blur-xl max-w-2xl">
        <button
          onClick={() => setActiveTab('RESTAURANTS')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all ${
            activeTab === 'RESTAURANTS' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Restaurants ({pendingRestaurants.length})
        </button>
        <button
          onClick={() => setActiveTab('RIDERS')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all ${
            activeTab === 'RIDERS' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          <Truck className="w-4 h-4" />
          Riders ({pendingRiders.length})
        </button>
        <button
          onClick={() => setActiveTab('MANUAL')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all ${
            activeTab === 'MANUAL' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          <Plus className="w-4 h-4" />
          Manual Entry
        </button>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Restaurant Approvals */}
          {activeTab === 'RESTAURANTS' && (
            <div className="space-y-4">
              {pendingRestaurants.length === 0 ? (
                <div className="text-center py-12 bg-slate-800/30 border border-slate-700 rounded-2xl border-dashed">
                  <Clock className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-50" />
                  <p className="text-slate-400 text-lg">No pending restaurant approvals.</p>
                </div>
              ) : (
                pendingRestaurants.map((req: any) => (
                  <div key={req.id} className="bg-slate-800/80 backdrop-blur-xl border border-slate-700 p-6 rounded-2xl hover:border-orange-500/30 transition-colors">
                    <div className="grid md:grid-cols-3 gap-6 mb-6">
                      <div>
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-orange-400" />
                          {req.restaurant_name}
                        </h3>
                        <div className="space-y-2 text-sm">
                          <p className="text-slate-300"><span className="text-slate-500 font-medium">Owner:</span> {req.owner_name}</p>
                          <p className="text-slate-300"><span className="text-slate-500 font-medium">Phone:</span> <a href={`tel:${req.owner_phone}`} className="text-orange-400 hover:underline">{req.owner_phone}</a></p>
                          <p className="text-slate-300"><span className="text-slate-500 font-medium">Email:</span> <a href={`mailto:${req.owner_email}`} className="text-orange-400 hover:underline truncate">{req.owner_email}</a></p>
                          <p className="text-slate-300"><span className="text-slate-500 font-medium">Applied:</span> {new Date(req.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>

                      <div className="bg-slate-700/40 rounded-xl p-4 border border-slate-600/50">
                        <h4 className="text-sm font-semibold text-slate-300 mb-3">Location Details</h4>
                        <div className="space-y-2 text-xs">
                          <p className="text-slate-400"><span className="text-slate-500">Address:</span> {req.address_full}</p>
                          <p className="text-slate-400"><span className="text-slate-500">City/State/Pin:</span> {req.city && `${req.city}, ${req.state} ${req.pincode}`}</p>
                          {req.latitude && req.longitude && (
                            <p className="text-slate-400"><span className="text-slate-500">Coordinates:</span> {parseFloat(req.latitude).toFixed(4)}, {parseFloat(req.longitude).toFixed(4)}</p>
                          )}
                        </div>
                      </div>

                      <div className="bg-slate-700/40 rounded-xl p-4 border border-slate-600/50">
                        <h4 className="text-sm font-semibold text-slate-300 mb-3">Business Info</h4>
                        <div className="space-y-2 text-xs">
                          <p className="text-slate-400"><span className="text-slate-500">Category:</span> <span className="capitalize">{req.category || 'Multi-Cuisine'}</span></p>
                          <p className="text-slate-400"><span className="text-slate-500">Type:</span> <span className="capitalize">{req.veg_non_veg || 'Both'}</span></p>
                          <p className="text-slate-400"><span className="text-slate-500">Hours:</span> {req.opening_time || '10:00'} - {req.closing_time || '22:00'}</p>
                          <p className="text-slate-400"><span className="text-slate-500">Delivery Radius:</span> {req.delivery_radius_km || 5} km</p>
                        </div>
                      </div>
                    </div>

                    {req.gst_number || req.fssai_license ? (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-4 text-xs">
                        <p className="text-emerald-300 font-medium mb-1">Documents on file:</p>
                        <div className="flex gap-4">
                          {req.gst_number && <span>GST: {req.gst_number}</span>}
                          {req.fssai_license && <span>FSSAI: {req.fssai_license}</span>}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4 text-xs">
                        <p className="text-amber-300">No documents submitted</p>
                      </div>
                    )}

                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => handleRejectRestaurant(req.restaurant_id)}
                        className="px-4 py-2 rounded-lg border border-rose-500/50 text-rose-400 hover:bg-rose-500/10 transition font-medium text-sm"
                      >
                        <XCircle className="w-4 h-4 inline mr-2" /> Reject
                      </button>
                      <button
                        onClick={() => handleApproveRestaurant(req.restaurant_id)}
                        className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition font-medium text-sm"
                      >
                        <CheckCircle className="w-4 h-4 inline mr-2" /> Approve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Rider Approvals */}
          {activeTab === 'RIDERS' && (
            <div className="space-y-4">
              {pendingRiders.length === 0 ? (
                <div className="text-center py-12 bg-slate-800/30 border border-slate-700 rounded-2xl border-dashed">
                  <Clock className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-50" />
                  <p className="text-slate-400 text-lg">No pending rider approvals.</p>
                </div>
              ) : (
                pendingRiders.map((req: any) => (
                  <div key={req.id} className="bg-slate-800/80 backdrop-blur-xl border border-slate-700 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-orange-500/30 transition-colors">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">{req.full_name}</h3>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        <p className="text-slate-300"><span className="text-slate-500">Phone:</span> {req.phone}</p>
                        <p className="text-slate-300"><span className="text-slate-500">Email:</span> {req.email || 'N/A'}</p>
                        <p className="text-slate-300"><span className="text-slate-500">Vehicle:</span> {req.vehicle_type || 'N/A'} {req.vehicle_number ? `(${req.vehicle_number})` : ''}</p>
                        <p className="text-slate-300"><span className="text-slate-500">Zone:</span> {req.zone || 'Unassigned'}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 shrink-0">
                      <Button onClick={() => handleRejectRider(req.id)} variant="outline" className="border-rose-500/50 text-rose-400 hover:bg-rose-500/10">
                        <XCircle className="w-4 h-4 mr-2" /> Reject
                      </Button>
                      <Button onClick={() => handleApproveRider(req.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white border-none">
                        <CheckCircle className="w-4 h-4 mr-2" /> Approve
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Manual Entry */}
          {activeTab === 'MANUAL' && (
            <div className="grid md:grid-cols-2 gap-8">
              <ManualRestaurantForm onSuccess={fetchPending} />
              <ManualRiderForm onSuccess={fetchPending} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
