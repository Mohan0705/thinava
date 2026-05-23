'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Minus, Trash2, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useCartStore } from '@/store/cartStore'
import { formatPrice, calculateDeliveryFee, calculateTax } from '@/lib/utils'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import MobileNav from '@/components/layout/MobileNav'

export default function CartPage() {
  const { items, updateQuantity, removeItem, getSubtotal } = useCartStore()
  
  const subtotal = getSubtotal()
  const deliveryFee = calculateDeliveryFee(subtotal)
  const tax = calculateTax(subtotal)
  const total = subtotal + deliveryFee + tax

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <div className="text-center">
            <div className="w-32 h-32 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <ShoppingBag className="w-16 h-16 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
            <p className="text-gray-600 mb-6">Add items to get started</p>
            <Link href="/">
              <Button>Browse Restaurants</Button>
            </Link>
          </div>
        </div>
        <Footer />
        <MobileNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">Your Cart</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item, index) => (
              <motion.div
                key={item.menuItem.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-24 h-24 relative flex-shrink-0">
                        <Image
                          src={item.menuItem.image}
                          alt={item.menuItem.name}
                          width={100}
                          height={100}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {item.menuItem.name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">
                          {formatPrice(item.menuItem.price)}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              className="h-10 w-10 rounded-full border border-orange-200 bg-white p-0 text-xl font-black leading-none text-orange-700 shadow-none hover:bg-orange-100 active:scale-90 transition-transform"
                              onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                            >
                              <span aria-hidden="true">-</span>
                              <span className="sr-only">Decrease quantity</span>
                            </Button>
                            <span className="min-w-[2.5rem] text-center text-lg font-black text-gray-900 dark:text-white bg-orange-50 dark:bg-slate-800 rounded-lg py-1 px-2">
                              {item.quantity}
                            </span>
                            <Button
                              size="sm"
                              className="h-10 w-10 rounded-full bg-gradient-to-r from-orange-500 to-red-500 p-0 text-xl font-black leading-none text-white shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-red-600 active:scale-90 transition-transform"
                              onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                            >
                              <span aria-hidden="true">+</span>
                              <span className="sr-only">Increase quantity</span>
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeItem(item.menuItem.id)}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-900">Order Summary</h2>
                
                <div className="space-y-3 mb-6">
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
                  <div className="border-t pt-3 flex justify-between font-bold text-lg text-gray-900">
                    <span>Total</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </div>

                <Link href="/checkout">
                  <Button
                    className="w-full bg-slate-900 text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800"
                    size="lg"
                  >
                    Proceed to Checkout
                  </Button>
                </Link>

                {subtotal < 300 && (
                  <p className="text-sm text-orange-600 mt-3 text-center">
                    Add {formatPrice(300 - subtotal)} more for free delivery
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
      <MobileNav />
    </div>
  )
}
