'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AuthScreenShell } from '@/components/auth/AuthScreenShell'
import { OtpInputGroup } from '@/components/auth/OtpInputGroup'
import { Button } from '@/components/ui/Button'
import { customerAuthApi } from '@/features/auth/api'
import { useAuthStore } from '@/store/authStore'
import { formatIndianPhone } from '@/features/auth/utils'

export default function VerifyOtpPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const pendingVerification = useAuthStore((state) => state.pendingVerification)
  const setAuth = useAuthStore((state) => state.setAuth)
  const setPendingVerification = useAuthStore((state) => state.setPendingVerification)
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [now, setNow] = useState<number | null>(null)

  // Phase 1: Mount on client only
  useEffect(() => {
    setMounted(true)
    setNow(Date.now())
  }, [])

  // Phase 2: Validation and timer (after mount)
  useEffect(() => {
    if (!mounted) return

    if (!pendingVerification) {
      router.replace('/login')
      return
    }

    if (new Date(pendingVerification.expiresAt).getTime() <= Date.now()) {
      setPendingVerification(null)
      toast.error('Your OTP session expired. Request a new code to continue.')
      router.replace(pendingVerification.purpose === 'signup' ? '/signup' : '/login')
      return
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [mounted, pendingVerification, router, setPendingVerification])

  const getNextPath = () => {
    if (typeof window === 'undefined') {
      return '/'
    }
    return new URLSearchParams(window.location.search).get('next') || '/'
  }

  const resendRemaining = useMemo(() => {
    if (!mounted || !pendingVerification || now === null) {
      return 0
    }

    return Math.max(
      0,
      Math.ceil((new Date(pendingVerification.resendAvailableAt).getTime() - now) / 1000)
    )
  }, [now, pendingVerification, mounted])

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault()
    if (!pendingVerification) {
      return
    }

    if (otp.length !== 6) {
      toast.error('Enter the full 6 digit OTP')
      return
    }

    setLoading(true)

    try {
      const session = await customerAuthApi.verifyOtp({
        verification_id: pendingVerification.verificationId,
        phone: pendingVerification.phone,
        country_code: pendingVerification.countryCode,
        full_name: pendingVerification.fullName,
        email: pendingVerification.email,
        purpose: pendingVerification.purpose,
        otp,
      })

      const profile = await customerAuthApi.getProfile(session.token)
      setAuth(profile.user, session.token, profile.stats)
      toast.success(session.is_new_user ? 'Welcome to Thinava' : 'Login successful')
      router.replace(getNextPath())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to verify OTP'

      if (message.includes('OTP expired') || message.includes('OTP session not found')) {
        setPendingVerification(null)
        toast.error(message)
        router.replace(pendingVerification.purpose === 'signup' ? '/signup' : '/login')
        return
      }

      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!pendingVerification) {
      return
    }

    setResendLoading(true)
    try {
      const result = await customerAuthApi.sendOtp({
        phone: pendingVerification.phone,
        country_code: pendingVerification.countryCode,
        full_name: pendingVerification.fullName,
        email: pendingVerification.email,
        purpose: pendingVerification.purpose,
      })
      
      console.log('OTP RESPONSE:', result)
      console.log('DEV OTP:', result.helperOtp)

      setPendingVerification({
        ...pendingVerification,
        verificationId: result.verificationId,
        expiresAt: result.expiresAt,
        resendAvailableAt: result.resendAvailableAt,
        helperOtp: result.helperOtp,
      })
      if (result.helperOtp) {
        toast.success(`Dev mode: use OTP ${result.helperOtp}`)
      } else {
        toast.success('OTP resent')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to resend OTP')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <AuthScreenShell
      eyebrow="Verify OTP"
      title="Almost there."
      description={mounted && pendingVerification ? `Enter the 6 digit code sent to ${formatIndianPhone(pendingVerification.phone || '')}.` : 'Enter the 6 digit verification code.'}
    >
      {mounted && pendingVerification ? (
        <form onSubmit={handleVerify} className="space-y-5">
          <OtpInputGroup value={otp} onChange={setOtp} />

          {mounted && pendingVerification.helperOtp && (
            <div className="rounded-xl bg-orange-100 border border-orange-300 p-4 shadow-md">
              <p className="font-bold text-orange-900">
                Development OTP: {pendingVerification.helperOtp}
              </p>
              <p className="text-sm text-orange-700 mt-2">Click below to auto-fill</p>
            </div>
          )}
          
          {mounted && pendingVerification.helperOtp && (
            <Button 
              type="button" 
              variant="outline" 
              className="w-full" 
              onClick={() => pendingVerification.helperOtp && setOtp(pendingVerification.helperOtp)}
            >
              Auto-fill OTP
            </Button>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify and Continue'}
          </Button>

          <div className="text-center text-sm text-slate-500" suppressHydrationWarning>
            {resendRemaining > 0 ? (
              <span>Resend available in {resendRemaining}s</span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resendLoading}
                className="font-semibold text-orange-600 hover:text-orange-700"
              >
                {resendLoading ? 'Resending...' : 'Resend OTP'}
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="text-center text-slate-500">Loading...</div>
      )}
    </AuthScreenShell>
  )
}
