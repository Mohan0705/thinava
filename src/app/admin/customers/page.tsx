'use client'

import { toast } from 'sonner'
import { AdminPageShell } from '@/components/admin/AdminPageShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { adminApi } from '@/features/admin/api'
import { useAdminAuthStore } from '@/features/admin/auth-store'
import { adminPermissions } from '@/features/admin/permissions'
import { useAdminQuery } from '@/features/admin/use-admin-query'
import { formatPrice } from '@/lib/utils'

export default function AdminCustomersPage() {
  const token = useAdminAuthStore((state) => state.token)
  const { data, setData } = useAdminQuery(
    async () => adminApi.getCustomers(token || ''),
    [token],
    20000
  )

  const updateCustomer = async (customerId: string, payload: Record<string, unknown>) => {
    try {
      await adminApi.updateCustomer(token || '', customerId, payload)
      toast.success('Customer updated')
      const refreshed = await adminApi.getCustomers(token || '')
      setData(refreshed)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update customer')
    }
  }

  return (
    <AdminPageShell
      title="Customer Oversight"
      description="Review customer order history, bans, complaint volume, and fraud risk signals without leaving the operations console."
      permission={adminPermissions.customers}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Customers</p><p className="mt-2 text-3xl font-bold">{data?.summary.total ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Active Buyers</p><p className="mt-2 text-3xl font-bold">{data?.summary.active ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Blocked</p><p className="mt-2 text-3xl font-bold text-rose-600">{data?.summary.blocked ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Fraud Alerts</p><p className="mt-2 text-3xl font-bold text-amber-600">{data?.summary.flagged ?? 0}</p></CardContent></Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {data?.customers.map((customer) => (
            <Card key={customer.id} className="border border-white/70 bg-white/90">
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-xl">{customer.name}</CardTitle>
                  <p className="mt-2 text-sm text-slate-500">{customer.phone} · {customer.email || 'No email'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={customer.is_blocked ? 'destructive' : 'success'}>
                    {customer.is_blocked ? 'Blocked' : 'Active'}
                  </Badge>
                  {customer.fraud_score >= 60 ? <Badge variant="outline">High Risk</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                  <p><span className="font-semibold text-slate-900">Orders:</span> {customer.total_orders}</p>
                  <p><span className="font-semibold text-slate-900">Spent:</span> {formatPrice(customer.total_spent)}</p>
                  <p><span className="font-semibold text-slate-900">Fraud Score:</span> {customer.fraud_score}</p>
                  <p><span className="font-semibold text-slate-900">Complaints:</span> {customer.complaint_count}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => updateCustomer(customer.id, { is_blocked: !customer.is_blocked })}>
                    {customer.is_blocked ? 'Unblock' : 'Block'}
                  </Button>
                  <Button variant="outline" onClick={() => updateCustomer(customer.id, { fraud_score: Math.min(95, customer.fraud_score + 15) })}>
                    Raise Risk
                  </Button>
                  <a href={`tel:${customer.phone}`}><Button>Contact Customer</Button></a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AdminPageShell>
  )
}
