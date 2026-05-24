import { redirect } from 'next/navigation'

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const next = resolvedSearchParams?.next

  redirect(next ? `/login?next=${encodeURIComponent(next)}` : '/login')
}
