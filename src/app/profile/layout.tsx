import { ProfileShell } from '@/components/profile/ProfileShell'
import { CustomerRouteGuard } from '@/components/auth/CustomerRouteGuard'

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <CustomerRouteGuard>
      <ProfileShell>{children}</ProfileShell>
    </CustomerRouteGuard>
  )
}
