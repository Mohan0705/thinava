export interface User {
  id: string
  name: string
  fullName?: string
  phone: string
  email?: string
  profileImage?: string
  isVerified?: boolean
  createdAt?: string
  updatedAt?: string
  lastLogin?: string
  addresses: Address[]
}

export interface Address {
  id: string
  label: string
  addressType?: 'Home' | 'Office' | 'Other'
  address?: string
  fullAddress: string
  landmark?: string
  latitude?: number | null
  longitude?: number | null
  isDefault: boolean
  receiverName?: string
  receiverPhone?: string
  useAccountDetails?: boolean
  legacyAddressId?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface Restaurant {
  id: string
  name: string
  image: string
  logo: string
  rating: number
  ratingCount?: number
  deliveryTime: string
  priceForOne: number
  cuisines: string[]
  offer?: string
  featured: boolean
  isOpen: boolean
  isOpenNow?: boolean
  displayStatus?: 'OPEN' | 'CLOSED' | 'MANUALLY_CLOSED' | string
  nextOpeningTime?: string | null
  closesAt?: string | null
  isOvernightSchedule?: boolean
  timezone?: string
  isManuallyClosed?: boolean
  bannerImage?: string
  description?: string
  status?: string
  formattedAddress?: string
  latitude?: number | null
  longitude?: number | null
}

export interface MenuItem {
  id: string
  restaurantId: string
  name: string
  description: string
  price: number
  image: string
  category: string
  isVeg: boolean
  isBestseller: boolean
  inStock?: boolean
  categoryId?: string
}

export interface CartItem {
  menuItem: MenuItem
  quantity: number
}

export interface Order {
  id: string
  userId: string
  restaurant: Restaurant
  items: CartItem[]
  address: Address
  subtotal: number
  deliveryFee: number
  tax: number
  total: number
  status:
    | 'placed'
    | 'accepted'
    | 'preparing'
    | 'ready_for_pickup'
    | 'out_for_delivery'
    | 'delivered'
    | 'cancelled'
  paymentMethod: 'cod' | 'upi'
  createdAt: string
  estimatedDelivery: string
}

export interface Category {
  id: string
  name: string
  image: string
}
