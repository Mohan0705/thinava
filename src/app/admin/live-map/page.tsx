'use client'

import { AdminPageShell } from '@/components/admin/AdminPageShell'
import { OperationsMap } from '@/components/admin/OperationsMap'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { adminApi } from '@/features/admin/api'
import { useAdminAuthStore } from '@/features/admin/auth-store'
import { adminPermissions } from '@/features/admin/permissions'
import { useAdminQuery } from '@/features/admin/use-admin-query'

export default function AdminLiveMapPage() {
  const token = useAdminAuthStore((state) => state.token)
  const { data } = useAdminQuery(
    async () => {
      const response = await adminApi.getLiveMap(token || '')
      return response.liveMap
    },
    [token],
    12000
  )

  return (
    <AdminPageShell
      title="Live Dispatch Map"
      description="See riders, routes, active deliveries, and busy zone concentration in a dispatch-first operations canvas."
      permission={adminPermissions.map}
    >
      <div className="space-y-6">
        {data ? <OperationsMap data={data} /> : null}

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="border border-white/70 bg-white/90">
            <CardHeader><CardTitle>Live Riders</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data?.riders.map((rider) => (
                <div key={rider.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <p className="font-semibold text-slate-900">{rider.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{rider.status} · {rider.area}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-white/70 bg-white/90 xl:col-span-2">
            <CardHeader><CardTitle>Active Delivery Routes</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {data?.deliveries.map((delivery) => (
                <div key={delivery.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <p className="font-semibold text-slate-900">{delivery.restaurant_name}</p>
                  <p className="mt-1 text-sm text-slate-500">{delivery.customer_name} · {delivery.rider_name}</p>
                  <p className="mt-2 text-sm font-medium text-orange-700">{delivery.status} · {delivery.area}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminPageShell>
  )
}
