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

  const defaultAddress = user?.addresses?.find((address) => address.isDefault) || user?.addresses?.[0]
  const locationPreview =
    defaultAddress?.fullAddress ||
    defaultAddress?.address ||
    'Tadepalligudem, Andhra Pradesh'

  const renderLocationBlock = (dark: boolean) => (
    <Link
      href={token ? '/profile/addresses' : '/login'}
      className="group min-w-0 flex-1"
      aria-label="Manage delivery address"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
            dark
              ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-sm'
              : 'border border-white/80 bg-white text-[#111827] shadow-[0_12px_24px_-16px_rgba(17,24,39,0.18)]'
          )}
        >
          <MapPin className="h-4 w-4 text-[#FF8A5B]" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span
              className={cn(
                'truncate text-[1.1rem] font-black tracking-tight',
                dark ? 'text-white' : 'text-[#111827]'
              )}
            >
              Home
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 transition',
                dark ? 'text-white/65 group-hover:text-white' : 'text-[#6B7280] group-hover:text-[#111827]'
              )}
            />
          </div>
          <p className={cn('truncate text-sm', dark ? 'text-white/68' : 'text-[#6B7280]')}>
            {locationPreview}
          </p>
        </div>
      </div>
    </Link>
  )

  const headerActions = (
    <div className="flex shrink-0 items-center gap-2">
      {!immersive && !token ? (
        <Link href="/login" className="hidden lg:inline-flex">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full border-[#E5E7EB] bg-white/90 px-4 font-semibold shadow-sm"
          >
            Login
          </Button>
        </Link>
      ) : null}

      <Link href="/cart" aria-label="Cart">
        <span
          className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-full',
            immersive
              ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
              : 'border border-[#E5E7EB] bg-white text-[#111827] shadow-sm'
          )}
        >
          <ShoppingCart className="h-5 w-5" />
          {itemCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FF6B35] px-1 text-[10px] font-bold text-white">
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
          <span
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full',
              immersive
                ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
                : 'border border-[#E5E7EB] bg-white text-[#111827] shadow-sm'
            )}
          >
            <User className="h-5 w-5" />
          </span>
        )}
      </Link>
    </div>
  )

  const standardHeader = (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-[#FFF8F4]/92 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="max-w-[260px] min-w-0">{renderLocationBlock(false)}</div>
          <div className="hidden min-w-0 flex-1 md:block">
            <LiveSearchBar />
          </div>
          {headerActions}
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
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#162544_55%,#1f2937_100%)] px-4 pb-2 pt-[max(0.85rem,env(safe-area-inset-top))] shadow-[0_16px_40px_-20px_rgba(15,23,42,0.7)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_28%)]" />
            <div className="absolute -left-14 top-2 h-28 w-28 rounded-full bg-[#FF6B35]/18 blur-3xl" />
            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[#F59E0B]/18 blur-3xl" />

            <div className="relative flex items-start justify-between gap-3">
              {renderLocationBlock(true)}
              {headerActions}
            </div>

            <div className="relative mt-4 pb-3">
              <LiveSearchBar elevated />
            </div>
          </div>
          <div className="h-5 rounded-t-[1.6rem] bg-[#FFF8F4]" />
        </header>
        <div className="hidden md:block">{standardHeader}</div>
      </>
    )
  }

  return standardHeader
}
