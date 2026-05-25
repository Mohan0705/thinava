import { apiRequest } from '@/lib/api'

export type BannerRedirectType = 'restaurants' | 'restaurant' | 'category' | 'offers' | 'custom'

export interface MarketingBanner {
  id: string
  title: string
  subtitle?: string | null
  imageUrl: string
  cloudinaryPublicId?: string | null
  redirectType: BannerRedirectType
  redirectTarget?: string | null
  isActive: boolean
  priority: number
  startsAt?: string | null
  endsAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export async function fetchActiveHeroBanner() {
  const response = await apiRequest<{ success: boolean; banner: MarketingBanner | null }>('/banners/active')
  return response.banner
}
