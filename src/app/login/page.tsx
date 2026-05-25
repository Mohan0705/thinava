'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AuthScreenShell } from '@/components/auth/AuthScreenShell'
import { PhoneAuthForm } from '@/components/auth/PhoneAuthForm'
import { customerAuthApi } from '@/features/auth/api'
import { useAuthStore } from '@/store/authStore'
import { normalizePhoneDigits } from '@/features/auth/utils'

export default function LoginPage() {
  const router = useRouter()
  const token = useAuthStore((state) => state.token)
  const hydrated = useAuthStore((state) => state.hydrated)
  const setPendingVerification = useAuthStore((state) => state.setPendingVerification)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const getNextPath = () => {
    if (typeof window === 'undefined') {
      return '/'
    }

    return new URLSearchParams(window.location.search).get('next') || '/'
  }

  useEffect(() => {
    if (hydrated && token) {
      router.replace(getNextPath())
    }
  }, [hydrated, router, token])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const normalizedPhone = normalizePhoneDigits(phone)

    if (normalizedPhone.length !== 10) {
      toast.error('Enter a valid 10 digit mobile number')
      return
    }

    setLoading(true)

    try {
      const result = await customerAuthApi.sendOtp({
        phone: normalizedPhone,
        country_code: '+91',
        purpose: 'login',
      })

      setPendingVerification({
        verificationId: result.verificationId,
        phone: normalizedPhone,
        countryCode: '+91',
        expiresAt: result.expiresAt,
        resendAvailableAt: result.resendAvailableAt,
        purpose: 'login',
        helperOtp: result.helperOtp,
      })

      if (result.helperOtp) {
        toast.success(`Dev mode: use OTP ${result.helperOtp}`)
      } else {
        toast.success('OTP sent to your phone')
      }
      router.push(`/verify-otp?next=${encodeURIComponent(getNextPath())}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send OTP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthScreenShell
      eyebrow="Continue"
      title="Enter your mobile number to continue."
      description="We&apos;ll send a one-time code and automatically create your Thinava account if you&apos;re new."
      footer={
        <>
          By continuing, you agree to Thinava&apos;s <Link href="/terms" className="font-semibold text-orange-600">Terms</Link> and <Link href="/privacy" className="font-semibold text-orange-600">Privacy Policy</Link>.
        </>
      }
    >
      <PhoneAuthForm
        phone={phone}
        loading={loading}
        onPhoneChange={setPhone}
        onSubmit={handleSubmit}
      />
    </AuthScreenShell>
  )
}
