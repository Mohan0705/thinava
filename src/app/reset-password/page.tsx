'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Lock, Eye, EyeOff, Loader2, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { restaurantPanelApi } from '@/lib/restaurant-panel-api'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams?.get('token')

  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [verified, setVerified] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [tokenError, setTokenError] = useState('')
  
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [form, setForm] = useState({
    newPassword: '',
    confirmPassword: ''
  })

  const [errors, setErrors] = useState({
    newPassword: '',
    confirmPassword: ''
  })

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setTokenError('No reset token provided. Please click the link from your email.')
        setVerifying(false)
        return
      }

      try {
        const result = await restaurantPanelApi.verifyResetToken(token)
        setUserEmail(result.email)
        setUserName(result.fullName)
        setVerified(true)
      } catch (error: any) {
        const message = error?.message || 'Invalid or expired reset token. Please request a new one.'
        setTokenError(message)
      } finally {
        setVerifying(false)
      }
    }

    verifyToken()
  }, [token])

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters'
    }
    return ''
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateForm = () => {
    const newErrors: typeof errors = {
      newPassword: '',
      confirmPassword: ''
    }

    newErrors.newPassword = validatePassword(form.newPassword)
    
    if (form.newPassword !== form.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.values(newErrors).every(err => !err)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    if (!token) {
      toast.error('Reset token not found')
      return
    }

    setLoading(true)

    try {
      await restaurantPanelApi.confirmPasswordReset(
        token,
        form.newPassword,
        form.confirmPassword
      )

      toast.success('Password reset successfully!')
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/restaurant-auth')
      }, 2000)
    } catch (error: any) {
      const message = error?.message || 'Failed to reset password. Please try again.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Verifying reset link...</p>
        </div>
      </div>
    )
  }

  // Error state - invalid or expired token
  if (tokenError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-rose-400" />
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">Reset Link Invalid</h1>
            <p className="text-slate-300 mb-6">{tokenError}</p>

            <div className="space-y-3">
              <Link href="/restaurant-auth">
                <button className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 rounded-xl transition">
                  Back to Login
                </button>
              </Link>

              <Link href="/restaurant-auth?showForgot=true">
                <button className="w-full border border-slate-600/50 hover:border-orange-500/30 text-slate-300 hover:text-white font-semibold py-3 rounded-xl transition">
                  Request New Link
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Success state - token verified
  if (!verified) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-2 mb-6 backdrop-blur-sm">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-sm font-semibold text-orange-300">Password Reset</span>
            </div>

            <h1 className="text-3xl font-bold text-white mb-2">Create New Password</h1>
            <p className="text-slate-400 text-sm">
              Set a new password for <span className="text-orange-400 font-semibold">{userEmail}</span>
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* New Password */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="newPassword"
                    value={form.newPassword}
                    onChange={handleInputChange}
                    className={`w-full bg-slate-700/50 border ${errors.newPassword ? 'border-rose-500/50' : 'border-slate-600/50'} rounded-xl pl-11 pr-12 py-3 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/20 transition`}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.newPassword && (
                  <p className="text-rose-400 text-xs mt-1.5">{errors.newPassword}</p>
                )}
                <p className="text-xs text-slate-500 mt-2">Minimum 8 characters</p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleInputChange}
                    className={`w-full bg-slate-700/50 border ${errors.confirmPassword ? 'border-rose-500/50' : 'border-slate-600/50'} rounded-xl pl-11 pr-12 py-3 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/20 transition`}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition"
                  >
                    {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-rose-400 text-xs mt-1.5">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Password Requirements */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                <p className="text-xs text-blue-300">
                  <span className="font-semibold">Password must:</span>
                  <br />• Be at least 8 characters long
                  <br />• Match in both fields
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 mt-6"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                {loading ? 'Updating Password...' : 'Reset Password'}
              </button>

              {/* Back to Login */}
              <Link href="/restaurant-auth">
                <button type="button" className="w-full border border-slate-600/50 hover:border-slate-500 text-slate-300 hover:text-white font-semibold py-3 rounded-xl transition">
                  Back to Login
                </button>
              </Link>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-slate-500 text-xs">
            © 2024 THINAVA. Professional Restaurant Management.
          </p>
        </div>
      </div>
    </div>
  )
}
