'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Minus, Trash2, ShoppingBag, ArrowRight, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useCartStore } from '@/store/cartStore'
import { formatPrice, calculateDeliveryFee, calculateTax } from '@/lib/utils'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import MobileNav from '@/components/layout/MobileNav'
import { cn } from '@/lib/utils'
import { getOptimizedCloudinaryImageUrl } from '@/lib/cloudinary-image'

function QuantityControl({
  quantity,
  onDecrease,
  onIncrease,
}: {
  quantity: number
  onDecrease: () => void
  onIncrease: () => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-thinava-border bg-thinava-bg p-0.5">
      <button
        type="button"
        onClick={onDecrease}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-thinava-primary transition hover:bg-orange-50 thinava-touch"
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-[2rem] text-center text-sm font-bold text-thinava-text">{quantity}</span>
      <button
        type="button"
        onClick={onIncrease}
        className="flex h-9 w-9 items-center justify-center rounded-full thinava-gradient-bg text-white thinava-touch"
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function CartPage() {
  const { items, updateQuantity, removeItem, getSubtotal } = useCartStore()

  const subtotal = getSubtotal()
  const deliveryFee = calculateDeliveryFee(subtotal)
  const tax = calculateTax(subtotal)
  const total = subtotal + deliveryFee + tax

  if (items.length === 0) {
    return (
      <div className="thinava-page-mobile">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-sm text-center">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-orange-50">
              <ShoppingBag className="h-12 w-12 text-thinava-primary/70" />
            </div>
            <h2 className="text-xl font-bold text-thinava-text">Your cart is empty</h2>
            <p className="mt-2 text-sm text-gray-500">Discover local favourites and add items to get started.</p>
            <Link href="/" className="mt-6 inline-flex">
              <Button className="gap-2">
                Browse restaurants
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
        <Footer />
        <MobileNav />
      </div>
    )
  }

  return (
    <div className="thinava-page-mobile">
      <Header />

      <div className="container mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-thinava-text md:text-2xl">Your cart</h1>
        <p className="mt-1 text-sm text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</p>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {items.map((item, index) => (
              (() => {
                const imageUrl = getOptimizedCloudinaryImageUrl(item.menuItem.image, {
                  width: 180,
                  height: 180,
                  crop: 'fill',
                })
                return (
              <motion.div
                key={item.menuItem.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Card>
                  <CardContent className="flex gap-4 p-4">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={item.menuItem.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-orange-50 text-orange-500">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-thinava-text line-clamp-1">{item.menuItem.name}</h3>
                      <p className="mt-0.5 text-sm font-semibold text-thinava-primary">
                        {formatPrice(item.menuItem.price * item.quantity)}
                      </p>
                      <p className="text-xs text-gray-500">{formatPrice(item.menuItem.price)} each</p>
                      <div className="mt-3 flex items-center justify-between">
                        <QuantityControl
                          quantity={item.quantity}
                          onDecrease={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                          onIncrease={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(item.menuItem.id)}
                          className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-thinava-error"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
                )
              })()
            ))}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardContent className="p-5">
                <h2 className="font-bold text-thinava-text">Order summary</h2>

                <div className="mt-4 space-y-2.5 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-medium text-thinava-text">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Delivery</span>
                    <span className={cn('font-medium', deliveryFee === 0 && 'text-thinava-success')}>
                      {deliveryFee === 0 ? 'FREE' : formatPrice(deliveryFee)}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Tax (5%)</span>
                    <span className="font-medium text-thinava-text">{formatPrice(tax)}</span>
                  </div>
                  <div className="flex justify-between border-t border-thinava-border pt-3 text-base font-bold text-thinava-text">
                    <span>Total</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </div>

                <Link href="/checkout" className="mt-5 block">
                  <Button className="w-full gap-2" size="lg">
                    Proceed to checkout
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>

                {subtotal < 300 && (
                  <p className="mt-3 text-center text-xs text-thinava-primary">
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
