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
  if (href === '/profile') {
    return pathname === href
  }

  return pathname === href
}

export function ProfileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-orange-500">
            My Account
          </p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Profile & Preferences</h1>
          <p className="mt-2 max-w-2xl text-gray-600">
            Manage your account details, saved places, favourites, and support options without
            leaving the profile area.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <Card>
              <CardContent className="p-2">
                <div className="space-y-1">
                  {profileNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive = isActiveItem(pathname || '', item.href)

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-4 py-3 transition-colors',
                          isActive
                            ? 'bg-orange-50 text-orange-600'
                            : 'text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-full',
                            isActive ? 'bg-orange-100' : 'bg-gray-100'
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
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
