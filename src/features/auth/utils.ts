import type { Address, User } from '@/types'

export const normalizePhoneDigits = (value: string) => value.replace(/\D/g, '').slice(-10)

export const formatIndianPhone = (value: string, countryCode = '+91') => {
  const digits = normalizePhoneDigits(value)
  if (!digits) {
    return countryCode
  }

  return `${countryCode} ${digits.slice(0, 5)} ${digits.slice(5)}`
}

export const getUserInitials = (user?: Pick<User, 'name' | 'fullName'> | null) => {
  const name = user?.fullName || user?.name || 'Thinava User'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export const mapAddressResponse = (address: Record<string, any>): Address => ({
  id: address.id,
  label: address.label,
  addressType: address.address_type || address.addressType || undefined,
  address: address.address || address.full_address || address.fullAddress,
  fullAddress: address.address || address.full_address || address.fullAddress,
  landmark: address.landmark || undefined,
  latitude:
    address.latitude === null || address.latitude === undefined ? null : Number(address.latitude),
  longitude:
    address.longitude === null || address.longitude === undefined ? null : Number(address.longitude),
  isDefault: Boolean(address.is_default ?? address.isDefault),
  receiverName: address.receiver_name || address.receiverName || undefined,
  receiverPhone: address.receiver_phone || address.receiverPhone || undefined,
  useAccountDetails: Boolean(address.use_account_details ?? address.useAccountDetails ?? true),
  legacyAddressId: address.legacy_address_id || address.legacyAddressId || null,
  createdAt: address.created_at || address.createdAt,
  updatedAt: address.updated_at || address.updatedAt,
})

export const mapUserResponse = (user: Record<string, any>): User => ({
  id: user.id,
  name: user.name || user.full_name || user.fullName || 'Thinava User',
  fullName: user.full_name || user.fullName || user.name || 'Thinava User',
  phone: user.phone,
  email: user.email || undefined,
  profileImage: user.profile_image || user.profileImage || undefined,
  isVerified: Boolean(user.is_verified ?? user.isVerified),
  createdAt: user.created_at || user.createdAt,
  updatedAt: user.updated_at || user.updatedAt,
  lastLogin: user.last_login || user.lastLogin,
  addresses: Array.isArray(user.addresses) ? user.addresses.map(mapAddressResponse) : [],
})
