import { Badge } from '@/components/ui/Badge'
import { RestaurantOrderStatus, RestaurantStatus } from '@/types/restaurant-panel'

const statusStyles: Record<string, string> = {
  OPEN: 'bg-emerald-500 text-white',
  CLOSED: 'bg-slate-500 text-white',
  TEMPORARILY_UNAVAILABLE: 'bg-amber-500 text-white',
  PLACED: 'bg-blue-500 text-white',
  ACCEPTED: 'bg-cyan-500 text-white',
  PREPARING: 'bg-amber-500 text-white',
  READY_FOR_PICKUP: 'bg-violet-500 text-white',
  OUT_FOR_DELIVERY: 'bg-fuchsia-500 text-white',
  DELIVERED: 'bg-emerald-500 text-white',
  CANCELLED: 'bg-rose-500 text-white',
}

const formatStatus = (status: string) =>
  status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

export function StatusBadge({
  status,
}: {
  status: RestaurantStatus | RestaurantOrderStatus
}) {
  return (
    <Badge className={statusStyles[status] || 'bg-slate-200 text-slate-800'}>
      {formatStatus(status)}
    </Badge>
  )
}
