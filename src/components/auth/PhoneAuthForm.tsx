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
        <label className="mb-2 block text-sm font-medium text-thinava-text">Mobile number</label>
        <div className="flex gap-2">
          <div className="flex h-12 shrink-0 items-center rounded-xl border border-thinava-border bg-thinava-bg px-3.5 text-sm font-semibold text-thinava-text">
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
        <p className="mt-2 text-xs text-gray-500">
          We&apos;ll automatically create your account if you&apos;re new.
        </p>
      </div>

      <div className="rounded-xl border border-orange-100 bg-orange-50 px-3.5 py-2.5 text-xs text-thinava-primary">
        Using development OTP mode. Check the toast or console for the code.
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? 'Sending OTP...' : 'Continue with OTP'}
      </Button>
    </form>
  )
}
