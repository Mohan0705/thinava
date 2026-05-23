'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { deliveryApi } from '@/lib/delivery-api'
import {
  User,
  Phone,
  Mail,
  Lock,
  Bike,
  FileText,
  ArrowRight,
  Loader,
  ChevronLeft,
} from 'lucide-react'
import { motion } from 'framer-motion'

export default function DeliveryRegisterPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'details' | 'vehicle' | 'confirm'>(
    'details'
  )
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    vehicleType: 'bike',
    vehicleNumber: '',
  })
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak')

  const validatePhone = (phone: string) => {
    return /^\d{10}$/.test(phone.replace(/\D/g, ''))
  }

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const validatePassword = (password: string) => {
    if (password.length < 6) return 'weak'
    if (password.length < 8) return 'medium'
    return 'strong'
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    if (name === 'password') {
      setPasswordStrength(validatePassword(value))
    }
  }

  const handleNextStep = () => {
    if (step === 'details') {
      if (!formData.fullName.trim()) {
        toast.error('Please enter your full name')
        return
      }
      if (!validatePhone(formData.phone)) {
        toast.error('Please enter a valid 10-digit phone number')
        return
      }
      if (!validateEmail(formData.email)) {
        toast.error('Please enter a valid email')
        return
      }
      if (formData.password.length < 6) {
        toast.error('Password must be at least 6 characters')
        return
      }
      setStep('vehicle')
    } else if (step === 'vehicle') {
      if (!formData.vehicleNumber.trim()) {
        toast.error('Please enter your vehicle number')
        return
      }
      setStep('confirm')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await deliveryApi.register({
        full_name: formData.fullName,
        phone: formData.phone,
        email: formData.email,
        password: formData.password,
        vehicle_type: formData.vehicleType,
        vehicle_number: formData.vehicleNumber,
      })

      toast.success('Registration submitted. Thinava admin approval is required before login.')
      setTimeout(() => {
        router.push('/delivery/login')
      }, 1000)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    if (step === 'details') {
      router.push('/delivery/login')
    } else if (step === 'vehicle') {
      setStep('details')
    } else {
      setStep('vehicle')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-orange-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="flex items-center justify-between px-4 py-4 md:px-8">
          <button onClick={handleBack} className="text-gray-600 hover:text-gray-900">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Join Thinava Delivery</h1>
          <div className="w-6" />
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-6 md:px-8 md:py-12">
        <div className="mx-auto max-w-md">
          {/* Step Indicator */}
          <div className="mb-8 flex items-center justify-between">
            {['Details', 'Vehicle', 'Confirm'].map((stepName, index) => {
              const stepMap = { Details: 'details', Vehicle: 'vehicle', Confirm: 'confirm' } as const
              const isActive = stepMap[stepName as keyof typeof stepMap] === step
              const isComplete = ['details', 'vehicle'].includes(step) && index < (step === 'details' ? 0 : step === 'vehicle' ? 1 : 2)

              return (
                <div key={stepName} className="flex flex-1 items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full font-medium transition-all ${
                      isActive || isComplete ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {isComplete ? '✓' : index + 1}
                  </div>
                  {index < 2 && (
                    <div
                      className={`mx-2 flex-1 h-1 rounded-full transition-all ${
                        isComplete ? 'bg-orange-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* Step 1: Personal Details */}
          {step === 'details' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <Card className="border-0 shadow-lg">
                <CardContent className="p-8">
                  <h2 className="mb-6 text-2xl font-bold text-gray-900">Your Details</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                        <Input
                          type="text"
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleInputChange}
                          placeholder="Your full name"
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                        <Input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="10-digit phone number"
                          className="pl-10"
                          maxLength={10}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                        <Input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="your.email@example.com"
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                        <Input
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          placeholder="At least 6 characters"
                          className="pl-10"
                        />
                      </div>
                      <div className="mt-2 flex gap-1">
                        {['weak', 'medium', 'strong'].map((strength) => (
                          <div
                            key={strength}
                            className={`h-1 flex-1 rounded-full ${
                              passwordStrength === 'weak' && strength === 'weak'
                                ? 'bg-red-500'
                                : passwordStrength === 'medium' &&
                                  ['weak', 'medium'].includes(strength)
                                ? 'bg-yellow-500'
                                : passwordStrength === 'strong'
                                ? 'bg-green-500'
                                : 'bg-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-gray-600">
                        Password strength: <span className="font-medium capitalize">{passwordStrength}</span>
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={handleNextStep}
                    className="mt-6 w-full gap-2 bg-orange-600 py-3 hover:bg-orange-700"
                  >
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>

              <p className="text-center text-sm text-gray-600">
                Already have an account?{' '}
                <Link href="/delivery/login" className="font-medium text-orange-600 hover:text-orange-700">
                  Login
                </Link>
              </p>
            </motion.div>
          )}

          {/* Step 2: Vehicle Details */}
          {step === 'vehicle' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <Card className="border-0 shadow-lg">
                <CardContent className="p-8">
                  <h2 className="mb-6 text-2xl font-bold text-gray-900">Vehicle Information</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Vehicle Type</label>
                      <div className="relative">
                        <Bike className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                        <select
                          name="vehicleType"
                          value={formData.vehicleType}
                          onChange={handleInputChange}
                          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                        >
                          <option value="bike">Bike</option>
                          <option value="scooter">Scooter</option>
                          <option value="bicycle">Bicycle</option>
                          <option value="auto">Auto</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Vehicle Number</label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                        <Input
                          type="text"
                          name="vehicleNumber"
                          value={formData.vehicleNumber}
                          onChange={handleInputChange}
                          placeholder="e.g., AP 1234 AB 1234"
                          className="pl-10 uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleNextStep}
                    className="mt-6 w-full gap-2 bg-orange-600 py-3 hover:bg-orange-700"
                  >
                    Review
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 3: Confirmation */}
          {step === 'confirm' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <Card className="border-0 shadow-lg">
                <CardContent className="p-8">
                  <h2 className="mb-6 text-2xl font-bold text-gray-900">Confirm Details</h2>

                  <div className="space-y-4">
                    <div className="rounded-lg bg-gray-50 p-4">
                      <p className="text-xs text-gray-600">Full Name</p>
                      <p className="mt-1 font-medium text-gray-900">{formData.fullName}</p>
                    </div>

                    <div className="rounded-lg bg-gray-50 p-4">
                      <p className="text-xs text-gray-600">Phone Number</p>
                      <p className="mt-1 font-medium text-gray-900">+91 {formData.phone}</p>
                    </div>

                    <div className="rounded-lg bg-gray-50 p-4">
                      <p className="text-xs text-gray-600">Email</p>
                      <p className="mt-1 font-medium text-gray-900">{formData.email}</p>
                    </div>

                    <div className="rounded-lg bg-gray-50 p-4">
                      <p className="text-xs text-gray-600">Vehicle</p>
                      <p className="mt-1 font-medium text-gray-900">
                        {formData.vehicleType} • {formData.vehicleNumber}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    <Button
                      onClick={handleSubmit}
                      disabled={loading}
                      className="w-full gap-2 bg-green-600 py-3 hover:bg-green-700"
                    >
                      {loading ? (
                        <>
                          <Loader className="h-4 w-4 animate-spin" />
                          Creating Account...
                        </>
                      ) : (
                        <>
                          Create Account
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => setStep('vehicle')}
                      variant="outline"
                      className="w-full"
                    >
                      Back
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
