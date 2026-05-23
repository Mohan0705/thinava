import type { Address, User } from '@/types'

export interface AuthVerificationSession {
  verificationId: string
  phone: string
  countryCode: string
  fullName?: string
  email?: string
  expiresAt: string
  resendAvailableAt: string
  purpose: 'login' | 'signup'
}

export interface AuthProfileStats {
  total_orders: number
  total_spent: number
  last_order_at?: string | null
}

export interface AuthProfileResponse {
  user: User
  stats: AuthProfileStats
}

export interface SendOtpPayload {
  phone: string
  country_code: string
  full_name?: string
  email?: string
  purpose: 'login' | 'signup'
}

export interface VerifyOtpPayload extends SendOtpPayload {
  verification_id: string
  otp: string
}

export interface AuthSessionResponse {
  token: string
  user: User
  is_new_user: boolean
}

export interface AddressPayload {
  label: string
  address: string
  landmark?: string
  latitude?: number | null
  longitude?: number | null
  is_default: boolean
}

export type { Address, User }
