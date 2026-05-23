'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Store, CheckCircle, XCircle, Trash2, Edit, Loader2, Utensils } from 'lucide-react'
import { AdminPageShell } from '@/components/admin/AdminPageShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { adminApi } from '@/features/admin/api'
import { useAdminAuthStore } from '@/features/admin/auth-store'
import { adminPermissions } from '@/features/admin/permissions'
import { useAdminRealtimeSync } from '@/lib/realtimeManager'
import { ManualRestaurantForm } from '@/app/admin/approvals/ManualRestaurantForm'

export default function AdminRestaurantsPage() {
  const router = useRouter()
  const token = useAdminAuthStore((state) => state.token)
  const [restaurants, setRestaurants] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const fetchRestaurants = async () => {
    try {
      if (!token) return
      const res = await adminApi.getRestaurants(token)
      if (res.success) setRestaurants(res.restaurants)
    } catch (error) {
      toast.error('Failed to load restaurants')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRestaurants()
  }, [token])

  useAdminRealtimeSync(token, () => fetchRestaurants())

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await adminApi.updateRestaurant(token || '', id, { status })
      toast.success('Restaurant status updated')
      fetchRestaurants()
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  const handleUpdateApproval = async (id: string, approval_status: string) => {
    try {
      await adminApi.updateRestaurant(token || '', id, { approval_status })
      toast.success('Approval status updated')
      fetchRestaurants()
    } catch (error) {
      toast.error('Failed to update approval')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this restaurant? This cannot be undone.')) return
    try {
      await adminApi.deleteRestaurant(token || '', id)
      toast.success('Restaurant deleted successfully')
      fetchRestaurants()
    } catch (error) {
      toast.error('Failed to delete restaurant')
    }
  }

  return (
    <AdminPageShell
      title="Restaurant Management"
      description="Directly onboard, monitor, and manage restaurant partners on the platform."
      permission={adminPermissions.restaurants}
    >
      <div className="space-y-6">
        
        {/* Header Actions */}
        <div className="flex justify-between items-center bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Store className="w-5 h-5 text-orange-500" />
              Active Restaurants ({restaurants.length})
            </h2>
          </div>
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Restaurant
          </Button>
        </div>

        {/* Restaurants Table */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/50 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Restaurant</th>
                  <th className="px-6 py-4">Owner / Contact</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Approval</th>
                  <th className="px-6 py-4">Orders</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto" />
                    </td>
                  </tr>
                ) : restaurants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No restaurants found on the platform.
                    </td>
                  </tr>
                ) : (
                  restaurants.map((restaurant) => (
                    <tr key={restaurant.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-white text-base">{restaurant.name}</div>
                        <div className="text-xs text-slate-500 mt-1 truncate max-w-[200px]">
                          {Array.isArray(restaurant.cuisines) 
                            ? restaurant.cuisines.join(', ') 
                            : (restaurant.cuisines || 'Multi-Cuisine')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-200">{restaurant.owner_name || 'N/A'}</div>
                        <div className="text-xs text-slate-500">{restaurant.owner_phone || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={restaurant.status === 'OPEN' ? 'success' : restaurant.status === 'CLOSED' ? 'destructive' : 'secondary'}>
                          {restaurant.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={restaurant.approval_status === 'APPROVED' ? 'success' : 'default'} className={restaurant.approval_status === 'APPROVED' ? '' : 'bg-slate-700'}>
                          {restaurant.approval_status || 'UNKNOWN'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-mono font-medium text-slate-300">
                        {restaurant.total_orders}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => router.push(`/admin/restaurants/${restaurant.id}/menu`)} className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10">
                          <Utensils className="w-4 h-4 mr-1" /> Menu
                        </Button>
                        {restaurant.status === 'OPEN' ? (
                          <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(restaurant.id, 'CLOSED')} className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10">
                            Close
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(restaurant.id, 'OPEN')} className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                            Open
                          </Button>
                        )}
                        {restaurant.approval_status !== 'APPROVED' && (
                          <Button size="sm" onClick={() => handleUpdateApproval(restaurant.id, 'APPROVED')} className="bg-emerald-600 hover:bg-emerald-500 text-white border-none shadow-[0_0_10px_rgba(5,150,105,0.2)]">
                            <CheckCircle className="w-4 h-4 mr-2" /> Approve
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(restaurant.id)} className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10">
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

      {/* Add Restaurant Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl relative my-8">
            <div className="sticky top-0 bg-slate-900/90 backdrop-blur border-b border-slate-800 p-6 flex justify-between items-center rounded-t-2xl z-10">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Store className="w-6 h-6 text-orange-500" /> Direct Restaurant Creation
              </h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white transition-colors bg-slate-800 p-2 rounded-lg">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-6">
                <p className="text-sm text-slate-300">
                  <span className="text-orange-400 font-semibold">Note:</span> Restaurants created here are <span className="font-bold text-white">auto-approved</span> and can log in immediately. Passwords will be securely hashed upon creation.
                </p>
              </div>
              
              <ManualRestaurantForm onSuccess={() => {
                setIsAddModalOpen(false)
                fetchRestaurants()
              }} />
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  )
}
