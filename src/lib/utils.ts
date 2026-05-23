import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price)
}

export function calculateDeliveryFee(subtotal: number): number {
  return subtotal >= 300 ? 0 : 40
}

export function calculateTax(subtotal: number): number {
  return Math.round(subtotal * 0.05)
}
