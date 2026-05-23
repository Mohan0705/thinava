import {
  Activity,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  Map,
  Percent,
  Settings,
  ShoppingBag,
  Store,
  Truck,
  Users,
  CheckCircle,
} from 'lucide-react'

export const adminPermissions = {
  dashboard: 'dashboard:view',
  orders: 'orders:view',
  restaurants: 'restaurants:view',
  delivery: 'delivery:view',
  customers: 'customers:view',
  analytics: 'analytics:view',
  payments: 'payments:view',
  support: 'support:view',
  settings: 'settings:view',
  promotions: 'promotions:view',
  map: 'map:view',
} as const

export const adminNavigation = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: adminPermissions.dashboard },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag, permission: adminPermissions.orders },
  { href: '/admin/restaurants', label: 'Restaurants', icon: Store, permission: adminPermissions.restaurants },
  { href: '/admin/delivery-partners', label: 'Riders', icon: Truck, permission: adminPermissions.delivery },
  { href: '/admin/approvals', label: 'Approvals', icon: CheckCircle, permission: adminPermissions.dashboard },
  { href: '/admin/customers', label: 'Customers', icon: Users, permission: adminPermissions.customers },
  { href: '/admin/analytics', label: 'Analytics', icon: Activity, permission: adminPermissions.analytics },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard, permission: adminPermissions.payments },
  { href: '/admin/support', label: 'Support', icon: LifeBuoy, permission: adminPermissions.support },
  { href: '/admin/live-map', label: 'Live Map', icon: Map, permission: adminPermissions.map },
  { href: '/admin/promotions', label: 'Promotions', icon: Percent, permission: adminPermissions.promotions },
  { href: '/admin/settings', label: 'Settings', icon: Settings, permission: adminPermissions.settings },
] as const
