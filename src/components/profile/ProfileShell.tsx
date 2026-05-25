'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Clock,
  Heart,
  HelpCircle,
  Home,
  MapPin,
  Settings,
  User,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import MobileNav from '@/components/layout/MobileNav'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

const profileNavItems = [
  { href: '/profile', label: 'Overview', icon: Home },
  { href: '/profile/settings', label: 'Account Settings', icon: User },
  { href: '/profile/addresses', label: 'Saved Addresses', icon: MapPin },
  { href: '/profile/favorites', label: 'Favorites', icon: Heart },
  { href: '/orders', label: 'Order History', icon: Clock },
  { href: '/profile/help', label: 'Help & Support', icon: HelpCircle },
  { href: '/profile/app-settings', label: 'App Settings', icon: Settings },
]

const isActiveItem = (pathname: string, href: string) => {
  if (href === '/profile') return pathname === href
  return pathname === href
}

export function ProfileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="thinava-page-mobile">
      <Header />

      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-thinava-primary">My account</p>
          <h1 className="mt-1 text-xl font-bold text-thinava-text md:text-2xl">Profile & preferences</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Manage your details, saved places, favourites, and support options.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardContent className="p-1.5">
                <nav className="space-y-0.5">
                  {profileNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive = isActiveItem(pathname || '', item.href)

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                          isActive
                            ? 'bg-orange-50 font-semibold text-thinava-primary'
                            : 'text-gray-600 hover:bg-thinava-bg'
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-lg',
                            isActive ? 'bg-white text-thinava-primary shadow-sm' : 'bg-thinava-bg text-gray-500'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        {item.label}
                      </Link>
                    )
                  })}
                </nav>
              </CardContent>
            </Card>
          </aside>

          <main>{children}</main>
        </div>
      </div>

      <Footer />
      <MobileNav />
    </div>
  )
}
