'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Mail, Lock, Phone, Truck, Loader2, AlertTriangle, Clock } from 'lucide-react'
import axios from 'axios'
import Link from 'next/link'

export default function RiderAuthPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [authStatus, setAuthStatus] = useState<'IDLE' | 'PENDING' | 'REJECTED' | 'SUSPENDED'>('IDLE')
  const [authMessage, setAuthMessage] = useState('')

  const [loginForm, setLoginForm] = useState({
    phone: '',
    password: ''
  })

  const [signupForm, setSignupForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    vehicleType: 'BIKE',
    vehicleNumber: '',
    aadharNumber: '',
    drivingLicenseNumber: '',
    zone: ''
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await axios.post('/api/rider-auth/login', loginForm)

      if (response.data.success) {
        localStorage.setItem('riderToken', response.data.token)
        localStorage.setItem('riderUser', JSON.stringify(response.data.rider))

        toast.success('Login successful!')
        router.push('/rider/dashboard')
      }
    } catch (error: any) {
      const data = error.response?.data
      if (data?.status && ['PENDING', 'REJECTED', 'SUSPENDED'].includes(data.status)) {
        setAuthStatus(data.status)
        setAuthMessage(data.error || 'Your account is under review.')
      } else {
        const message = data?.error || 'Login failed'
        toast.error(message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await axios.post('/api/rider-auth/register', signupForm)

      if (response.data.success) {
        toast.success('Registration successful! Awaiting admin approval.')
        setAuthStatus('PENDING')
        setAuthMessage('Your delivery partner application is under review. Please wait for admin approval.')
        
        setSignupForm({
          fullName: '',
          phone: '',
          email: '',
          password: '',
          confirmPassword: '',
          vehicleType: 'BIKE',
          vehicleNumber: '',
          aadharNumber: '',
          drivingLicenseNumber: '',
          zone: ''
        })
      }
    } catch (error) {
      const err = error as any
      const message = err.response?.data?.error || 'Registration failed'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block bg-orange-500 p-3 rounded-lg mb-4">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Thinava Rider</h1>
          <p className="text-slate-400">Join our delivery network and start earning</p>
        </div>

        {/* Status Lock Screen */}
        {authStatus !== 'IDLE' ? (
          <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl text-center">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-orange-500/10 border-2 border-orange-500/30">
              {authStatus === 'PENDING' ? (
                <Clock className="w-12 h-12 text-orange-400" />
              ) : (
                <AlertTriangle className="w-12 h-12 text-rose-500" />
              )}
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-3">
              {authStatus === 'PENDING' ? 'Verification in Progress' : 'Account Restricted'}
            </h2>
            
            <p className="text-slate-300 mb-8 leading-relaxed">
              {authMessage || 'Your delivery partner application is under review. Please wait for admin approval.'}
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setAuthStatus('IDLE')
                  setIsLogin(true)
                }}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-orange-500/20"
              >
                Back to Login
              </button>
              <Link href="/">
                <button className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition">
                  Go to Homepage
                </button>
              </Link>
            </div>
          </div>
        ) : (
          /* Card */
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl">
          <div className="flex gap-2 mb-8 bg-slate-700/30 p-1 rounded-lg">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 rounded-md transition ${
                isLogin
                  ? 'bg-orange-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-md transition ${
                !isLogin
                  ? 'bg-orange-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          {/* Login Form */}
          {isLogin ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <input
                    type="tel"
                    value={loginForm.phone}
                    onChange={(e) => setLoginForm({ ...loginForm, phone: e.target.value })}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                    placeholder="10-digit phone"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {isLoading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={signupForm.fullName}
                  onChange={(e) => setSignupForm({ ...signupForm, fullName: e.target.value })}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                  placeholder="Your name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <input
                    type="tel"
                    value={signupForm.phone}
                    onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                    placeholder="10-digit phone"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email (Optional)
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    value={signupForm.email}
                    onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Vehicle Type
                </label>
                <select
                  value={signupForm.vehicleType}
                  onChange={(e) => setSignupForm({ ...signupForm, vehicleType: e.target.value })}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-orange-500 focus:outline-none transition"
                  required
                >
                  <option value="BIKE">Bike</option>
                  <option value="SCOOTER">Scooter</option>
                  <option value="CYCLE">Cycle</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Vehicle Number
                </label>
                <input
                  type="text"
                  value={signupForm.vehicleNumber}
                  onChange={(e) => setSignupForm({ ...signupForm, vehicleNumber: e.target.value })}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                  placeholder="Vehicle registration number"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Zone
                </label>
                <input
                  type="text"
                  value={signupForm.zone}
                  onChange={(e) => setSignupForm({ ...signupForm, zone: e.target.value })}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                  placeholder="Your zone/area"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <input
                    type="password"
                    value={signupForm.password}
                    onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <input
                    type="password"
                    value={signupForm.confirmPassword}
                    onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {isLoading ? 'Registering...' : 'Register as Rider'}
              </button>

              <p className="text-xs text-slate-400 text-center">
                You'll need admin approval before you can login
              </p>
            </form>
          )}
        </div>
        )}

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          © 2024 Thinava. All rights reserved.
        </p>
      </div>
    </div>
  )
}
