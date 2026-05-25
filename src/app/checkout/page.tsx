'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Phone, CreditCard, Clock, Sparkles, TicketPercent, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { CustomerRouteGuard } from '@/components/auth/CustomerRouteGuard'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { API_BASE_URL } from '@/lib/api'
import { fetchRestaurant } from '@/lib/customer-api'
import { formatPrice, calculateDeliveryFee, calculateTax } from '@/lib/utils'
import { Restaurant } from '@/types'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import MobileNav from '@/components/layout/MobileNav'
import { getOptimizedCloudinaryImageUrl } from '@/lib/cloudinary-image'
import { toast } from 'sonner'
import { getRestaurantReopenText, isRestaurantAcceptingOrders } from '@/lib/restaurant-availability'

// Dynamic database coupons will be loaded from the backend API

export default function CheckoutPage() {
  const { items, getSubtotal, clearCart } = useCartStore()
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const router = useRouter()
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'upi'>('cod')
  const [loading, setLoading] = useState(false)
  const [contactName, setContactName] = useState(user?.name || '')
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || '')
  const [email, setEmail] = useState(user?.email || '')
  const [couponCode, setCouponCode] = useState('')
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null)
  const [activeCoupons, setActiveCoupons] = useState<any[]>([])
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null)
  const [discountAmount, setDiscountAmount] = useState(0)

  const subtotal = getSubtotal()
  const deliveryFee = calculateDeliveryFee(subtotal)
  const tax = calculateTax(subtotal)
  const baseTotal = subtotal + deliveryFee + tax
  const total = Math.max(baseTotal - discountAmount, 0)

  const addresses = user?.addresses || []

  const restaurantId = items[0]?.menuItem.restaurantId
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const restaurantUnavailable = Boolean(restaurant && !isRestaurantAcceptingOrders(restaurant))

  useEffect(() => {
    let isMounted = true

    const loadRestaurant = async () => {
      if (!restaurantId) {
        setRestaurant(null)
        return
      }

      try {
        const liveRestaurant = await fetchRestaurant(restaurantId)
        if (isMounted) {
          setRestaurant(liveRestaurant)
        }
      } catch (error) {
        if (isMounted) {
          setRestaurant(null)
        }
      }
    }

    loadRestaurant()

    return () => {
      isMounted = false
    }
  }, [restaurantId])

  // Load active coupons — refreshes every 30s for admin-created coupon sync
  useEffect(() => {
    const loadCoupons = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/coupons/active`)
        const data = await response.json()
        if (data.success) {
          setActiveCoupons(data.coupons || [])
        }
      } catch (err) {
        console.error('Failed to load active coupons', err)
      }
    }
    loadCoupons()
    const interval = setInterval(loadCoupons, 30000)
    return () => clearInterval(interval)
  }, [])

  // Auto re-validate coupon on cart total change
  // Guard: skip during SSR/hydration when subtotal is 0
  useEffect(() => {
    if (!appliedCoupon || subtotal <= 0 || items.length === 0) {
      return
    }

    const revalidate = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/coupons/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: appliedCoupon.code,
            subtotal,
            deliveryFee
          })
        })
        const data = await response.json()
        if (response.ok && data.success && data.valid) {
          setDiscountAmount(Number(data.discountAmount || 0))
        } else {
          setAppliedCoupon(null)
          setAppliedCouponCode(null)
          setDiscountAmount(0)
          setCouponCode('')
          toast.error(data?.error || 'Coupon is no longer valid')
        }
      } catch {
        setAppliedCoupon(null)
        setAppliedCouponCode(null)
        setDiscountAmount(0)
        setCouponCode('')
      }
    }

    revalidate()
  }, [subtotal, deliveryFee, appliedCoupon?.code, items.length])

  useEffect(() => {
    if (!selectedAddress && addresses.length > 0) {
      setSelectedAddress(addresses.find((address) => address.isDefault)?.id || addresses[0].id)
    }
  }, [addresses, selectedAddress])

  useEffect(() => {
    if (user) {
      setContactName(user.fullName || user.name || '')
      setPhoneNumber(user.phone || '')
      setEmail(user.email || '')
    }
  }, [user])

  useEffect(() => {
    const activeAddress = addresses.find((address) => address.id === selectedAddress)
    if (!activeAddress) {
      return
    }

    if (activeAddress.useAccountDetails === false) {
      setContactName(activeAddress.receiverName || '')
      setPhoneNumber(activeAddress.receiverPhone || '')
      return
    }

    if (user) {
      setContactName(user.fullName || user.name || '')
      setPhoneNumber(user.phone || '')
    }
  }, [addresses, selectedAddress, user])

  const handleApplyCoupon = async () => {
    const normalizedCode = couponCode.trim().toUpperCase()

    if (!normalizedCode) {
      toast.error('Enter a coupon code first')
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: normalizedCode,
          subtotal,
          deliveryFee
        })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Validation failed')
      }

      if (data.success && data.valid) {
        setAppliedCoupon(data.coupon)
        setDiscountAmount(Number(data.discountAmount || 0))
        setAppliedCouponCode(data.coupon.code)
        setCouponCode(data.coupon.code)
        toast.success('Promo code applied successfully!')
      }
    } catch (error: any) {
      toast.error(error.message || 'Invalid coupon code')
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setAppliedCouponCode(null)
    setDiscountAmount(0)
    setCouponCode('')
    toast.success('Coupon removed')
  }

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address')
      return
    }

    if (!contactName.trim()) {
      toast.error('Please enter your name')
      return
    }

    if (!phoneNumber.trim()) {
      toast.error('Please enter your phone number')
      return
    }

    if (!restaurantId) {
      toast.error('Your cart is missing restaurant information. Please add the item again.')
      return
    }

    if (restaurantUnavailable) {
      toast.error(`This restaurant is currently closed. ${getRestaurantReopenText(restaurant)}.`)
      return
    }

    const selectedAddressDetails = addresses.find((address) => address.id === selectedAddress)

    if (!selectedAddressDetails) {
      toast.error('Selected address is invalid')
      return
    }

    setLoading(true)

    try {
      const orderData = {
        // SECURITY: Do NOT send user_id - it's determined by JWT authentication
        // Frontend should never send user_id; let backend use req.customer.id from verified JWT
        address_id: selectedAddressDetails.legacyAddressId || undefined,
        restaurant_id: restaurantId,
        items: items.map((item) => ({
          menu_item_id: item.menuItem.id,
          quantity: item.quantity,
          price: item.menuItem.price,
        })),
        subtotal,
        delivery_fee: deliveryFee,
        tax,
        total,
        total_amount: total,
        discount: discountAmount,
        coupon_code: appliedCoupon?.code,
        status: 'PLACED',
        delivery_address: {
          label: selectedAddressDetails.label,
          full_address: selectedAddressDetails.fullAddress,
          landmark: selectedAddressDetails.landmark,
          contact_name: contactName.trim(),
          phone: phoneNumber.trim(),
          email: email.trim() || undefined,
        },
        payment_method: paymentMethod,
      }

      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(orderData),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        // Handle specific auth errors
        if (response.status === 401) {
          throw new Error('Your session has expired. Please log in again and try placing the order.')
        }
        if (response.status === 403) {
          throw new Error('You do not have permission to place this order. Please make sure you are logged in correctly.')
        }
        throw new Error(data?.error || 'Failed to place order')
      }

      if (typeof window !== 'undefined' && data?.order?.id) {
        window.sessionStorage.setItem('thinava_last_order_id', data.order.id)
        window.sessionStorage.setItem('thinava_last_order_phone', phoneNumber.trim())
      }

      clearCart()
      toast.success('Order placed successfully!')
      router.push('/orders')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to place order'
      console.error('[CHECKOUT_ERROR]', errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <CustomerRouteGuard>
        <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
          </div>
        </div>
        <Footer />
        <MobileNav />
        </div>
      </CustomerRouteGuard>
    )
  }

  return (
    <CustomerRouteGuard>
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <h1 className="mb-8 text-3xl font-bold text-gray-900">Checkout</h1>
        </motion.div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Delivery Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Delivery Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {addresses.map((address) => (
                  <div
                    key={address.id}
                    onClick={() => setSelectedAddress(address.id)}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      selectedAddress === address.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{address.label}</span>
                          {address.isDefault && (
                            <Badge variant="secondary" className="text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{address.fullAddress}</p>
                        {address.landmark && (
                          <p className="text-sm text-gray-500 mt-1">
                            Landmark: {address.landmark}
                          </p>
                        )}
                        {(address.receiverName || address.receiverPhone) && (
                          <p className="mt-1 text-xs font-semibold text-gray-700">
                            Receiver: {[address.receiverName, address.receiverPhone].filter(Boolean).join(' - ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full" onClick={() => router.push('/addresses')}>
                  + Add New Address
                </Button>
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  onClick={() => setPaymentMethod('cod')}
                  className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    paymentMethod === 'cod'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Cash on Delivery</h3>
                      <p className="text-sm text-gray-600">Pay when you receive your order</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 ${
                      paymentMethod === 'cod' ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                    }`}>
                      {paymentMethod === 'cod' && (
                        <div className="w-full h-full rounded-full bg-white scale-50" />
                      )}
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setPaymentMethod('upi')}
                  className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    paymentMethod === 'upi'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">UPI Payment</h3>
                      <p className="text-sm text-gray-600">Pay securely via UPI</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 ${
                      paymentMethod === 'upi' ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                    }`}>
                      {paymentMethod === 'upi' && (
                        <div className="w-full h-full rounded-full bg-white scale-50" />
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  Contact Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Name</label>
                  <Input
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Phone Number</label>
                  <Input
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email (Optional)</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="your@email.com"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.12 }}
            >
              <Card className="sticky top-24 overflow-hidden border-white/70 shadow-xl shadow-orange-100/50">
                <CardHeader className="border-b border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50">
                  <CardTitle className="flex items-center justify-between">
                    <span>Order Summary</span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-600 shadow-sm">
                      Secure checkout
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {restaurant && (
                    <div className="flex items-center gap-3 border-b pb-4">
                      <div className="w-12 h-12 rounded-lg overflow-hidden">
                        {getOptimizedCloudinaryImageUrl(restaurant.image, { width: 120, height: 120, crop: 'fill' }) ? (
                          <img
                            src={getOptimizedCloudinaryImageUrl(restaurant.image, { width: 120, height: 120, crop: 'fill' })}
                            alt={restaurant.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-orange-50 text-orange-500">
                            <ImageIcon className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold">{restaurant.name}</h3>
                        <p className="text-sm text-gray-600">
                          {restaurantUnavailable ? getRestaurantReopenText(restaurant) : restaurant.deliveryTime}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {items.map((item) => (
                      <div key={item.menuItem.id} className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {item.menuItem.name} x {item.quantity}
                        </span>
                        <span>{formatPrice(item.menuItem.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <TicketPercent className="h-4 w-4 text-orange-500" />
                      Apply Coupon
                    </div>

                    <div className="flex gap-2">
                      <Input
                        value={couponCode}
                        onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                        placeholder="Enter coupon code"
                        className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 font-medium"
                      />
                      {appliedCoupon ? (
                        <Button
                          type="button"
                          className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm min-w-[90px]"
                          onClick={handleRemoveCoupon}
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          className="bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-sm min-w-[90px]"
                          onClick={handleApplyCoupon}
                          disabled={!couponCode.trim()}
                        >
                          Apply
                        </Button>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {activeCoupons.map((coupon) => (
                        <button
                          key={coupon.code}
                          type="button"
                          onClick={() => setCouponCode(coupon.code)}
                          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm transition-all hover:border-orange-400 hover:bg-orange-50 hover:text-orange-700 active:scale-95"
                        >
                          {coupon.code}
                        </button>
                      ))}
                    </div>

                    <p className="mt-3 text-xs font-medium text-slate-600">
                      Select a promo code to save on your order!
                    </p>

                    {appliedCoupon ? (
                      <motion.div
                        key={appliedCoupon.code}
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.25 }}
                        className="mt-3 rounded-2xl border border-emerald-300 bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-emerald-600" />
                          {appliedCoupon.code} applied
                        </div>
                        <p className="mt-1 font-medium text-emerald-800">{appliedCoupon.description}</p>
                      </motion.div>
                    ) : null}
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Delivery Fee</span>
                      <span>{deliveryFee === 0 ? 'FREE' : formatPrice(deliveryFee)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Tax (5%)</span>
                      <span>{formatPrice(tax)}</span>
                    </div>
                    {discountAmount > 0 ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22 }}
                        className="flex justify-between font-medium text-emerald-700"
                      >
                        <span>Coupon Discount</span>
                        <span>-{formatPrice(discountAmount)}</span>
                      </motion.div>
                    ) : null}
                    <div className="border-t pt-2 flex justify-between font-bold text-lg text-gray-900">
                      <span>Total</span>
                      <span>{formatPrice(total)}</span>
                    </div>
                  </div>

                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                    <Button
                      className="w-full bg-slate-900 text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800"
                      size="lg"
                      onClick={handlePlaceOrder}
                      disabled={loading || restaurantUnavailable}
                    >
                      {loading ? 'Placing Order...' : restaurantUnavailable ? 'Restaurant Unavailable' : 'Place Order'}
                    </Button>
                  </motion.div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>Estimated delivery: 25-35 mins</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      <Footer />
      <MobileNav />
      </div>
    </CustomerRouteGuard>
  )
}
