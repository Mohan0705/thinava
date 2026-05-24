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
      className="fixed inset-x-0 bottom-0 z-50 md:hidden"
      aria-label="Main navigation"
    >
      <div className="mx-3 mb-[max(0.5rem,env(safe-area-inset-bottom))] overflow-hidden rounded-t-[1.35rem] border border-[#E5E7EB]/80 bg-white/98 shadow-[0_-8px_40px_-12px_rgba(17,24,39,0.18)] backdrop-blur-lg">
        <div className="flex items-stretch justify-around px-1 py-1.5">
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
                  'relative flex min-w-[3.25rem] flex-1 flex-col items-center gap-0.5 rounded-xl py-2 transition-all duration-200 thinava-touch',
                  isActive ? 'text-[#FF6B35]' : 'text-[#9CA3AF]'
                )}
              >
                {isActive ? (
                  <span className="absolute inset-x-1 top-1 h-9 rounded-xl bg-orange-50" />
                ) : null}
                <span className="relative">
                  <Icon
                    className={cn('h-[22px] w-[22px]', isActive && 'stroke-[2.25]')}
                    strokeWidth={isActive ? 2.25 : 2}
                  />
                  {item.badge && item.badge > 0 ? (
                    <span className="absolute -right-2.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF6B35] px-1 text-[9px] font-bold text-white ring-2 ring-white">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    'relative text-[10px] font-semibold',
                    isActive && 'text-[#FF6B35]'
                  )}
                >
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
