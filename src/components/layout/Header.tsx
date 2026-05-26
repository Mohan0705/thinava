'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, MapPin, ShoppingCart, User } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import LiveSearchBar from '@/components/customer/LiveSearchBar'
import { cn } from '@/lib/utils'
import { BackButton } from '@/components/layout/BackButton'
import { reverseGeocode } from '@/lib/maps/nominatim'

type HeaderProps = {
  immersive?: boolean
}

export default function Header({ immersive = false }: HeaderProps) {
  const pathname = usePathname()
  const itemCount = useCartStore((state) => state.getItemCount())
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const [detectedLocation, setDetectedLocation] = useState<string | null>(null)

  const defaultAddress = user?.addresses?.find((address) => address.isDefault) || user?.addresses?.[0]
  const locationPreview =
    defaultAddress?.fullAddress ||
    defaultAddress?.address ||
    detectedLocation ||
    'Tadepalligudem, Andhra Pradesh'
  const locationLabel = defaultAddress?.addressType || defaultAddress?.label || (detectedLocation ? 'Nearby' : 'Home')
  const showBackButton = Boolean(pathname && pathname !== '/')

  useEffect(() => {
    if (defaultAddress || typeof window === 'undefined') {
      return
    }

    let isMounted = true
    const controller = new AbortController()
    const cached = window.localStorage.getItem('thinava_detected_location_preview')
    if (cached) {
      setDetectedLocation(cached)
      return
    }

    if (!navigator.geolocation || window.sessionStorage.getItem('thinava_location_prompted') === 'true') {
      return
    }

    window.sessionStorage.setItem('thinava_location_prompted', 'true')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        reverseGeocode({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }, controller.signal)
          .then((result) => {
            if (!isMounted) {
              return
            }

            setDetectedLocation(result.shortName || result.displayName)
            window.localStorage.setItem(
              'thinava_detected_location_preview',
              result.shortName || result.displayName
            )
          })
          .catch(() => {
            if (!isMounted || controller.signal.aborted) {
              return
            }

            const fallback = 'Current location detected'
            setDetectedLocation(fallback)
            window.localStorage.setItem('thinava_detected_location_preview', fallback)
          })
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 12000 }
    )

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [defaultAddress])

  const renderLocationBlock = (dark: boolean) => (
    <Link
      href={token ? '/profile/addresses' : '/login'}
      className="group min-w-0 flex-1 basis-0 overflow-visible"
      aria-label="Manage delivery address"
    >
      <div className="flex min-w-0 items-start gap-3">
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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span
              className={cn(
                'truncate text-[1.1rem] font-black tracking-tight',
                dark ? 'text-white' : 'text-[#111827]'
              )}
            >
              {locationLabel}
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 transition',
                dark ? 'text-white/65 group-hover:text-white' : 'text-[#6B7280] group-hover:text-[#111827]'
              )}
            />
          </div>
          <p className={cn('truncate text-sm', dark ? 'text-white/85' : 'text-[#5B6472]')}>
            {locationPreview}
          </p>
        </div>
      </div>
    </Link>
  )

  const actionButtonClass = (dark: boolean) =>
    cn(
      'relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-visible rounded-full transition duration-200 active:scale-95 md:h-11 md:w-11',
      dark
        ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-sm hover:bg-white/16'
        : 'border border-[#E5E7EB] bg-white text-[#111827] shadow-sm hover:border-[#FFD0BC] hover:bg-[#FFF8F4]'
    )

  const renderHeaderActions = (dark: boolean) => (
    <nav
      className="relative z-[80] ml-auto flex min-w-[5.75rem] shrink-0 items-center justify-end gap-2 overflow-visible pl-1 sm:gap-2.5"
      aria-label="Header actions"
    >
      {!dark && !token ? (
        <Link
          href="/login"
          className="hidden h-10 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-white/95 px-4 text-sm font-semibold text-[#111827] shadow-sm transition hover:border-[#FFD0BC] hover:bg-[#FFF8F4] lg:inline-flex"
        >
          Login
        </Link>
      ) : null}

      <Link href="/cart" aria-label="Cart" className={actionButtonClass(dark)}>
        <ShoppingCart className="h-5 w-5 shrink-0" />
        {itemCount > 0 ? (
          <span className="pointer-events-none absolute -right-1.5 -top-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF6B35] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {itemCount > 9 ? '9+' : itemCount}
          </span>
        ) : null}
      </Link>

      <Link
        href={token ? '/profile' : '/login'}
        aria-label="Profile"
        className={
          token && user
            ? cn(
                'relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-visible rounded-full thinava-gradient-bg text-sm font-bold text-white shadow-md ring-2 transition duration-200 active:scale-95 md:h-11 md:w-11',
                dark ? 'ring-white/20' : 'ring-white'
              )
            : actionButtonClass(dark)
        }
      >
        {token && user ? (
          (user.fullName || user.name || 'C').charAt(0).toUpperCase()
        ) : (
          <User className="h-5 w-5 shrink-0" />
        )}
      </Link>
    </nav>
  )

  const renderStandardHeader = (className?: string) => (
    <header
      className={cn(
        'sticky top-0 z-[70] overflow-visible border-b border-white/70 bg-[#FFF8F4]/92 backdrop-blur-xl',
        className
      )}
    >
      <div className="mx-auto w-full max-w-7xl overflow-visible px-4 py-3 pr-5 sm:px-6 sm:pr-7 lg:px-8 lg:pr-10">
        <div className="flex min-w-0 items-center gap-2 overflow-visible sm:gap-3 lg:gap-4">
          {showBackButton ? <BackButton /> : null}
          <div className="min-w-0 flex-1 overflow-visible md:flex-[0_1_15rem] lg:flex-[0_1_17.5rem]">
            {renderLocationBlock(false)}
          </div>
          <div className="hidden min-w-0 flex-1 overflow-visible md:block">
            <LiveSearchBar />
          </div>
          {renderHeaderActions(false)}
        </div>

        <div className="mt-3 overflow-visible md:hidden">
          <LiveSearchBar />
        </div>
      </div>
    </header>
  )

  if (immersive) {
    return (
      <>
        <header className="sticky top-0 z-[70] md:hidden">
          <div className="relative overflow-visible bg-[linear-gradient(135deg,#0f172a_0%,#162544_55%,#1f2937_100%)] px-4 pb-2 pt-[max(0.85rem,env(safe-area-inset-top))] shadow-[0_16px_40px_-20px_rgba(15,23,42,0.7)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_28%)]" />
            <div className="absolute -left-14 top-2 h-28 w-28 rounded-full bg-[#FF6B35]/18 blur-3xl" />
            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[#F59E0B]/18 blur-3xl" />

            <div className="relative flex items-start justify-between gap-3 overflow-visible">
              {showBackButton ? <BackButton dark /> : null}
              {renderLocationBlock(true)}
              {renderHeaderActions(true)}
            </div>

            <div className="relative mt-4 pb-3">
              <LiveSearchBar elevated />
            </div>
          </div>
          <div className="h-5 rounded-t-[1.6rem] bg-[#FFF8F4]" />
        </header>
        {renderStandardHeader('hidden md:block')}
      </>
    )
  }

  return renderStandardHeader()
}
