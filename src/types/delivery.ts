export type DeliveryStatus =
  | 'AVAILABLE'
  | 'OFFLINE'
  | 'ASSIGNED'
  | 'ARRIVED_AT_RESTAURANT'
  | 'PICKED_UP'
  | 'REACHED_CUSTOMER'
  | 'DELIVERED'
  | 'CANCELLED'

export interface DeliveryPayoutBreakdown {
  base_pay: number
  distance_pay: number
  surge_bonus: number
  rain_bonus?: number
  night_bonus?: number
  tip_amount?: number
  cod_handling_bonus?: number
  total: number
}

export interface DeliveryPartner {
  id: string
  full_name: string
  phone: string
  email: string
  profile_image?: string
  vehicle_type?: string
  vehicle_number?: string
  driving_license?: string
  is_online: boolean
  is_active: boolean
  rating: number
  average_rating?: number
  rating_count?: number
  rating_sum?: number
  total_deliveries: number
  current_status: DeliveryStatus
  current_order_id?: string
  approval_status?: string
  is_suspended?: boolean
  force_offline?: boolean
  acceptance_rate?: number
  cancellation_rate?: number
  online_minutes_today?: number
  online_since?: string | null
  cash_in_hand?: number
  bank_account_name?: string
  bank_account_number?: string
  bank_ifsc_code?: string
  upi_id?: string
  created_at: string
  updated_at: string
}

export interface RiderWallet {
  id: string
  delivery_partner_id: string
  floating_cash: number
  floating_cash_limit: number
  pending_settlement: number
  last_settlement_at?: string
  created_at: string
  updated_at: string
}

export interface CashPickupRequest {
  id: string
  amount: number
  status: string
  notes?: string
  admin_notes?: string
  created_at: string
  resolved_at?: string
}

export interface RiderZone {
  id: string
  zone_name: string
  is_active: boolean
  center_latitude?: number
  center_longitude?: number
  radius_meters?: number
}

export interface AvailableOrder {
  id: string
  restaurant_id: string
  restaurant_name: string
  restaurant_image: string
  customer_address: string
  customer_landmark?: string
  customer_name: string
  customer_phone: string
  subtotal: number
  delivery_fee: number
  tax: number
  total: number
  item_count: number
  delivery_time: string
  created_at: string
  payment_method?: string
  payment_type?: 'COD' | 'PREPAID'
  restaurant_address?: string
  restaurant_latitude?: number
  restaurant_longitude?: number
  customer_latitude?: number
  customer_longitude?: number
  route_distance_km?: number
  pickup_distance_km?: number
  dropoff_distance_km?: number
  estimated_pickup_eta_minutes?: number
  estimated_dropoff_eta_minutes?: number
  estimated_total_eta_minutes?: number
  estimated_earnings?: number
  payout_breakdown?: DeliveryPayoutBreakdown
  surge_badge?: boolean
  rain_badge?: boolean
  night_badge?: boolean
  map_provider?: string
}

export interface OrderItem {
  id: string
  name: string
  quantity: number
  price: number
  image: string
}

export interface ActiveOrder {
  id: string
  restaurant_id: string
  restaurant_name: string
  restaurant_image: string
  restaurant_address?: string
  customer_id: string
  customer_name: string
  customer_phone: string
  customer_address: string
  customer_landmark?: string
  customer_latitude?: number
  customer_longitude?: number
  subtotal: number
  delivery_fee: number
  tax: number
  total: number
  payment_method: string
  payment_type?: 'COD' | 'PREPAID'
  delivery_assigned_at?: string
  delivery_status: string
  assignment_status?: string
  route_distance_km?: number
  pickup_distance_km?: number
  dropoff_distance_km?: number
  estimated_pickup_eta_minutes?: number
  estimated_dropoff_eta_minutes?: number
  estimated_total_eta_minutes?: number
  estimated_earnings?: number
  per_km_rate?: number
  night_badge?: boolean
  payout_breakdown?: DeliveryPayoutBreakdown
  restaurant_latitude?: number
  restaurant_longitude?: number
  gps_validation?: {
    required_radius_meters: number
    restaurant: {
      distance_meters: number | null
      inside_range: boolean
    }
    customer: {
      distance_meters: number | null
      inside_range: boolean
    }
    next_target?: {
      scope: 'restaurant' | 'customer'
      label: string
      distance_meters: number | null
      inside_range: boolean
      required_radius_meters: number
    } | null
  }
  action_state?: {
    current_status: string
    next_status?: string | null
    next_action_label?: string | null
    next_action_enabled: boolean
    target_scope?: 'restaurant' | 'customer' | null
    disabled_reason?: string | null
    helper_text?: string | null
  }
  items: OrderItem[]
  created_at: string
}

export interface DeliveryLocation {
  id: string
  delivery_partner_id: string
  order_id?: string
  latitude: number
  longitude: number
  accuracy?: number
  timestamp: string
}

export interface DeliveryEarnings {
  deliveries: number
  total_amount: number
  total_incentive: number
  avg_distance?: number
}

export interface EarningRecord {
  id: string
  order_id: string
  restaurant_name: string
  customer_name: string
  amount: number
  incentive: number
  distance_km: number
  duration_minutes: number
  earned_at: string
}

export interface DeliveryAuthSession {
  token: string
  partner: DeliveryPartner
}

export interface DeliveryRegistrationResponse {
  success?: boolean
  requires_approval: boolean
  approval_status: string
  partner: Pick<DeliveryPartner, 'id' | 'full_name' | 'phone' | 'email' | 'created_at'> & {
    approval_status?: string
  }
}

export interface DeliveryShift {
  id: string
  delivery_partner_id: string
  shift_date: string
  slot_label: string
  zone_name?: string
  starts_at: string
  ends_at: string
  demand_level: string
  incentive_amount: number
  status: string
  created_at: string
  updated_at: string
}

export interface DeliveryRealtimeOrderSnapshot {
  id: string
  user_id: string
  restaurant_id: string
  delivery_partner_id?: string | null
  status: string
  delivery_status: string
  payment_method?: string
  total: number
  route_distance_km?: number | null
  estimated_total_eta_minutes?: number | null
  created_at: string
  updated_at: string
  customer_name?: string
  restaurant_name?: string
  rider_name?: string
  rider_phone?: string
  rider_profile_image?: string
  rider_vehicle_type?: string
  rider_vehicle_number?: string
  customer_address?: string
  customer_latitude?: number | null
  customer_longitude?: number | null
  restaurant_latitude?: number | null
  restaurant_longitude?: number | null
  rider_latitude?: number | null
  rider_longitude?: number | null
}

export interface DeliveryRealtimeEvent {
  event: string
  changed_at: string
  order: DeliveryRealtimeOrderSnapshot
  source?: string
  status?: string
  order_status?: string
  partner_id?: string
  order_id?: string
  reason?: string
  location?: {
    latitude: number
    longitude: number
    accuracy?: number | null
  } | null
}
