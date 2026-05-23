'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Shield, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { adminApi } from '@/features/admin/api'
import { useAdminAuthStore } from '@/features/admin/auth-store'

export default function AdminLoginPage() {
  const router = useRouter()
  const setSession = useAdminAuthStore((state) => state.setSession)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)

  if (pageError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fffaf5] px-4">
        <div className="max-w-lg rounded-[2rem] border border-orange-100 bg-white p-8 text-center shadow-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-950">Login unavailable</h1>
          <p className="mt-3 text-sm text-slate-600">{pageError}</p>
          <Button
            type="button"
            className="mt-6"
            onClick={() => {
              setPageError(null)
              window.location.reload()
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)

    try {
      console.log('[ADMIN_AUTH_DEBUG] Attempting login for:', email)
      const session = await adminApi.login(email, password)
      setSession({ token: session.token, admin: session.admin })
      toast.success('Thinava control center unlocked')
      router.replace('/admin/dashboard')
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to sign in'
      console.error('[ADMIN_AUTH_ERROR] Login failed:', msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#fff7ed_0%,#fff1f2_48%,#fff7ed_100%)]">
      <div className="mx-auto grid min-h-screen max-w-[1500px] gap-8 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <div className="flex flex-col justify-between rounded-[36px] border border-orange-100 bg-[#121212] p-8 text-white shadow-[0_35px_120px_-55px_rgba(15,23,42,0.85)]">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full bg-white/5 px-4 py-2 text-sm text-orange-100">
              <Shield className="h-4 w-4" />
              Thinava Admin Control Center
            </div>
            <h1 className="mt-8 max-w-xl text-5xl font-semibold leading-tight">
              Dispatch, revenue, support, and platform control in one live console.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
              Built for Tadepalligudem operations with live order visibility, rider dispatch oversight, payout monitoring,
              promotion controls, and support resolution workflows.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl">
            <Card className="rounded-[34px] border border-white/80 bg-white/95 shadow-[0_35px_100px_-55px_rgba(234,88,12,0.6)]">
              <CardContent className="p-8">
                <div className="mb-8 flex items-center gap-4">
                  <div className="rounded-2xl bg-[linear-gradient(135deg,#fb923c,#ef4444)] p-3 text-white shadow-lg shadow-orange-500/30">
                    <Shield className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-slate-950">Admin Sign In</h2>
                    <p className="mt-1 text-sm text-slate-500">Secure access for Thinava operations teams.</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Admin Email</label>
                    <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@thinava.com" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter your password"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Signing in...' : 'Enter Control Center'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
