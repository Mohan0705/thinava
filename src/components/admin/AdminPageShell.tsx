'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bell,
  ChevronRight,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { Space_Grotesk } from 'next/font/google'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { adminNavigation } from '@/features/admin/permissions'
import { useAdminAuthStore } from '@/features/admin/auth-store'
import { AdminAuthBootstrap } from '@/features/admin/AdminAuthBootstrap'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['400', '500', '700'] })

export function AdminPageShell({
  title,
  description,
  permission,
  actions,
  children,
}: {
  title: string
  description: string
  permission?: string
  actions?: ReactNode
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const token = useAdminAuthStore((state) => state.token)
  const admin = useAdminAuthStore((state) => state.admin)
  const hydrated = useAdminAuthStore((state) => state.hydrated)
  const logout = useAdminAuthStore((state) => state.logout)

  useEffect(() => {
    if (!hydrated) {
      return
    }

    if (!token || !admin) {
      router.replace('/admin/login')
      return
    }

    if (permission && !admin.permissions.includes(permission)) {
      router.replace('/admin/dashboard')
    }
  }, [admin, hydrated, permission, router, token])

  const allowedNavigation = useMemo(() => {
    const granted = new Set(admin?.permissions || [])
    return adminNavigation.filter((item) => granted.has(item.permission))
  }, [admin])

  if (!hydrated || !token || !admin) {
    return (
      <div className="min-h-screen bg-[#fff8f3]">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
          <div className="rounded-[32px] border border-orange-100 bg-white/90 px-8 py-10 shadow-[0_30px_90px_-40px_rgba(234,88,12,0.55)]">
            <div className="h-10 w-10 animate-pulse rounded-2xl bg-orange-200" />
            <p className="mt-4 text-sm font-medium text-slate-600">Loading Thinava control center...</p>
          </div>
        </div>
      </div>
    )
  }

  const handleLogout = () => {
    logout()
    router.replace('/admin/login')
  }

  const sidebar = (
    <div className="flex h-full flex-col justify-between rounded-[30px] bg-[#121212] p-5 text-white shadow-[0_35px_90px_-40px_rgba(15,23,42,0.9)]">
      <div>
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#fb923c,#ef4444)] text-xl font-bold text-white shadow-lg shadow-orange-500/30">
            T
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Thinava Ops</p>
            <h2 className={cn('text-xl font-bold text-white', spaceGrotesk.className)}>Admin Control</h2>
          </div>
        </div>

        <div className="mb-6 rounded-[26px] border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">Current operator</span>
            <Badge className="border-0 bg-emerald-500/15 text-emerald-300">Secure</Badge>
          </div>
          <p className="text-base font-semibold text-white">{admin.full_name}</p>
          <p className="mt-1 text-sm text-slate-400">{admin.email}</p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-orange-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            {admin.role.replace(/_/g, ' ')}
          </div>
        </div>

        <nav className="space-y-2">
          {allowedNavigation.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center justify-between rounded-2xl px-4 py-3 text-sm transition',
                  active
                    ? 'bg-[linear-gradient(135deg,rgba(251,146,60,0.95),rgba(239,68,68,0.95))] text-white'
                    : 'text-slate-300 hover:bg-white/6 hover:text-white'
                )}
              >
                <span className="inline-flex items-center gap-3">
                  <Icon className="h-4.5 w-4.5" />
                  {item.label}
                </span>
                <ChevronRight className={cn('h-4 w-4 opacity-60', active && 'opacity-100')} />
              </Link>
            )
          })}
        </nav>
      </div>

      <Button
        variant="ghost"
        onClick={handleLogout}
        className="justify-start rounded-2xl bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
      >
        <LogOut className="mr-2 h-4 w-4" />
        Logout
      </Button>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#fff8f3] text-slate-950">
      <AdminAuthBootstrap />
      <div className="absolute inset-x-0 top-0 h-[220px] bg-[linear-gradient(180deg,rgba(251,146,60,0.18),rgba(255,248,243,0.88)_78%,rgba(255,248,243,0))]" />
      <div className="relative mx-auto grid min-h-screen max-w-[1650px] gap-4 p-3 lg:grid-cols-[260px_minmax(0,1fr)] lg:p-4">
        <aside className="hidden lg:block">{sidebar}</aside>

        <div className="flex min-h-screen flex-col">
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <Button variant="outline" size="icon" onClick={() => setMobileOpen(true)} className="bg-white">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="rounded-full border border-orange-100 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
              {admin.full_name}
            </div>
          </div>

          {mobileOpen ? (
            <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm lg:hidden">
              <div className="absolute inset-y-4 left-4 w-[min(320px,calc(100%-2rem))]">
                <div className="absolute right-4 top-4 z-10">
                  <Button variant="secondary" size="icon" onClick={() => setMobileOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {sidebar}
              </div>
            </div>
          ) : null}

          <header className="sticky top-2 z-20 mb-4 rounded-2xl border border-orange-100/80 bg-white/90 px-4 py-4 shadow-[0_18px_54px_-38px_rgba(234,88,12,0.52)] backdrop-blur">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="mb-1.5 inline-flex items-center gap-2 rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Thinava Control Center
                </div>
                <h1 className={cn('text-2xl font-bold tracking-tight text-slate-950', spaceGrotesk.className)}>
                  {title}
                </h1>
                <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-2.5 py-2 text-xs font-semibold text-orange-800">
                  <Bell className="h-4 w-4" />
                  Live sync active
                </div>
                {actions}
              </div>
            </div>
          </header>

          <motion.main
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24 }}
            className="flex-1"
          >
            {children}
          </motion.main>
        </div>
      </div>
    </div>
  )
}
