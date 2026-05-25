'use client'

import { useEffect, useState } from 'react'
import { ImageIcon, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { fetchActiveHeroBanner, type MarketingBanner } from '@/lib/banner-api'
import { getCloudinaryBannerSrcSet, getOptimizedCloudinaryImageUrl } from '@/lib/cloudinary-image'

const RESTAURANTS_SECTION_ID = 'restaurants-section'

const resolveBannerHref = (banner: MarketingBanner) => {
  const target = banner.redirectTarget?.trim()

  switch (banner.redirectType) {
    case 'restaurants':
      return null
    case 'restaurant':
      return target ? `/restaurant/${target}` : '/restaurants'
    case 'category':
      return target ? `/restaurants?category=${encodeURIComponent(target)}` : '/restaurants'
    case 'offers':
      return '/restaurants?offers=true'
    case 'custom':
      return target || '/'
    default:
      return null
  }
}

export function HeroBanner({ className }: { className?: string }) {
  const router = useRouter()
  const [banner, setBanner] = useState<MarketingBanner | null>(null)
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    fetchActiveHeroBanner()
      .then((activeBanner) => {
        if (mounted) {
          setBanner(activeBanner)
          setFailedImageUrl(null)
        }
      })
      .catch(() => {
        if (mounted) {
          setBanner(null)
          setFailedImageUrl(null)
        }
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const handleClick = () => {
    if (!banner || banner.redirectType === 'restaurants') {
      document.getElementById(RESTAURANTS_SECTION_ID)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
      return
    }

    router.push(resolveBannerHref(banner) || '/restaurants')
  }

  const bannerImageUrl = banner?.imageUrl && failedImageUrl !== banner.imageUrl
    ? getOptimizedCloudinaryImageUrl(banner.imageUrl, {
        width: 1600,
        crop: 'limit',
        quality: 'auto:good',
      })
    : ''
  const bannerSrcSet = banner?.imageUrl && failedImageUrl !== banner.imageUrl
    ? getCloudinaryBannerSrcSet(banner.imageUrl)
    : undefined

  return (
    <section className={cn('py-4 sm:py-5 md:py-8 lg:py-9', className)}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.button
          type="button"
          onClick={handleClick}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: 'easeOut' }}
          className="group block w-full rounded-[1.25rem] text-left outline-none transition-transform duration-300 ease-out active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-[#FF6B35]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFF8F4] sm:rounded-[1.45rem] md:rounded-[1.7rem] lg:hover:scale-[1.008] xl:rounded-[1.75rem]"
          aria-label={banner ? banner.title : 'Browse restaurants near you'}
        >
          <span className="relative block h-[240px] w-full overflow-hidden rounded-[inherit] border border-white/80 bg-[linear-gradient(135deg,#FFF6EA_0%,#FFFDF8_50%,#FFEAD7_100%)] shadow-[0_18px_45px_-26px_rgba(31,41,55,0.34),0_10px_26px_-24px_rgba(255,107,53,0.42)] transition-shadow duration-300 ease-out group-hover:shadow-[0_26px_70px_-32px_rgba(31,41,55,0.42),0_18px_42px_-28px_rgba(255,107,53,0.52)] md:h-[320px] lg:h-[380px] xl:h-[420px]">
            {banner && bannerImageUrl ? (
              <img
                src={bannerImageUrl}
                srcSet={bannerSrcSet}
                sizes="(max-width: 640px) calc(100vw - 2rem), (max-width: 1024px) calc(100vw - 3rem), 1152px"
                alt={banner.title}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                draggable={false}
                onError={() => setFailedImageUrl(banner.imageUrl)}
                className="h-full w-full object-contain object-center transition-transform duration-500 ease-out group-hover:scale-[1.018] md:object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center px-6">
                <span className="max-w-md text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/75 text-[#FF6B35] shadow-[0_16px_34px_-22px_rgba(31,41,55,0.55)]">
                    {loading ? <Sparkles className="h-6 w-6 animate-pulse" /> : <ImageIcon className="h-6 w-6" />}
                  </span>
                  <span className="mt-4 block text-lg font-black tracking-tight text-[#18202B] md:text-2xl">
                    {loading ? 'Loading Thinava offers...' : 'Fresh offers are being prepared'}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-[#6B7280]">
                    {loading
                      ? 'Fetching the latest marketplace banner.'
                      : 'Explore restaurants while the next hero banner is scheduled.'}
                  </span>
                </span>
              </span>
            )}
          </span>
        </motion.button>
      </div>
    </section>
  )
}
