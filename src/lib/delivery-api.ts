import { apiRequest } from '@/lib/api'
import {
  DeliveryAuthSession,
  DeliveryPartner,
  AvailableOrder,
  ActiveOrder,
  DeliveryLocation,
  DeliveryEarnings,
  EarningRecord,
  DeliveryShift,
  DeliveryRegistrationResponse,
  RiderWallet,
  CashPickupRequest,
} from '@/types/delivery'

export interface DeliveryLoginPayload {
  phone: string
  password: string
}

export interface DeliveryRegisterPayload {
  full_name: string
  phone: string
  email: string
  password: string
  vehicle_type: string
  vehicle_number: string
}

export const deliveryApi = {
  // Auth
  register(payload: DeliveryRegisterPayload) {
    return apiRequest<DeliveryRegistrationResponse>('/delivery/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  login(payload: DeliveryLoginPayload) {
    return apiRequest<DeliveryAuthSession>('/delivery/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  getProfile(token: string) {
    return apiRequest<{ success: boolean; profile: DeliveryPartner }>(
      '/delivery/auth/profile',
      { token }
    )
  },

  updateProfile(token: string, payload: { profile_image?: string | null }) {
    return apiRequest<{ success: boolean; profile: DeliveryPartner }>(
      '/delivery/auth/profile',
      {
        method: 'PATCH',
        token,
        body: JSON.stringify(payload),
      }
    )
  },

  setOnlineStatus(token: string, isOnline: boolean) {
    return apiRequest<{ success: boolean; is_online: boolean; online_since?: string | null }>(
      '/delivery/auth/online-status',
      {
        method: 'POST',
        token,
        body: JSON.stringify({ is_online: isOnline }),
      }
    )
  },

  updateStatus(token: string, status: string) {
    return apiRequest<{ success: boolean; current_status: string }>(
      '/delivery/auth/status',
      {
        method: 'POST',
        token,
        body: JSON.stringify({ status }),
      }
    )
  },

  // Orders
  getAvailableOrders(token: string) {
    return apiRequest<{ success: boolean; orders: AvailableOrder[] }>('/delivery/orders', {
      token,
    })
  },

  acceptOrder(token: string, orderId: string) {
    return apiRequest<{ success: boolean; order_id: string }>(
      '/delivery/orders/accept',
      {
        method: 'POST',
        token,
        body: JSON.stringify({ order_id: orderId }),
      }
    )
  },

  confirmAssignedOrder(token: string, orderId: string) {
    return apiRequest<{ success: boolean; order: ActiveOrder }>(
      '/delivery/orders/confirm-assignment',
      {
        method: 'POST',
        token,
        body: JSON.stringify({ order_id: orderId }),
      }
    )
  },

  getAssignmentRequest(token: string) {
    return apiRequest<{ success: boolean; order: ActiveOrder | null }>(
      '/delivery/orders/assignment-request',
      { token }
    )
  },

  rejectOrder(token: string, orderId: string) {
    return apiRequest<{ success: boolean; message: string }>(
      '/delivery/orders/reject',
      {
        method: 'POST',
        token,
        body: JSON.stringify({ order_id: orderId }),
      }
    )
  },

  getActiveOrder(token: string) {
    return apiRequest<{ success: boolean; order: ActiveOrder | null; current_location: DeliveryLocation | null }>(
      '/delivery/orders/active',
      { token }
    )
  },

  updateDeliveryStatus(
    token: string,
    orderId: string,
    status: string,
    latitude?: number,
    longitude?: number
  ) {
    return apiRequest<{ success: boolean; message: string }>(
      '/delivery/orders/status',
      {
        method: 'POST',
        token,
        body: JSON.stringify({
          order_id: orderId,
          status,
          latitude,
          longitude,
        }),
      }
    )
  },

  reportFoodNotReady(token: string, orderId: string, reason?: string) {
    return apiRequest<{ success: boolean; message: string }>(
      '/delivery/orders/food-not-ready',
      {
        method: 'POST',
        token,
        body: JSON.stringify({ order_id: orderId, reason }),
      }
    )
  },

  // Location
  updateLocation(token: string, orderId: string | null, latitude: number, longitude: number, accuracy?: number) {
    return apiRequest<{ success: boolean; location: DeliveryLocation }>(
      '/delivery/location',
      {
        method: 'POST',
        token,
        body: JSON.stringify({
          order_id: orderId,
          latitude,
          longitude,
          accuracy,
        }),
      }
    )
  },

  getLatestLocation(token: string) {
    return apiRequest<{ success: boolean; location: DeliveryLocation | null }>(
      '/delivery/location',
      { token }
    )
  },

  getLocationHistory(token: string, orderId: string, limit = 100) {
    const params = new URLSearchParams({
      order_id: orderId,
      limit: limit.toString(),
    })
    return apiRequest<{ success: boolean; locations: DeliveryLocation[] }>(
      `/delivery/location/history?${params.toString()}`,
      { token }
    )
  },

  // Earnings
  getTodayEarnings(token: string) {
    return apiRequest<{ success: boolean; earnings: DeliveryEarnings }>(
      '/delivery/earnings/today',
      { token }
    )
  },

  getWeekEarnings(token: string) {
    return apiRequest<{ success: boolean; earnings: DeliveryEarnings }>(
      '/delivery/earnings/week',
      { token }
    )
  },

  getMonthEarnings(token: string) {
    return apiRequest<{ success: boolean; earnings: DeliveryEarnings }>(
      '/delivery/earnings/month',
      { token }
    )
  },

  getEarningsHistory(token: string, limit = 50) {
    const params = new URLSearchParams({
      limit: limit.toString(),
    })
    return apiRequest<{ success: boolean; history: EarningRecord[] }>(
      `/delivery/earnings/history?${params.toString()}`,
      { token }
    )
  },

  getShifts(token: string) {
    return apiRequest<{ success: boolean; shifts: DeliveryShift[] }>(
      '/delivery/shifts',
      { token }
    )
  },

  bookShift(
    token: string,
    payload: {
      slot_label: string
      zone_name?: string
      starts_at: string
      ends_at: string
      demand_level?: string
      incentive_amount?: number
    }
  ) {
    return apiRequest<{ success: boolean; shift: DeliveryShift }>(
      '/delivery/shifts/book',
      {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      }
    )
  },

  // Wallet
  getWallet(token: string) {
    return apiRequest<{ success: boolean; wallet: RiderWallet }>(
      '/delivery/wallet',
      { token }
    )
  },

  getFloatingCashStatus(token: string) {
    return apiRequest<{ success: boolean; floating_cash: number; floating_cash_limit: number; percent_used: number; is_warning: boolean; is_critical: boolean }>(
      '/delivery/wallet/floating-cash',
      { token }
    )
  },

  requestCashPickup(token: string, notes?: string) {
    return apiRequest<{ success: boolean; request: CashPickupRequest }>(
      '/delivery/wallet/request-pickup',
      {
        method: 'POST',
        token,
        body: JSON.stringify({ notes }),
      }
    )
  },

  getCashPickupRequests(token: string) {
    return apiRequest<{ success: boolean; requests: CashPickupRequest[] }>(
      '/delivery/wallet/pickup-requests',
      { token }
    )
  },

  getSupportInfo(token: string) {
    return apiRequest<{ success: boolean; phone: string; whatsapp: string; email: string }>(
      '/delivery/support',
      { token }
    )
  },
}
