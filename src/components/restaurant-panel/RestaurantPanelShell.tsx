'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  ListOrdered,
  Menu,
  Package2,
  Settings,
  Shapes,
  Store,
  LogOut,
  X,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/restaurant-panel/StatusBadge'
import { useRestaurantOwnerAuthStore } from '@/store/restaurantOwnerAuthStore'
import { cn } from '@/lib/utils'

const navigation = [
  { href: '/restaurant/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/restaurant/orders', label: 'Orders', icon: ListOrdered },
  { href: '/restaurant/menu', label: 'Menu', icon: Package2 },
  { href: '/restaurant/categories', label: 'Categories', icon: Shapes },
  { href: '/restaurant/settings', label: 'Settings', icon: Settings },
]

export function RestaurantPanelShell({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const owner = useRestaurantOwnerAuthStore((state) => state.owner)
  const logout = useRestaurantOwnerAuthStore((state) => state.logout)

  const handleLogout = () => {
    logout()
    router.replace('/restaurant-auth')
  }

  const sidebar = (
    <div className="flex h-full flex-col justify-between rounded-2xl bg-slate-950 px-4 py-5 text-slate-50 shadow-[0_24px_64px_-34px_rgba(15,23,42,0.8)]">
      <div>
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 via-amber-400 to-red-500 text-lg font-bold text-slate-950">
            T
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Thinava Partner</p>
            <h2 className="text-base font-semibold text-white">{owner?.restaurant.name || 'Restaurant'}</h2>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-slate-300">Merchant status</div>
            {owner?.restaurant.status ? <StatusBadge status={owner.restaurant.status} /> : null}
          </div>
          <p className="text-xs text-slate-400">Manage operations, stock, offers, and order flow.</p>
        </div>

        <nav className="space-y-1.5">
          {navigation.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                  active
                    ? 'bg-gradient-to-r from-orange-400 to-red-500 text-white shadow-lg shadow-orange-500/20'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="space-y-3">
        {owner?.restaurant.id ? (
          <Link
            href={`/restaurant/${owner.restaurant.id}`}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <span className="inline-flex items-center gap-2">
              <Store className="h-4 w-4" />
              View customer page
            </span>
            <ExternalLink className="h-4 w-4" />
          </Link>
        ) : null}

        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start rounded-xl bg-white/5 px-3 text-slate-200 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#eef2f8] text-slate-950">
      <div className="absolute inset-x-0 top-0 h-[220px] bg-[linear-gradient(180deg,rgba(251,146,60,0.16),rgba(238,242,248,0))]" />
      <div className="relative mx-auto grid min-h-screen max-w-[1600px] gap-4 p-3 lg:grid-cols-[260px_minmax(0,1fr)] lg:p-4">
        <aside className="hidden lg:block">{sidebar}</aside>

        <div className="flex min-h-screen flex-col">
          <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
            <Button variant="outline" size="icon" onClick={() => setMobileOpen(true)} className="bg-white">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3 rounded-xl bg-white/90 px-3 py-2 shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white">T</div>
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Partner</div>
                <div className="text-sm font-semibold text-slate-950">{owner?.restaurant.name}</div>
              </div>
            </div>
          </div>

          {mobileOpen ? (
            <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm lg:hidden">
              <div className="absolute left-4 top-4 bottom-4 w-[min(320px,calc(100%-2rem))]">
                <div className="absolute right-4 top-4 z-10">
                  <Button variant="secondary" size="icon" onClick={() => setMobileOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {sidebar}
              </div>
            </div>
          ) : null}

          <header className="mb-4 rounded-2xl border border-white/70 bg-white/90 px-4 py-4 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.42)] backdrop-blur">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="mb-1.5 inline-flex items-center rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                  Restaurant Operations
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
                <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {actions}
              </div>
            </div>
          </header>

          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  )
}
