import { Suspense } from 'react'
import { RestaurantsClientPage } from '@/components/customer/RestaurantsClientPage'

export default async function RestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; query?: string }>
}) {
  const params = await searchParams

  return (
    <Suspense fallback={null}>
      <RestaurantsClientPage
        initialCategory={params.category || ''}
        initialQuery={params.query || ''}
      />
    </Suspense>
  )
}
