'use client'

/**
 * THINAVA Forgot Password System - Testing Guide
 * 
 * This guide helps you test the complete forgot password flow
 */

import { useState } from 'react'
import { toast } from 'sonner'

const testCases = [
  {
    id: 1,
    name: 'Request Password Reset',
    description: 'Send password reset email to a valid restaurant email',
    steps: [
      '1. Navigate to /restaurant-auth',
      '2. Click "Forgot Password?" link below password field',
      '3. Enter your restaurant email',
      '4. Click "Send Reset Link"',
      '5. Check for success message'
    ],
    expectedResult: 'Email sent confirmation shown, reset link in dev console'
  },
  {
    id: 2,
    name: 'Verify Reset Token',
    description: 'Verify that the reset token is valid and not expired',
    steps: [
      '1. Copy the reset token from modal (dev mode) or email',
      '2. Navigate to /reset-password?token=<TOKEN>',
      '3. Page should verify token and show password form',
      '4. Owner name and email should be displayed'
    ],
    expectedResult: 'Reset password form displays with owner details'
  },
  {
    id: 3,
    name: 'Reset Password',
    description: 'Create a new password using the reset token',
    steps: [
      '1. On reset password page, enter new password (min 8 chars)',
      '2. Confirm the password in second field',
      '3. Click "Reset Password"',
      '4. Wait for success message',
      '5. Redirect to login should occur'
    ],
    expectedResult: 'Password updated successfully, redirected to login'
  },
  {
    id: 4,
    name: 'Login with New Password',
    description: 'Verify that login works with the new password',
    steps: [
      '1. On login page, enter restaurant email',
      '2. Enter the NEW password you just created',
      '3. Click "Sign In"',
      '4. Should successfully login to dashboard'
    ],
    expectedResult: 'Successfully logged in to dashboard'
  },
  {
    id: 5,
    name: 'Invalid/Expired Token',
    description: 'Verify error handling for invalid or expired tokens',
    steps: [
      '1. Try accessing /reset-password?token=invalid_token',
      '2. Or wait for token to expire (1 hour) and try old token',
      '3. Should show error message',
      '4. Offer to request new reset link'
    ],
    expectedResult: 'Error page with option to request new link'
  },
  {
    id: 6,
    name: 'Password Mismatch',
    description: 'Verify validation when passwords don\'t match',
    steps: [
      '1. On reset page, enter password in first field',
      '2. Enter different password in confirm field',
      '3. Try to submit form',
      '4. Should show validation error'
    ],
    expectedResult: 'Error message: "Passwords do not match"'
  },
  {
    id: 7,
    name: 'Weak Password',
    description: 'Verify validation for passwords less than 8 chars',
    steps: [
      '1. On reset page, enter password with < 8 characters',
      '2. Try to submit form',
      '3. Should show validation error'
    ],
    expectedResult: 'Error message: "Password must be at least 8 characters"'
  },
  {
    id: 8,
    name: 'Modal Responsive',
    description: 'Verify modal works on mobile/tablet/desktop',
    steps: [
      '1. Test on mobile (375px width)',
      '2. Test on tablet (768px width)',
      '3. Test on desktop (1024px+ width)',
      '4. Verify inputs and buttons are accessible'
    ],
    expectedResult: 'Modal renders correctly on all screen sizes'
  }
]

export function ForgotPasswordTestGuide() {
  const [completed, setCompleted] = useState<number[]>([])

  const toggleCompleted = (id: number) => {
    setCompleted(prev => 
      prev.includes(id) 
        ? prev.filter(x => x !== id)
        : [...prev, id]
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="bg-slate-50 rounded-lg shadow-sm p-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Forgot Password System - Test Guide
        </h1>
        <p className="text-slate-600 mb-8">
          Complete these test cases to verify the forgot password functionality works correctly
        </p>

        <div className="space-y-4">
          {testCases.map((test) => (
            <div
              key={test.id}
              className={`p-6 rounded-lg border-2 transition ${
                completed.includes(test.id)
                  ? 'border-green-200 bg-green-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  checked={completed.includes(test.id)}
                  onChange={() => toggleCompleted(test.id)}
                  className="w-6 h-6 mt-1 cursor-pointer"
                />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 mb-1">
                    {test.name}
                  </h3>
                  <p className="text-sm text-slate-600 mb-3">{test.description}</p>

                  <div className="mb-3">
                    <h4 className="font-semibold text-slate-700 text-sm mb-2">Steps:</h4>
                    <ul className="text-sm text-slate-600 space-y-1 ml-4">
                      {test.steps.map((step, idx) => (
                        <li key={idx} className="list-disc">{step}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-sm text-blue-900">
                      <span className="font-semibold">Expected Result:</span> {test.expectedResult}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">Progress:</span> {completed.length} of {testCases.length} tests completed
          </p>
        </div>

        {/* API Endpoints */}
        <div className="mt-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">API Endpoints</h2>
          <div className="space-y-4">
            <div className="p-4 bg-slate-900 rounded text-slate-100 font-mono text-sm overflow-x-auto">
              <p><span className="text-green-400">POST</span> /api/restaurant-auth/password-reset/request</p>
              <p className="text-slate-400 mt-2">Request body: {`{ email: "owner@restaurant.com" }`}</p>
            </div>
            <div className="p-4 bg-slate-900 rounded text-slate-100 font-mono text-sm overflow-x-auto">
              <p><span className="text-blue-400">GET</span> /api/restaurant-auth/password-reset/verify/:token</p>
              <p className="text-slate-400 mt-2">Verifies reset token is valid</p>
            </div>
            <div className="p-4 bg-slate-900 rounded text-slate-100 font-mono text-sm overflow-x-auto">
              <p><span className="text-green-400">POST</span> /api/restaurant-auth/password-reset/confirm</p>
              <p className="text-slate-400 mt-2">Request body: {`{ token, newPassword, confirmPassword }`}</p>
            </div>
          </div>
        </div>

        {/* Security Notes */}
        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h3 className="font-semibold text-amber-900 mb-2">Security Features</h3>
          <ul className="text-sm text-amber-800 space-y-1 ml-4">
            <li>✅ Tokens are hashed before storage (SHA-256)</li>
            <li>✅ Tokens expire after 1 hour</li>
            <li>✅ Tokens are marked as used after password reset</li>
            <li>✅ Passwords are hashed with bcrypt (10 rounds)</li>
            <li>✅ Email validation before sending reset email</li>
            <li>✅ Generic response for security (don't reveal if email exists)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default ForgotPasswordTestGuide
