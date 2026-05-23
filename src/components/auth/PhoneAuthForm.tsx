'use client'

import { FormEvent } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function PhoneAuthForm({
  mode,
  phone,
  fullName,
  email,
  loading,
  onPhoneChange,
  onFullNameChange,
  onEmailChange,
  onSubmit,
}: {
  mode: 'login' | 'signup'
  phone: string
  fullName: string
  email: string
  loading: boolean
  onPhoneChange: (value: string) => void
  onFullNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
}) {
  const isSignup = mode === 'signup'

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {isSignup ? (
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Full Name</label>
          <Input value={fullName} onChange={(event) => onFullNameChange(event.target.value)} placeholder="Enter your full name" />
        </div>
      ) : null}

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Mobile Number</label>
        <div className="flex gap-3">
          <div className="flex h-12 items-center rounded-xl border-2 border-gray-200 bg-gray-50 px-4 font-semibold text-slate-700">
            +91
          </div>
          <Input
            inputMode="numeric"
            value={phone}
            onChange={(event) => onPhoneChange(event.target.value)}
            placeholder="98765 43210"
            className="flex-1"
          />
        </div>
      </div>

      {isSignup ? (
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
          <Input type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="Optional email address" />
        </div>
      ) : null}

      <div className="rounded-2xl border border-orange-100 bg-orange-50/80 px-4 py-3 text-sm text-orange-800">
        Development mode is using a static OTP. You’ll verify with <span className="font-semibold">123456</span>.
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? 'Sending OTP...' : 'Continue with OTP'}
      </Button>

      <p className="text-center text-sm text-slate-500">
        {isSignup ? 'Already have an account?' : 'New to Thinava?'}{' '}
        <Link href={isSignup ? '/login' : '/signup'} className="font-semibold text-orange-600 hover:text-orange-700">
          {isSignup ? 'Login' : 'Create account'}
        </Link>
      </p>
    </form>
  )
}
