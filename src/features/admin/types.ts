export type AdminRole =
  | 'super_admin'
  | 'operations_admin'
  | 'finance_admin'
  | 'support_admin'

export interface AdminUser {
  id: string
  email: string
  full_name: string
  role: AdminRole
  permissions: string[]
  last_login_at?: string | null
}

export interface AdminSession {
  token: string
  admin: AdminUser
}

export interface AdminMetricSet {
  orders_today: number
  active_deliveries: number
  online_riders: number
  active_restaurants: number
  revenue_today: number
  failed_orders: number
  average_delivery_time: number
  platform_commission: number
}

export interface ActivityFeedItem {
  id: string
  type: string
  description: string
  time: string
  severity: 'info' | 'warning' | 'critical'
}

export interface ChartPoint {
  [key: string]: string | number
}

export interface AdminOrder {
  id: string
  status: string
  status_label: string
  delivery_status: string
  delivery_status_label: string
  total: number
  subtotal: number
  delivery_fee: number
  tax: number
  item_count: number
  payment_method: string
  created_at: string
  updated_at: string
  delivery_assigned_at?: string | null
  delivered_at?: string | null
  elapsed_minutes: number
  delivered_minutes?: number | null
  is_delayed: boolean
  platform_commission_amount: number
  admin_flagged: boolean
  cancellation_reason?: string | null
  payout_status?: string | null
  area: string
  customer: {
    id: string
    name: string
    phone: string
    email?: string | null
    is_blocked: boolean
    fraud_score: number
    address: string
    landmark?: string | null
    latitude: number
    longitude: number
  }
  restaurant: {
    id: string
    name: string
    rating: number
    status: string
    commission_percentage: number
    latitude: number
    longitude: number
  }
  rider: {
    id: string
    name: string
    phone: string
    is_online: boolean
    current_status: string
    approval_status: string
    latitude: number
    longitude: number
    location_timestamp?: string | null
  } | null
}

export interface RestaurantAdminRecord {
  id: string
  name: string
  cuisines: string[]
  rating: number
  featured: boolean
  is_open: boolean
  status: string
  approval_status: string
  is_suspended: boolean
  commission_percentage: number
  complaints_count: number
  zone_name: string
  total_orders: number
  cancelled_orders: number
  active_orders: number
  revenue: number
}

export interface DeliveryPartnerAdminRecord {
  id: string
  full_name: string
  phone: string
  email?: string | null
  vehicle_type?: string | null
  vehicle_number?: string | null
  is_online: boolean
  is_active: boolean
  rating: number
  total_deliveries: number
  current_status: string
  approval_status: string
  document_status: string
  vehicle_verification_status: string
  is_suspended: boolean
  force_offline: boolean
  earnings_balance: number
  total_earnings: number
  assignment_count: number
  last_seen_at?: string | null
  home_zone: string
  latitude: number
  longitude: number
}

export interface CustomerAdminRecord {
  id: string
  name: string
  phone: string
  email?: string | null
  created_at: string
  is_blocked: boolean
  fraud_score: number
  total_orders: number
  total_spent: number
  last_order_at?: string | null
  complaint_count: number
}

export interface PayoutTransaction {
  id: string
  entity_type: string
  entity_name: string
  order_id?: string | null
  amount: number
  commission_amount: number
  settlement_amount: number
  status: string
  payout_reference?: string | null
  due_date?: string | null
  settled_at?: string | null
  notes?: string | null
  created_at: string
}

export interface SupportTicket {
  id: string
  customer_id?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  order_id?: string | null
  restaurant_name?: string | null
  assigned_admin_id?: string | null
  assigned_admin_name?: string | null
  category: string
  subject: string
  description: string
  status: string
  priority: string
  resolution_notes?: string | null
  refund_amount: number
  created_at: string
  updated_at: string
}

export interface CouponCode {
  id: string
  code: string
  title: string
  description?: string | null
  discount_type: string
  discount_value: number
  minimum_order_amount: number
  max_discount_amount: number
  usage_limit: number
  used_count: number
  is_active: boolean
  target_audience: string
  featured_restaurant_id?: string | null
  featured_restaurant_name?: string | null
  starts_at?: string | null
  ends_at?: string | null
}

export type BannerRedirectType = 'restaurants' | 'restaurant' | 'category' | 'offers' | 'custom'

export interface MarketingBanner {
  id: string
  title: string
  subtitle?: string | null
  imageUrl: string
  cloudinaryPublicId?: string | null
  redirectType: BannerRedirectType
  redirectTarget?: string | null
  isActive: boolean
  priority: number
  startsAt?: string | null
  endsAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface PlatformSetting {
  id: string
  setting_key: string
  setting_value: unknown
  description?: string | null
  category: string
  updated_by_name?: string | null
  updated_at: string
}

export interface LiveMapRider {
  id: string
  name: string
  status: string
  latitude: number
  longitude: number
  order_id: string
  area: string
  is_online: boolean
}

export interface LiveMapDelivery {
  id: string
  restaurant_name: string
  customer_name: string
  rider_name: string
  status: string
  area: string
  route: Array<{
    latitude: number
    longitude: number
  }>
}

export interface LiveMapRestaurant {
  id: string
  name: string
  latitude: number
  longitude: number
}

export interface LiveMapHotspot {
  zone: string
  intensity: number
  latitude: number
  longitude: number
}

export interface LiveMapPayload {
  center: {
    lat: number
    lng: number
  }
  riders: LiveMapRider[]
  restaurants: LiveMapRestaurant[]
  deliveries: LiveMapDelivery[]
  hotspots: LiveMapHotspot[]
}
