'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Mail, X, Loader2, ArrowLeft } from 'lucide-react'
import { restaurantPanelApi } from '@/lib/restaurant-panel-api'

interface ForgotPasswordModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function ForgotPasswordModal({ isOpen, onClose, onSuccess }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'email' | 'sent'>('email')
  const [sentEmail, setSentEmail] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await restaurantPanelApi.requestPasswordReset(email)
      
      setSentEmail(email)
      setStep('sent')
      setEmail('')
      toast.success('Reset link sent to your email!')
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        if (onSuccess) onSuccess()
        handleClose()
      }, 3000)
    } catch (error: any) {
      const message = error?.message || 'Failed to send reset link. Please try again.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep('email')
    setEmail('')
    setSentEmail('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl animate-in fade-in-50 zoom-in-95">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>

          {step === 'email' ? (
            <>
              {/* Title */}
              <h2 className="text-2xl font-bold text-white mb-2">Reset Password</h2>
              <p className="text-slate-300 text-sm mb-6">
                Enter your registered email to receive a password reset link.
              </p>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/20 transition"
                      placeholder="your@restaurant.com"
                      required
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>

                {/* Cancel Button */}
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full border border-slate-600/50 hover:border-slate-500 text-slate-300 hover:text-white font-semibold py-3 rounded-xl transition"
                >
                  Cancel
                </button>
              </form>

              {/* Help text */}
              <p className="text-xs text-slate-500 mt-4 text-center">
                For testing, check the backend console for the reset link. The link expires in 15 minutes.
              </p>
            </>
          ) : (
            <>
              {/* Success State */}
              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white">Email Sent!</h3>
                  <p className="text-slate-300 text-sm mt-1">
                    We've sent a password reset link to:
                  </p>
                  <p className="text-orange-400 font-semibold mt-2 break-all">{sentEmail}</p>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-left">
                  <p className="text-sm text-blue-300">
                    <span className="font-semibold">💡 Tip:</span> During testing, use the reset link printed in the backend console. The link expires in 15 minutes.
                  </p>
                </div>

                <button
                  onClick={handleClose}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 rounded-xl transition"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
