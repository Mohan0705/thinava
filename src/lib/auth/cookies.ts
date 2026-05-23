export type AuthScope = 'customer' | 'delivery' | 'restaurant' | 'admin'

export const AUTH_COOKIE_NAMES: Record<AuthScope, string> = {
  customer: 'thinava_customer_token',
  delivery: 'thinava_delivery_token',
  restaurant: 'thinava_restaurant_token',
  admin: 'thinava_admin_token',
}

export const AUTH_LOGIN_PATHS: Record<AuthScope, string> = {
  customer: '/login',
  delivery: '/delivery/login',
  restaurant: '/restaurant-auth',
  admin: '/admin/login',
}
