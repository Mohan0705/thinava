'use client'

import Link from 'next/link'
import { ShoppingCart, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import LiveSearchBar from '@/components/customer/LiveSearchBar'

export default function Header() {
  const itemCount = useCartStore((state) => state.getItemCount())
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)

  return (
    <header className="sticky top-0 z-40 border-b border-thinava-border/80 bg-white/90 backdrop-blur-md">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl thinava-gradient-bg shadow-sm">
              <span className="text-base font-bold text-white">T</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-thinava-text">
              Thinava
            </span>
          </Link>

          <div className="hidden min-w-0 flex-1 md:block">
            <LiveSearchBar />
          </div>

          <div className="ml-auto flex items-center gap-1">
            {!token ? (
              <Link href="/login" className="hidden sm:inline-flex">
                <Button variant="ghost" size="sm" className="font-semibold">
                  Login
                </Button>
              </Link>
            ) : null}

            <Link href="/cart">
              <Button
                variant="ghost"
                size="icon"
                className="relative text-thinava-text"
                aria-label="Cart"
              >
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-thinava-primary px-1 text-[10px] font-bold text-white">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                ) : null}
              </Button>
            </Link>

            <Link href={token ? '/profile' : '/login'}>
              <Button variant="ghost" size="icon" className="text-thinava-text" aria-label="Profile">
                {token && user ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full thinava-gradient-bg text-xs font-bold text-white">
                    {(user.fullName || user.name || 'C').charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <User className="h-5 w-5" />
                )}
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-3 md:hidden">
          <LiveSearchBar />
        </div>
      </div>
    </header>
  )
}
