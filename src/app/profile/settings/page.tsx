'use client'

import { useEffect, useState, useRef } from 'react'
import { Mail, Phone, ShieldCheck, User } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { customerAuthApi } from '@/features/auth/api'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'

export default function ProfileSettingsPage() {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const initializedForUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user) {
      initializedForUserIdRef.current = null
      return
    }

    if (initializedForUserIdRef.current !== user.id) {
      setFullName(user.fullName || user.name || '')
      setEmail(user.email || '')
      initializedForUserIdRef.current = user.id
    }
  }, [user])

  const accountHighlights = [
    { icon: User, label: 'Full name', value: user?.fullName || user?.name || 'Thinava User' },
    { icon: Phone, label: 'Phone number', value: user?.phone || '' },
    { icon: Mail, label: 'Email address', value: user?.email || 'Add your email' },
  ]

  const handleSave = async () => {
    if (!token) {
      toast.error('Not authenticated')
      return
    }

    if (!fullName.trim()) {
      toast.error('Full name is required')
      return
    }

    setSaving(true)
    try {
      const updatedUser = await customerAuthApi.updateProfile(token, {
        full_name: fullName.trim(),
        email: email?.trim() || null,
      })
      
      setUser(updatedUser)
      toast.success('Profile updated successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
          <p className="text-sm text-gray-600">
            Review the primary contact details attached to your Thinava account.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {accountHighlights.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className="rounded-xl border border-thinava-border bg-thinava-bg p-4">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
                  <Icon className="h-5 w-5 text-thinava-primary" />
                </div>
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-thinava-text">{item.value}</p>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Protection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-900">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Your account is active</p>
                <p className="mt-1 text-sm text-green-800">
                  Saved addresses and order history are available on this profile now, and your
                  account details can be expanded here later with edit actions.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit Profile</CardTitle>
          <p className="text-sm text-gray-600">
            Keep your checkout identity, order updates, and saved account info current.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" />
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" type="email" />
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
