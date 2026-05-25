import type { Metadata } from 'next'
import { StaticInfoPage } from '@/components/pages/StaticInfoPage'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Thinava terms covering platform use, orders, cancellations, refunds, delivery limitations, and account responsibility.',
  openGraph: {
    title: 'Thinava Terms of Service',
    description: 'Review Thinava platform usage, ordering, cancellation, refund, and account responsibility terms.',
  },
}

export default function TermsPage() {
  return (
    <StaticInfoPage
      eyebrow="Legal"
      title="Terms of Service"
      description="These terms explain how customers, restaurant partners, and delivery partners should use Thinava. By using Thinava, you agree to follow these platform rules."
      sections={[
        {
          title: 'Platform Usage',
          body: 'Thinava provides technology for browsing restaurants, placing food orders, coordinating delivery, and receiving support. Users must provide accurate account, address, and contact information.',
        },
        {
          title: 'Ordering Policies',
          body: 'Orders are subject to restaurant availability, item stock, delivery reach, operating hours, and acceptance by the restaurant. Prices, taxes, delivery fees, and offers may change before checkout.',
        },
        {
          title: 'Cancellations and Refunds',
          body: 'Cancellation and refund eligibility depends on order status, restaurant preparation, rider assignment, payment method, and the nature of the issue. Approved refunds may take time to process.',
        },
        {
          title: 'Delivery Limitations',
          body: 'Delivery may be delayed or unavailable due to weather, traffic, incorrect addresses, restaurant delays, rider availability, or locations outside the service area.',
        },
        {
          title: 'Prohibited Activities',
          items: [
            'Misusing coupons, referrals, payments, accounts, or support channels.',
            'Providing false addresses, contact details, identity information, or restaurant details.',
            'Harassing riders, restaurant staff, support agents, or other platform users.',
          ],
        },
        {
          title: 'Account Responsibility',
          body: 'You are responsible for activity under your account and should keep your phone, email, and login credentials secure. Contact support if you suspect unauthorized use.',
        },
      ]}
    />
  )
}
