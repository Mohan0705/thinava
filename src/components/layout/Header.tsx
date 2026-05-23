'use client'

import Link from 'next/link'
import { ShoppingCart, User, Menu } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { motion } from 'framer-motion'
import ThemeToggle from '@/components/ui/ThemeToggle'
import LanguageSelector from '@/components/ui/LanguageSelector'
import LiveSearchBar from '@/components/customer/LiveSearchBar'

export default function Header() {
  const itemCount = useCartStore((state) => state.getItemCount())
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-100 dark:border-slate-800 transition-colors duration-200"
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-xl">T</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
              Thinava
            </span>
          </Link>

          {/* Live Search Bar - Desktop */}
          <div className="hidden md:flex flex-1 max-w-xl">
            <LiveSearchBar />
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <LanguageSelector />
              <ThemeToggle />
            </div>

            {!token ? (
              <div className="hidden items-center gap-2 md:flex">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="font-semibold text-slate-700 dark:text-slate-200">
                    Login
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="font-semibold">
                    Signup
                  </Button>
                </Link>
              </div>
            ) : null}

            <Link href="/cart">
              <Button variant="ghost" size="icon" className="relative text-slate-700 dark:text-slate-200">
                <ShoppingCart className="w-6 h-6" />
                {itemCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-bold"
                  >
                    {itemCount}
                  </motion.span>
                )}
              </Button>
            </Link>

            <Link href={token ? '/profile' : '/login'}>
              <Button variant="ghost" size="icon" className="text-slate-700 dark:text-slate-200">
                {token && user ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-sm font-bold text-white shadow-sm">
                    {(user.fullName || user.name || 'C').charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <User className="w-6 h-6" />
                )}
              </Button>
            </Link>

            <div className="sm:hidden flex items-center gap-2">
              <ThemeToggle />
            </div>

            <Button variant="ghost" size="icon" className="md:hidden text-slate-700 dark:text-slate-200">
              <Menu className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Live Search Bar - Mobile */}
        <div className="md:hidden mt-4">
          <LiveSearchBar />
        </div>
      </div>
    </motion.header>
  )
}
