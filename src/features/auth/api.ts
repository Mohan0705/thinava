import { apiRequest } from '@/lib/api'
import type {
  AddressPayload,
  AuthProfileResponse,
  AuthSessionResponse,
  SendOtpPayload,
  VerifyOtpPayload,
} from '@/features/auth/types'
import { mapAddressResponse, mapUserResponse } from '@/features/auth/utils'

export const customerAuthApi = {
  async sendOtp(payload: SendOtpPayload) {
    const response = await apiRequest<{
      success: boolean
      verification_id: string
      phone: string
      expires_at: string
      resend_available_at: string
      helper_otp: string
    }>('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    return {
      verificationId: response.verification_id,
      phone: response.phone,
      expiresAt: response.expires_at,
      resendAvailableAt: response.resend_available_at,
      helperOtp: response.helper_otp,
    }
  },

  async verifyOtp(payload: VerifyOtpPayload): Promise<AuthSessionResponse> {
    const response = await apiRequest<{
      success: boolean
      token: string
      user: Record<string, any>
      is_new_user: boolean
    }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    return {
      token: response.token,
      user: mapUserResponse(response.user),
      is_new_user: response.is_new_user,
    }
  },

  async getProfile(token: string): Promise<AuthProfileResponse> {
    const response = await apiRequest<{
      success: boolean
      user: Record<string, any>
      stats: AuthProfileResponse['stats']
    }>('/auth/profile', { token })

    return {
      user: mapUserResponse(response.user),
      stats: response.stats,
    }
  },

  async updateProfile(token: string, payload: Record<string, unknown>): Promise<AuthProfileResponse['user']> {
    const response = await apiRequest<{
      success: boolean
      user: Record<string, any>
    }>('/auth/profile', {
      method: 'PUT',
      token,
      body: JSON.stringify(payload),
    })

    return mapUserResponse(response.user)
  },

  async getAddresses(token: string) {
    const response = await apiRequest<{
      success: boolean
      addresses: Array<Record<string, any>>
    }>('/auth/addresses', { token })

    return response.addresses.map(mapAddressResponse)
  },

  async createAddress(token: string, payload: AddressPayload) {
    const response = await apiRequest<{
      success: boolean
      address: Record<string, any>
    }>('/auth/addresses', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    })

    return mapAddressResponse(response.address)
  },

  async updateAddress(token: string, addressId: string, payload: AddressPayload) {
    const response = await apiRequest<{
      success: boolean
      address: Record<string, any>
    }>(`/auth/addresses/${addressId}`, {
      method: 'PUT',
      token,
      body: JSON.stringify(payload),
    })

    return mapAddressResponse(response.address)
  },

  async deleteAddress(token: string, addressId: string) {
    return apiRequest<{ success: boolean; message: string }>(`/auth/addresses/${addressId}`, {
      method: 'DELETE',
      token,
    })
  },

  async logout(token: string) {
    return apiRequest<{ success: boolean; message: string }>('/auth/logout', {
      method: 'POST',
      token,
    })
  },
}
