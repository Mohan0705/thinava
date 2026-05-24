'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Clock, Heart, LogOut, Settings } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/store/authStore'
import { customerAuthApi } from '@/features/auth/api'
import { toast } from 'sonner'
import { getUserInitials } from '@/features/auth/utils'

export default function ProfilePage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const stats = useAuthStore((state) => state.stats)
  const logout = useAuthStore((state) => state.logout)
  const addresses = user?.addresses || []

  const handleLogout = async () => {
    try {
      if (token) {
        await customerAuthApi.logout(token)
      }
    } catch {
      // Local session should still clear even if the server call fails.
    } finally {
      logout()
      toast.success('Logged out successfully')
      router.replace('/')
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500">
              <span className="text-3xl font-bold text-white">{getUserInitials(user)}</span>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">{user?.fullName || user?.name}</h2>
              <p className="text-gray-600">{user?.phone}</p>
              {user?.email ? <p className="text-sm text-gray-500">{user.email}</p> : null}
            </div>
            <Link href="/profile/settings" className="inline-flex">
              <Button variant="outline">Manage Account</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card>
          <CardContent className="p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Saved Addresses</h3>
                <p className="mt-1 text-gray-600">Use your frequent delivery locations for faster checkout.</p>
              </div>
              <Link href="/profile/addresses" className="inline-flex">
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            </div>

            <div className="space-y-4">
              {addresses.slice(0, 2).map((address) => (
                <div key={address.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{address.label}</span>
                        {address.isDefault ? (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-gray-600">{address.fullAddress}</p>
                      {address.landmark ? (
                        <p className="mt-1 text-sm text-gray-500">Landmark: {address.landmark}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Quick Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/orders" className="block rounded-xl border p-4 transition-colors hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-semibold text-gray-900">Order History</p>
                  <p className="text-sm text-gray-600">
                    {stats ? `${stats.total_orders} orders · last activity ${stats.last_order_at ? new Date(stats.last_order_at).toLocaleDateString('en-IN') : 'just now'}` : 'Track active orders and review delivered ones.'}
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/profile/favorites" className="block rounded-xl border p-4 transition-colors hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <Heart className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-semibold text-gray-900">Favorites</p>
                  <p className="text-sm text-gray-600">Jump back into the restaurants you order from most.</p>
                </div>
              </div>
            </Link>

            <Link href="/profile/app-settings" className="block rounded-xl border p-4 transition-colors hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-semibold text-gray-900">App Settings</p>
                  <p className="text-sm text-gray-600">Review notifications, privacy, and regional preferences.</p>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Button variant="destructive" className="w-full" size="lg" onClick={handleLogout}>
        <LogOut className="mr-2 h-5 w-5" />
        Logout
      </Button>
    </div>
  )
}
