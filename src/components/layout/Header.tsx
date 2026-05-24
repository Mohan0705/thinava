'use client'

import Link from 'next/link'
import { ChevronDown, MapPin, ShoppingCart, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import LiveSearchBar from '@/components/customer/LiveSearchBar'
import { cn } from '@/lib/utils'

type HeaderProps = {
  immersive?: boolean
}

export default function Header({ immersive = false }: HeaderProps) {
  const itemCount = useCartStore((state) => state.getItemCount())
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)

  const defaultAddress = user?.addresses?.find((a) => a.isDefault) || user?.addresses?.[0]
  const locationLabel = defaultAddress?.label || 'Tadepalligudem'
  const locationPreview =
    defaultAddress?.fullAddress ||
    defaultAddress?.address ||
    'Fresh food from trusted local restaurants'

  const standardHeader = (
    <header className="sticky top-0 z-40 border-b border-thinava-border/80 bg-white/95 backdrop-blur-md">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl thinava-gradient-bg shadow-sm">
              <span className="text-base font-bold text-white">T</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-[#111827]">Thinava</span>
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
              <Button variant="ghost" size="icon" className="relative" aria-label="Cart">
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-thinava-primary px-1 text-[10px] font-bold text-white">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                ) : null}
              </Button>
            </Link>

            <Link href={token ? '/profile' : '/login'}>
              <Button variant="ghost" size="icon" aria-label="Profile">
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

  if (immersive) {
    return (
      <>
      <header className="sticky top-0 z-50 md:hidden">
        <div className="bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#1F2937] px-4 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-[0_12px_40px_-12px_rgba(15,23,42,0.55)]">
          <div className="flex items-start justify-between gap-3">
            <Link href={token ? '/profile/addresses' : '/login'} className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                  <MapPin className="h-4 w-4 text-[#FF8A5B]" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="truncate text-sm font-bold text-white">{locationLabel}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-white/70" />
                  </div>
                  <p className="truncate text-xs text-white/60">{locationPreview}</p>
                </div>
              </div>
            </Link>

            <div className="flex shrink-0 items-center gap-1">
              <Link href="/cart" aria-label="Cart">
                <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white">
                  <ShoppingCart className="h-5 w-5" />
                  {itemCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FF6B35] px-1 text-[10px] font-bold text-white">
                      {itemCount > 9 ? '9+' : itemCount}
                    </span>
                  ) : null}
                </span>
              </Link>
              <Link href={token ? '/profile' : '/login'} aria-label="Profile">
                {token && user ? (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full thinava-gradient-bg text-sm font-bold text-white shadow-md">
                    {(user.fullName || user.name || 'C').charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white">
                    <User className="h-5 w-5" />
                  </span>
                )}
              </Link>
            </div>
          </div>

          <div className="mt-3 pb-3">
            <LiveSearchBar elevated />
          </div>
        </div>
        <div className="h-4 rounded-t-[1.35rem] bg-[#FFF8F4]" />
      </header>
      <div className="hidden md:block">{standardHeader}</div>
      </>
    )
  }

  return standardHeader
}