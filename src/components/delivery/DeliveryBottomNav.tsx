'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bike, CalendarDays, Coins, LayoutGrid, MenuSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/delivery/dashboard', label: 'Home', icon: LayoutGrid },
  { href: '/delivery/orders', label: 'Offers', icon: Bike },
  { href: '/delivery/earnings', label: 'Earnings', icon: Coins },
  { href: '/delivery/shifts', label: 'Shifts', icon: CalendarDays },
  { href: '/delivery/more', label: 'More', icon: MenuSquare },
]

export function DeliveryBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 md:hidden">
      <div className="grid grid-cols-5 rounded-[28px] border border-slate-200 bg-white/96 p-2 shadow-[0_30px_90px_-42px_rgba(15,23,42,0.9)] ring-1 ring-slate-950/5 backdrop-blur-xl">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 rounded-[20px] px-2 py-2.5 text-[11px] font-semibold transition-all',
                isActive ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
