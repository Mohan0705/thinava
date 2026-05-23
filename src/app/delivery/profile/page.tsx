'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useDeliveryAuthStore } from '@/store/deliveryAuthStore'
import { deliveryApi } from '@/lib/delivery-api'
import { DeliveryPartner } from '@/types/delivery'
import {
  ArrowLeft,
  LogOut,
  User,
  Truck,
  FileText,
  Star,
  Phone,
  Mail,
  Award,
  Loader,
  Edit2,
} from 'lucide-react'
import { motion } from 'framer-motion'

export default function DeliveryProfilePage() {
  const router = useRouter()
  const token = useDeliveryAuthStore((state) => state.token)
  const partner = useDeliveryAuthStore((state) => state.partner)
  const logout = useDeliveryAuthStore((state) => state.logout)

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<DeliveryPartner | null>(null)

  useEffect(() => {
    if (!token) {
      router.push('/delivery/login')
      return
    }

    loadProfile()
  }, [token, router])

  const loadProfile = async () => {
    try {
      const result = await deliveryApi.getProfile(token!)
      setProfile(result.profile)
    } catch (error) {
      toast.error('Failed to load profile')
      router.push('/delivery/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    toast.success('Logged out successfully')
    router.push('/delivery/login')
  }

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader className="h-12 w-12 animate-spin text-orange-600" />
      </div>
    )
  }

  const sections = [
    {
      title: 'Personal Information',
      icon: User,
      color: 'bg-blue-100 text-blue-600',
      items: [
        { label: 'Full Name', value: profile.full_name },
        { label: 'Email', value: profile.email },
        { label: 'Phone', value: profile.phone },
      ],
    },
    {
      title: 'Vehicle Details',
      icon: Truck,
      color: 'bg-orange-100 text-orange-600',
      items: [
        { label: 'Vehicle Type', value: profile.vehicle_type },
        { label: 'Vehicle Number', value: profile.vehicle_number },
      ],
    },
    {
      title: 'Performance',
      icon: Award,
      color: 'bg-green-100 text-green-600',
      items: [
        { label: 'Total Deliveries', value: profile.total_deliveries },
        { label: 'Rating', value: profile.rating ? `${profile.rating} ⭐` : 'N/A' },
        { label: 'Status', value: profile.is_active ? 'Active' : 'Inactive' },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <Link href="/delivery/dashboard">
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Profile</h1>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-4 py-6 md:px-8">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-0 bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg">
            <CardContent className="p-8 text-white">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-3xl font-bold">{profile.full_name}</h2>
                  <div className="mt-3 flex items-center gap-4">
                    {profile.is_online && (
                      <div className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1">
                        <div className="h-2 w-2 rounded-full bg-green-300" />
                        <span className="text-xs font-medium">Online</span>
                      </div>
                    )}
                    {profile.is_active && (
                      <div className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1">
                        <span className="text-xs font-medium">✓ Active</span>
                      </div>
                    )}
                  </div>
                </div>
                <Star className="h-12 w-12 fill-yellow-300 text-yellow-300" />
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs opacity-80">Rating</p>
                  <p className="mt-1 text-2xl font-bold">{Number(profile.rating || 0).toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs opacity-80">Deliveries</p>
                  <p className="mt-1 text-2xl font-bold">{profile.total_deliveries}</p>
                </div>
                <div>
                  <p className="text-xs opacity-80">Member ID</p>
                  <p className="mt-1 text-xs font-mono">{profile.id.slice(0, 8)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Information Sections */}
        {sections.map((section, sectionIndex) => {
          const IconComponent = section.icon
          return (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: (sectionIndex + 1) * 0.1 }}
            >
              <Card className="border-0">
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <div className={`rounded-lg p-3 ${section.color}`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-gray-900">{section.title}</h3>
                  </div>

                  <div className="space-y-3">
                    {section.items.map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                        <span className="text-sm text-gray-600">{item.label}</span>
                        <span className="font-medium text-gray-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}

        {/* Documents Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <Card className="border-0">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-purple-100 p-3">
                  <FileText className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Documents</h3>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <span className="text-sm text-gray-600">Driving License</span>
                  {profile.driving_license ? (
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                      ✓ Verified
                    </span>
                  ) : (
                    <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                      Pending
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <span className="text-sm text-gray-600">Profile Image</span>
                  {profile.profile_image ? (
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                      ✓ Added
                    </span>
                  ) : (
                    <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                      Not Added
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Contact Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="grid grid-cols-2 gap-3"
        >
          <Button
            onClick={() => window.location.href = `tel:${profile.phone}`}
            variant="outline"
            className="gap-2"
          >
            <Phone className="h-4 w-4" />
            Call
          </Button>
          <Button
            onClick={() => window.location.href = `mailto:${profile.email}`}
            variant="outline"
            className="gap-2"
          >
            <Mail className="h-4 w-4" />
            Email
          </Button>
        </motion.div>

        {/* Logout Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.6 }}
        >
          <Button
            onClick={handleLogout}
            className="w-full gap-2 bg-red-600 py-3 hover:bg-red-700"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
