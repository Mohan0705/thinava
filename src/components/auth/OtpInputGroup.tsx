'use client'

import { useRef } from 'react'
import { Input } from '@/components/ui/Input'

export function OtpInputGroup({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const digits = Array.from({ length: 6 }, (_, index) => value[index] || '')

  const updateDigit = (index: number, nextDigit: string) => {
    const sanitized = nextDigit.replace(/\D/g, '').slice(-1)
    const nextValue = digits.map((digit, digitIndex) => (digitIndex === index ? sanitized : digit)).join('')
    onChange(nextValue)

    if (sanitized && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  return (
    <div className="grid grid-cols-6 gap-2">
      {digits.map((digit, index) => (
        <Input
          key={`otp-digit-${index}`}
          ref={(element) => {
            inputRefs.current[index] = element
          }}
          value={digit}
          onChange={(event) => updateDigit(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          inputMode="numeric"
          maxLength={1}
          className="h-14 px-0 text-center text-xl font-semibold"
        />
      ))}
    </div>
  )
}
