'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Mail, Lock, Phone, Building2, MapPin, Users, FileText, Loader2, AlertTriangle, Clock, ChevronRight, TrendingUp, UtensilsCrossed } from 'lucide-react'
import Link from 'next/link'
import { restaurantPanelApi } from '@/lib/restaurant-panel-api'
import { API_BASE_URL } from '@/lib/api'
import { useRestaurantOwnerAuthStore } from '@/store/restaurantOwnerAuthStore'

// Animated tab switch component
const TabSwitch = ({ isLogin, setIsLogin, loading }: any) => {
  return (
    <div className="relative inline-flex w-full gap-1 rounded-2xl bg-gradient-to-r from-slate-700/30 to-slate-600/20 p-1.5 backdrop-blur-sm border border-slate-600/40">
      <button
        onClick={() => setIsLogin(true)}
        disabled={loading}
        className={`relative flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-300 ${
          isLogin
            ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30'
            : 'text-slate-300 hover:text-slate-200'
        }`}
      >
        <span className="relative z-10">Sign In</span>
      </button>
      <button
        onClick={() => setIsLogin(false)}
        disabled={loading}
        className={`relative flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-300 ${
          !isLogin
            ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30'
            : 'text-slate-300 hover:text-slate-200'
        }`}
      >
        <span className="relative z-10">Create Account</span>
      </button>
    </div>
  )
}

// Hero animation stats
const AnimatedStat = ({ number, label, icon: Icon }: any) => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const target = parseInt(number)
    const increment = target / 30
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, 30)
    return () => clearInterval(timer)
  }, [number])

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition">
      <Icon className="w-5 h-5 text-orange-400" />
      <div>
        <div className="text-2xl font-bold text-white">{count}+</div>
        <div className="text-xs text-slate-400">{label}</div>
      </div>
    </div>
  )
}

// Approval waiting screen
const ApprovalWaitingScreen = ({ status, message, email }: any) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full blur-xl opacity-30 animate-pulse" />
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-2 border-orange-500/40">
                {status === 'PENDING_APPROVAL' && (
                  <Clock className="w-14 h-14 text-orange-400 animate-spin" style={{ animationDuration: '3s' }} />
                )}
                {status === 'REJECTED' && (
                  <AlertTriangle className="w-14 h-14 text-rose-500" />
                )}
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-white text-center mb-3">
            {status === 'PENDING_APPROVAL' && 'Verification in Progress'}
            {status === 'REJECTED' && 'Verification Failed'}
            {status === 'SUSPENDED' && 'Account Suspended'}
          </h2>

          <p className="text-slate-300 text-center mb-8 leading-relaxed">
            {message}
          </p>

          <div className="bg-slate-700/50 rounded-xl p-4 mb-6 border border-slate-600/50">
            <p className="text-xs text-slate-400 mb-1">Email Submitted</p>
            <p className="text-white font-medium break-all">{email}</p>
          </div>

          {status === 'PENDING_APPROVAL' && (
            <div className="bg-orange-500/10 rounded-xl p-4 mb-6 border border-orange-500/20">
              <p className="text-sm text-orange-300">
                <span className="font-semibold">Expected Time:</span> 24-48 hours
              </p>
              <p className="text-xs text-orange-300/70 mt-1">
                We'll review your restaurant details and send updates via email
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => window.location.href = '/'}
              className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-xl transition"
            >
              Go Home
            </button>
            <a href="tel:9160776152">
              <button className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 rounded-xl transition">
                Support
              </button>
            </a>
          </div>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          © 2024 THINAVA. Professional Restaurant Management.
        </p>
      </div>
    </div>
  )
}

export default function RestaurantAuthPage() {
  const router = useRouter()
  const token = useRestaurantOwnerAuthStore((state) => state.token)
  const setSession = useRestaurantOwnerAuthStore((state) => state.setSession)
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [authStatus, setAuthStatus] = useState<'IDLE' | 'PENDING_APPROVAL' | 'REJECTED' | 'SUSPENDED'>('IDLE')
  const [authMessage, setAuthMessage] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [formStep, setFormStep] = useState(1) // For signup multi-step

  // Check if already logged in
  useEffect(() => {
    if (token) {
      router.replace('/restaurant/dashboard')
    }
  }, [router, token])

  // Login form
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: ''
  })

  // Signup form - Business Details
  const [signupForm, setSignupForm] = useState({
    restaurantName: '',
    ownerName: '',
    ownerPhone: '',
    ownerEmail: '',
    password: '',
    confirmPassword: '',
    address: '',
    latitude: '0',
    longitude: '0',
    city: '',
    state: '',
    pincode: '',
    category: 'multi-cuisine',
    vegNonVeg: 'both',
    openingTime: '10:00',
    closingTime: '22:00',
    deliveryRadius: '5',
    gstNumber: '',
    fssaiLicense: ''
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Use the working auth service instead of direct axios
      const response = await restaurantPanelApi.login({ 
        email: loginForm.email, 
        password: loginForm.password 
      })
      
      // Use the proper auth store
      setSession(response.owner, response.token)
      toast.success(`Welcome back, ${response.owner.full_name}`)
      router.replace('/restaurant/dashboard')
    } catch (error) {
      // Extract real error message instead of generic "Login failed"
      const message = error instanceof Error ? error.message : 'Unable to sign in'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/restaurant-auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupForm),
      })
      const data = await response.json()

      if (data.success) {
        toast.success('Registration submitted!')
        setAuthStatus('PENDING_APPROVAL')
        setAuthMessage('Our onboarding team is reviewing your restaurant details. You\'ll receive approval shortly.')
        setAuthEmail(signupForm.ownerEmail)
      }
    } catch (error: any) {
      console.error('Registration error:', error)
      console.error('Error response:', error.response?.data)
      const message = error.response?.data?.error || error.message || 'Registration failed'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  // Show approval waiting screen
  if (authStatus !== 'IDLE') {
    return <ApprovalWaitingScreen status={authStatus} message={authMessage} email={authEmail} />
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8 p-4 sm:p-6 lg:p-12 max-w-7xl mx-auto items-center">
          {/* LEFT SIDE - HERO */}
          <div className="space-y-8 py-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-2 mb-6 backdrop-blur-sm">
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                <span className="text-sm font-semibold text-orange-300">Restaurant Partner Platform</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4">
                Run your restaurant like a modern 
                <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent"> operations cockpit</span>
              </h1>

              <p className="text-lg text-slate-300 max-w-xl">
                Manage orders, menus, delivery flow, timings, payouts, and live operations from one powerful dashboard. Built for professional restaurant management.
              </p>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:border-orange-500/30 transition group">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-3 group-hover:shadow-lg group-hover:shadow-orange-500/20 transition">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-white mb-1">Real-time Analytics</h3>
                <p className="text-sm text-slate-400">Monitor orders, revenue, and performance metrics live</p>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:border-orange-500/30 transition group">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-3 group-hover:shadow-lg group-hover:shadow-orange-500/20 transition">
                  <UtensilsCrossed className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-white mb-1">Menu Management</h3>
                <p className="text-sm text-slate-400">Control inventory, pricing, and availability instantly</p>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:border-orange-500/30 transition group">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-3 group-hover:shadow-lg group-hover:shadow-orange-500/20 transition">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-white mb-1">Customer Support</h3>
                <p className="text-sm text-slate-400">Dedicated support team available 24/7</p>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:border-orange-500/30 transition group">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-3 group-hover:shadow-lg group-hover:shadow-orange-500/20 transition">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-white mb-1">Multi-location</h3>
                <p className="text-sm text-slate-400">Manage multiple restaurant locations with ease</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 pt-4">
              <AnimatedStat number="500" label="Restaurants" icon={Building2} />
              <AnimatedStat number="50000" label="Orders Daily" icon={TrendingUp} />
              <AnimatedStat number="98" label="% Uptime" icon={Clock} />
            </div>

            {/* CTA Button for Mobile */}
            <div className="lg:hidden">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-4 rounded-xl transition shadow-lg shadow-orange-500/20"
              >
                {isLogin ? 'Create Account' : 'Sign In'} <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* RIGHT SIDE - AUTH FORMS */}
          <div className="h-full flex items-center">
            <div className="w-full max-w-md space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-white mb-2">
                  {isLogin ? 'Welcome Back' : 'Get Started'}
                </h2>
                <p className="text-slate-400">
                  {isLogin ? 'Sign in to manage your restaurant' : 'Register your restaurant on THINAVA'}
                </p>
              </div>

              <TabSwitch isLogin={isLogin} setIsLogin={setIsLogin} loading={isLoading} />

              <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
                {isLogin ? (
                  /* LOGIN FORM */
                  <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                        <input
                          type="email"
                          value={loginForm.email}
                          onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/20 transition"
                          placeholder="your@restaurant.com"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                        <input
                          type="password"
                          value={loginForm.password}
                          onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/20 transition"
                          placeholder="••••••••"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                      {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>

                    <a href="tel:9160776152">
                      <button
                        type="button"
                        className="w-full border border-slate-600/50 hover:border-orange-500/30 bg-transparent hover:bg-orange-500/5 text-slate-300 hover:text-white font-semibold py-3 rounded-xl transition"
                      >
                        📞 Call Support: 9160776152
                      </button>
                    </a>
                  </form>
                ) : (
                  /* SIGNUP FORM */
                  <form onSubmit={handleSignup} className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {/* Business Details */}
                    <h3 className="text-sm font-semibold text-orange-400 pt-2">Business Details</h3>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Restaurant Name *</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          value={signupForm.restaurantName}
                          onChange={(e) => setSignupForm({ ...signupForm, restaurantName: e.target.value })}
                          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                          placeholder="Restaurant name"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">Owner Name *</label>
                        <div className="relative">
                          <Users className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                          <input
                            type="text"
                            value={signupForm.ownerName}
                            onChange={(e) => setSignupForm({ ...signupForm, ownerName: e.target.value })}
                            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                            placeholder="Your name"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">Phone *</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                          <input
                            type="tel"
                            value={signupForm.ownerPhone}
                            onChange={(e) => setSignupForm({ ...signupForm, ownerPhone: e.target.value })}
                            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                            placeholder="10-digit"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email *</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                          <input
                            type="email"
                            value={signupForm.ownerEmail}
                            onChange={(e) => setSignupForm({ ...signupForm, ownerEmail: e.target.value })}
                            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                            placeholder="Email"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">Category</label>
                        <select
                          value={signupForm.category}
                          onChange={(e) => setSignupForm({ ...signupForm, category: e.target.value })}
                          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none transition"
                        >
                          <option value="multi-cuisine">Multi-Cuisine</option>
                          <option value="north-indian">North Indian</option>
                          <option value="south-indian">South Indian</option>
                          <option value="chinese">Chinese</option>
                          <option value="fast-food">Fast Food</option>
                          <option value="cafe">Café</option>
                          <option value="bakery">Bakery</option>
                        </select>
                      </div>
                    </div>

                    {/* Location Details */}
                    <h3 className="text-sm font-semibold text-orange-400 pt-2">Location Details</h3>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Address *</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          value={signupForm.address}
                          onChange={(e) => setSignupForm({ ...signupForm, address: e.target.value })}
                          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                          placeholder="Full address"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="City"
                        value={signupForm.city}
                        onChange={(e) => setSignupForm({ ...signupForm, city: e.target.value })}
                        className="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                        required
                      />
                      <input
                        type="text"
                        placeholder="State"
                        value={signupForm.state}
                        onChange={(e) => setSignupForm({ ...signupForm, state: e.target.value })}
                        className="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Pincode"
                        value={signupForm.pincode}
                        onChange={(e) => setSignupForm({ ...signupForm, pincode: e.target.value })}
                        className="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                        required
                      />
                    </div>

                    {/* Business Hours & Type */}
                    <h3 className="text-sm font-semibold text-orange-400 pt-2">Operations</h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">Opening Time</label>
                        <input
                          type="time"
                          value={signupForm.openingTime}
                          onChange={(e) => setSignupForm({ ...signupForm, openingTime: e.target.value })}
                          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">Closing Time</label>
                        <input
                          type="time"
                          value={signupForm.closingTime}
                          onChange={(e) => setSignupForm({ ...signupForm, closingTime: e.target.value })}
                          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">Veg/Non-Veg</label>
                        <select
                          value={signupForm.vegNonVeg}
                          onChange={(e) => setSignupForm({ ...signupForm, vegNonVeg: e.target.value })}
                          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none transition"
                        >
                          <option value="veg">Vegetarian</option>
                          <option value="non-veg">Non-Vegetarian</option>
                          <option value="both">Both</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">Delivery Radius (km)</label>
                        <input
                          type="number"
                          value={signupForm.deliveryRadius}
                          onChange={(e) => setSignupForm({ ...signupForm, deliveryRadius: e.target.value })}
                          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none transition"
                          min="0.5"
                          max="30"
                          step="0.5"
                        />
                      </div>
                    </div>

                    {/* Documents */}
                    <h3 className="text-sm font-semibold text-orange-400 pt-2">Documents (Optional)</h3>

                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="GST Number"
                        value={signupForm.gstNumber}
                        onChange={(e) => setSignupForm({ ...signupForm, gstNumber: e.target.value })}
                        className="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                      />
                      <input
                        type="text"
                        placeholder="FSSAI License"
                        value={signupForm.fssaiLicense}
                        onChange={(e) => setSignupForm({ ...signupForm, fssaiLicense: e.target.value })}
                        className="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                      />
                    </div>

                    {/* Credentials */}
                    <h3 className="text-sm font-semibold text-orange-400 pt-2">Create Password</h3>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password *</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <input
                          type="password"
                          value={signupForm.password}
                          onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                          placeholder="••••••••"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Confirm Password *</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <input
                          type="password"
                          value={signupForm.confirmPassword}
                          onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                          placeholder="••••••••"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 mt-6"
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                      {isLoading ? 'Registering...' : 'Register Restaurant'}
                    </button>

                    <p className="text-xs text-slate-400 text-center mt-4">
                      Admin approval required before first login (24-48 hours)
                    </p>
                  </form>
                )}
              </div>

              <p className="text-center text-slate-500 text-xs">
                © 2024 THINAVA. Professional Restaurant Management.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
