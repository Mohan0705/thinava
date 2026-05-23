'use client'

import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { AdminPageShell } from '@/components/admin/AdminPageShell'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { adminApi } from '@/features/admin/api'
import { useAdminAuthStore } from '@/features/admin/auth-store'
import { adminPermissions } from '@/features/admin/permissions'
import { useAdminQuery } from '@/features/admin/use-admin-query'
import { formatPrice } from '@/lib/utils'

const colors = ['#f97316', '#0ea5e9', '#22c55e', '#f43f5e']

export default function AdminPaymentsPage() {
  const token = useAdminAuthStore((state) => state.token)
  const { data } = useAdminQuery(
    async () => {
      const response = await adminApi.getPayments(token || '')
      return response.payments
    },
    [token],
    20000
  )

  return (
    <AdminPageShell
      title="Payments and Finance"
      description="Monitor platform revenue, COD reconciliation, commissions, restaurant settlements, and rider payout exposure."
      permission={adminPermissions.payments}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Platform Revenue</p><p className="mt-2 text-3xl font-bold">{formatPrice(data?.overview.platform_revenue ?? 0)}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Pending Settlements</p><p className="mt-2 text-3xl font-bold text-amber-600">{formatPrice(data?.overview.pending_settlements ?? 0)}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-slate-500">COD Reconciliation</p><p className="mt-2 text-3xl font-bold">{formatPrice(data?.overview.cod_reconciliation ?? 0)}</p></CardContent></Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
          <Card className="border border-white/70 bg-white/90">
            <CardHeader><CardTitle>Settlement Split</CardTitle></CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data?.settlement_status || []} dataKey="amount" nameKey="status" innerRadius={58} outerRadius={96}>
                    {(data?.settlement_status || []).map((entry, index) => <Cell key={entry.status} fill={colors[index % colors.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border border-white/70 bg-white/90">
            <CardHeader><CardTitle>Latest Payout Transactions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data?.payouts.map((transaction) => (
                <div key={transaction.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{transaction.entity_name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {transaction.entity_type.replace(/_/g, ' ')} · Order {transaction.order_id?.slice(0, 8) || 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={transaction.status === 'settled' ? 'success' : 'outline'}>{transaction.status}</Badge>
                      <p className="mt-2 font-semibold text-slate-950">{formatPrice(transaction.settlement_amount)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
                    <span>Gross {formatPrice(transaction.amount)}</span>
                    <span>Commission {formatPrice(transaction.commission_amount)}</span>
                    <span>Due {transaction.due_date ? new Date(transaction.due_date).toLocaleDateString('en-IN') : 'TBD'}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminPageShell>
  )
}
