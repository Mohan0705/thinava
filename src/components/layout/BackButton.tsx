'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BackButton({
  fallbackHref = '/',
  className,
  dark = false,
  label = 'Go back',
}: {
  fallbackHref?: string
  className?: string
  dark?: boolean
  label?: string
}) {
  const router = useRouter()

  const handleBack = () => {
    if (
      typeof window !== 'undefined' &&
      window.history.length > 1 &&
      (!document.referrer || document.referrer.startsWith(window.location.origin))
    ) {
      router.back()
      return
    }

    router.push(fallbackHref)
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={label}
      className={cn(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition active:scale-95',
        dark
          ? 'bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-sm hover:bg-white/18'
          : 'border border-white/80 bg-white text-[#111827] shadow-[0_12px_24px_-16px_rgba(17,24,39,0.2)] hover:bg-[#FFF8F4]',
        className
      )}
    >
      <ChevronLeft className="h-5 w-5" />
    </button>
  )
}
