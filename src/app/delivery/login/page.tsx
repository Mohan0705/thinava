'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { deliveryApi } from '@/lib/delivery-api'
import { useDeliveryAuthStore } from '@/store/deliveryAuthStore'
import Link from 'next/link'

export default function DeliveryLoginPage() {
	const router = useRouter()
	const token = useDeliveryAuthStore((s) => s.token)
	const setSession = useDeliveryAuthStore((s) => s.setSession)

	const [phone, setPhone] = useState('')
	const [password, setPassword] = useState('')
	const [submitting, setSubmitting] = useState(false)

	useEffect(() => {
		if (token) {
			router.replace('/delivery/dashboard')
		}
	}, [router, token])

	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		setSubmitting(true)

		try {
			const resp = await deliveryApi.login({ phone, password })
			setSession(resp)
			toast.success('Signed in')
			router.replace('/delivery/dashboard')
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Unable to sign in'
			toast.error(msg)
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-orange-50 pb-20">
			<div className="px-4 py-6 md:px-8 md:py-12">
				<div className="mx-auto max-w-md">
					{/* Tab Switcher */}
					<div className="mb-6 flex rounded-2xl bg-gray-100 p-1.5">
						<Link
							href="/delivery/login"
							className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-3 text-center text-sm font-semibold text-white shadow-md"
						>
							Sign In
						</Link>
						<Link
							href="/delivery/register"
							className="flex-1 rounded-xl py-3 text-center text-sm font-semibold text-gray-600 hover:text-gray-900"
						>
							Create Account
						</Link>
					</div>

					<Card className="border-0 shadow-lg">
						<CardContent className="p-8">
							<h2 className="mb-4 text-2xl font-bold text-gray-900">Delivery partner sign in</h2>
							<p className="mb-6 text-sm text-gray-600">Sign in to view your deliveries, earnings and shifts.</p>

							<form onSubmit={handleSubmit} className="space-y-4">
								<div>
									<label className="mb-2 block text-sm font-medium text-gray-700">Phone</label>
									<Input
										type="tel"
										value={phone}
										onChange={(e) => setPhone(e.target.value)}
										placeholder="10-digit phone number"
										required
									/>
								</div>

								<div>
									<label className="mb-2 block text-sm font-medium text-gray-700">Password</label>
									<Input
										type="password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										placeholder="Password"
										required
									/>
								</div>

								<Button type="submit" className="w-full" disabled={submitting}>
									{submitting ? 'Signing in...' : 'Sign in'}
								</Button>
							</form>

							<div className="mt-6 text-center">
								<p className="text-sm text-gray-500">
									New to THINAVA Delivery?{' '}
									<Link
										href="/delivery/register"
										className="font-semibold text-orange-600 hover:text-orange-700 hover:underline"
									>
										Create Account
									</Link>
								</p>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	)
}

