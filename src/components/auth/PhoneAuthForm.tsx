'use client'

import { FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function PhoneAuthForm({
  phone,
  loading,
  onPhoneChange,
  onSubmit,
}: {
  phone: string
  loading: boolean
  onPhoneChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Mobile Number</label>
        <div className="flex gap-3">
          <div className="flex h-12 items-center rounded-xl border-2 border-gray-200 bg-gray-50 px-4 font-semibold text-slate-700">
            +91
          </div>
          <Input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            enterKeyHint="done"
            pattern="[0-9]*"
            value={phone}
            onChange={(event) => onPhoneChange(event.target.value)}
            placeholder="98765 43210"
            className="flex-1"
          />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          We&apos;ll automatically create your account if you&apos;re new.
        </p>
      </div>

      <div className="rounded-2xl border border-orange-100 bg-orange-50/80 px-4 py-3 text-sm text-orange-800">
        Using development OTP mode. Check the toast or console for the code.
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? 'Sending OTP...' : 'Continue with OTP'}
      </Button>
    </form>
  )
}
