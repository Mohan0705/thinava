'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AuthScreenShell } from '@/components/auth/AuthScreenShell'
import { PhoneAuthForm } from '@/components/auth/PhoneAuthForm'
import { customerAuthApi } from '@/features/auth/api'
import { normalizePhoneDigits } from '@/features/auth/utils'
import { useAuthStore } from '@/store/authStore'

export default function SignupPage() {
  const router = useRouter()
  const token = useAuthStore((state) => state.token)
  const hydrated = useAuthStore((state) => state.hydrated)
  const setPendingVerification = useAuthStore((state) => state.setPendingVerification)
  const [phone, setPhone] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const getNextPath = () => {
    if (typeof window === 'undefined') {
      return '/'
    }

    return new URLSearchParams(window.location.search).get('next') || '/'
  }

  // Intentionally do not auto-redirect when a token exists so the signup
  // form can be accessed for testing and account creation while signed-in.

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const normalizedPhone = normalizePhoneDigits(phone)

    if (!fullName.trim()) {
      toast.error('Enter your full name')
      return
    }

    if (normalizedPhone.length !== 10) {
      toast.error('Enter a valid 10 digit mobile number')
      return
    }

    setLoading(true)

    try {
      const result = await customerAuthApi.sendOtp({
        phone: normalizedPhone,
        country_code: '+91',
        full_name: fullName.trim(),
        email: email.trim() || undefined,
        purpose: 'signup',
      })

      setPendingVerification({
        verificationId: result.verificationId,
        phone: normalizedPhone,
        countryCode: '+91',
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        expiresAt: result.expiresAt,
        resendAvailableAt: result.resendAvailableAt,
        purpose: 'signup',
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
      eyebrow="Signup"
      title="Create your Thinava account."
      description="Save delivery addresses, move through checkout faster, and keep every order tied to your phone number."
    >
      <PhoneAuthForm
        mode="signup"
        phone={phone}
        fullName={fullName}
        email={email}
        loading={loading}
        onPhoneChange={setPhone}
        onFullNameChange={setFullName}
        onEmailChange={setEmail}
        onSubmit={handleSubmit}
      />
    </AuthScreenShell>
  )
}
