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

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const pastedValue = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)

    if (!pastedValue) {
      return
    }

    onChange(pastedValue)
    inputRefs.current[Math.min(pastedValue.length, 6) - 1]?.focus()
  }

  return (
    <div className="grid grid-cols-6 gap-2 sm:gap-3">
      {digits.map((digit, index) => (
        <Input
          key={`otp-digit-${index}`}
          ref={(element) => {
            inputRefs.current[index] = element
          }}
          value={digit}
          onChange={(event) => updateDigit(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
          type="tel"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          enterKeyHint={index === 5 ? 'done' : 'next'}
          maxLength={1}
          pattern="[0-9]*"
          aria-label={`OTP digit ${index + 1}`}
          placeholder=""
          className="h-14 min-w-0 px-0 text-center text-[20px] font-semibold leading-none caret-orange-500 [text-align-last:center]"
        />
      ))}
    </div>
  )
}
