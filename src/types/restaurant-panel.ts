export type RestaurantOrderStatus =
  | 'PLACED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'

export type RestaurantStatus = 'OPEN' | 'CLOSED' | 'MANUALLY_CLOSED' | 'TEMPORARILY_UNAVAILABLE'

export interface RestaurantOwner {
  id: string
  email: string
  full_name: string
  role: 'restaurant_owner'
  restaurant: {
    id: string
    name: string
    logo: string
    status: RestaurantStatus
  }
}

export interface RestaurantDashboardSummary {
  total_orders_today: number
  pending_orders: number
  active_menu_items: number
  restaurant_status: RestaurantStatus
  active_offer: string
  average_rating: number
  total_reviews: number
}

export interface RestaurantPanelOrderItem {
  id: string
  menu_item_id: string
  quantity: number
  price: number
  name: string
  image: string
  notes: string
}

export interface RestaurantPanelOrder {
  id: string
  restaurant_id: string
  status: RestaurantOrderStatus
  total: number
  payment_method: string
  payment_status: string
  estimated_delivery: string
  created_at: string
  updated_at: string
  customer: {
    name: string
    phone: string
  }
  items: RestaurantPanelOrderItem[]
  rider: {
    name: string
    phone: string
  } | null
}

export interface RestaurantCategory {
  id: string
  restaurant_id: string
  name: string
  description?: string
  display_order: number
  item_count: number
  created_at: string
  updated_at: string
}

export interface RestaurantPanelMenuItem {
  id: string
  restaurant_id: string
  name: string
  description?: string
  price: number
  image: string
  category: string
  category_id: string | null
  category_name: string
  is_veg: boolean
  is_bestseller: boolean
  in_stock: boolean
  created_at: string
  updated_at: string
}

export interface RestaurantPanelSettings {
  id: string
  name: string
  image: string
  logo: string
  banner_image?: string
  description?: string
  cuisines: string[]
  offer?: string
  delivery_time: string
  price_for_one: number
  minimum_order: number
  delivery_radius_km: number
  formatted_address?: string
  place_id?: string
  latitude?: number | null
  longitude?: number | null
  opening_time?: string
  closing_time?: string
  status: RestaurantStatus
  stored_status?: RestaurantStatus
  is_open: boolean
  isOpenNow?: boolean
  displayStatus?: RestaurantStatus
  nextOpeningTime?: string | null
  closesAt?: string | null
  isOvernightSchedule?: boolean
  timezone?: string
  is_manually_closed?: boolean
  rating: number
}

export interface RestaurantAnalyticsSummary {
  totalOrders: number
  totalRevenue: number
  completedOrders: number
  cancelledOrders: number
  avgOrderValue: number
  average_rating: number
  total_reviews: number
}

export interface RestaurantReview {
  restaurant_rating: number | null
  food_quality: number | null
  review_text: string | null
  customer_name: string
  created_at: string
}

export interface RestaurantSalesTrend {
  date: string
  revenue: number
  orders: number
}

export interface RestaurantTopDish {
  name: string
  quantity: number
  revenue: number
}

export interface RestaurantPeakHour {
  hour: number
  orders: number
}

export interface RestaurantAnalytics {
  summary: RestaurantAnalyticsSummary
  salesTrend: RestaurantSalesTrend[]
  topDishes: RestaurantTopDish[]
  peakHours: RestaurantPeakHour[]
  reviews: RestaurantReview[]
}
