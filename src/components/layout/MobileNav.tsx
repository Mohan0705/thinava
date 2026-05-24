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
    <nav className="fixed inset-x-0 bottom-0 z-50 md:hidden" aria-label="Main navigation">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#FFF8F4] via-[#FFF8F4]/92 to-transparent" />
      <div className="relative mx-3 mb-[max(0.75rem,env(safe-area-inset-bottom))] overflow-hidden rounded-[1.8rem] border border-white/80 bg-white/96 shadow-[0_24px_44px_-24px_rgba(17,24,39,0.28)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#FF6B35]/25 to-transparent" />
        <div className="flex items-stretch justify-around px-2 py-2">
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
                  'relative flex min-w-[3.25rem] flex-1 flex-col items-center gap-1 rounded-[1.2rem] px-1 py-2.5 transition-all duration-200 thinava-touch',
                  isActive ? 'text-[#FF6B35]' : 'text-[#9CA3AF]'
                )}
              >
                {isActive ? (
                  <span className="absolute inset-x-1 inset-y-1 rounded-[1.1rem] bg-[linear-gradient(180deg,#FFF1E9_0%,#FFF7F2_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]" />
                ) : null}
                <span className="relative">
                  <Icon
                    className={cn('h-[22px] w-[22px] transition-transform duration-200', isActive && 'scale-105 stroke-[2.25]')}
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
                    'relative text-[10px] font-semibold tracking-tight',
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
