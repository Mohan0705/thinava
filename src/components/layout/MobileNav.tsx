'use client'

import Link from 'next/link'
import { Home, Search, ShoppingCart, User, Heart } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'

export default function MobileNav() {
  const pathname = usePathname()
  const itemCount = useCartStore((state) => state.getItemCount())
  const token = useAuthStore((state) => state.token)

  const navItems = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/restaurants', icon: Search, label: 'Explore' },
    { href: '/cart', icon: ShoppingCart, label: 'Cart', badge: itemCount },
    { href: '/profile/favorites', icon: Heart, label: 'Saved' },
    { href: token ? '/profile' : '/login', icon: User, label: 'Account' },
  ]

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-lg items-center justify-around rounded-2xl border border-thinava-border bg-white/95 px-1 py-1.5 shadow-nav backdrop-blur-md">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href ||
            (item.href === '/profile' && pathname?.startsWith('/profile'))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex min-w-[3.5rem] flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition-all duration-200 thinava-touch',
                isActive ? 'text-thinava-primary' : 'text-gray-500'
              )}
            >
              {isActive ? (
                <span className="absolute inset-x-2 top-1 h-8 rounded-lg bg-orange-50" />
              ) : null}
              <span className="relative">
                <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.25]')} />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-thinava-primary px-1 text-[9px] font-bold text-white">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                ) : null}
              </span>
              <span className={cn('relative text-[10px] font-semibold', isActive && 'text-thinava-primary')}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
