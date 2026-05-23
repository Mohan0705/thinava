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

export default function AdminSupportPage() {
  const token = useAdminAuthStore((state) => state.token)
  const { data, setData } = useAdminQuery(
    async () => {
      const response = await adminApi.getSupport(token || '')
      return response.support
    },
    [token],
    15000
  )

  const updateTicket = async (ticketId: string, payload: Record<string, unknown>) => {
    try {
      await adminApi.updateSupportTicket(token || '', ticketId, payload)
      toast.success('Support ticket updated')
      const refreshed = await adminApi.getSupport(token || '')
      setData(refreshed.support)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update support ticket')
    }
  }

  return (
    <AdminPageShell
      title="Support Resolution Center"
      description="Track complaints, refund requests, late deliveries, and escalations with operator-level control."
      permission={adminPermissions.support}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Open</p><p className="mt-2 text-3xl font-bold">{data?.summary.open ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Investigating</p><p className="mt-2 text-3xl font-bold text-amber-600">{data?.summary.investigating ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Resolved</p><p className="mt-2 text-3xl font-bold text-emerald-600">{data?.summary.resolved ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Refund Exposure</p><p className="mt-2 text-3xl font-bold">{formatPrice(data?.summary.refunds ?? 0)}</p></CardContent></Card>
        </div>

        <div className="space-y-4">
          {data?.tickets.map((ticket) => (
            <Card key={ticket.id} className="border border-white/70 bg-white/90">
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-xl">{ticket.subject}</CardTitle>
                  <p className="mt-2 text-sm text-slate-500">
                    {ticket.customer_name || 'Unknown customer'} · {ticket.restaurant_name || 'Thinava order'} · {ticket.category.replace(/_/g, ' ')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={ticket.status === 'resolved' ? 'success' : ticket.status === 'investigating' ? 'outline' : 'secondary'}>
                    {ticket.status}
                  </Badge>
                  <Badge variant="outline">{ticket.priority}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-slate-600">{ticket.description}</p>
                <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                  <span>Refund {formatPrice(ticket.refund_amount)}</span>
                  <span>Updated {new Date(ticket.updated_at).toLocaleString('en-IN')}</span>
                  {ticket.customer_phone ? <span>{ticket.customer_phone}</span> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => updateTicket(ticket.id, { status: 'investigating' })}>Investigate</Button>
                  <Button variant="outline" onClick={() => updateTicket(ticket.id, { status: 'resolved', resolution_notes: 'Resolved via admin dashboard' })}>Resolve</Button>
                  <Button onClick={() => updateTicket(ticket.id, { refund_amount: ticket.refund_amount + 50, status: 'investigating' })}>
                    Add Refund
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AdminPageShell>
  )
}
