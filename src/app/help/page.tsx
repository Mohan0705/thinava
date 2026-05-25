import type { Metadata } from 'next'
import { StaticInfoPage } from '@/components/pages/StaticInfoPage'
import { SUPPORT_EMAIL_LINK, SUPPORT_TEL, SUPPORT_WHATSAPP_LINK } from '@/lib/support'

export const metadata: Metadata = {
  title: 'Help Center',
  description: 'Get help with Thinava delivery timing, cancellations, refunds, restaurant support, customer support, and order tracking.',
  openGraph: {
    title: 'Thinava Help Center',
    description: 'Support topics for Thinava customers, restaurants, and delivery partners.',
  },
}

export default function HelpPage() {
  return (
    <StaticInfoPage
      eyebrow="Help Center"
      title="How can we help?"
      description="Find answers for delivery timing, cancellations, refunds, restaurant support, customer support, and order tracking."
      sections={[
        {
          title: 'Customer Support',
          items: [
            'Use the floating WhatsApp button for urgent order help.',
            'Call support when an active delivery needs immediate attention.',
            'Email support for account, refund, or partner questions.',
          ],
        },
        {
          title: 'Restaurant Support',
          items: [
            'Use restaurant dashboard controls to pause or reopen ordering.',
            'Keep menu availability, images, prices, and operating hours updated.',
            'Contact support for onboarding or operational issues.',
          ],
        },
      ]}
      faqItems={[
        {
          question: 'How long does delivery usually take?',
          answer: 'Delivery time depends on restaurant preparation, rider availability, distance, traffic, and weather. Most local orders show an estimated time before checkout.',
        },
        {
          question: 'Can I cancel an order?',
          answer: 'Cancellation depends on whether the restaurant has accepted or started preparing the order. Contact support quickly if you need help.',
        },
        {
          question: 'How do refunds work?',
          answer: 'Refund eligibility depends on order status, payment method, and the verified issue. Approved refunds may take time to reach your original payment method.',
        },
        {
          question: 'How do I track my order?',
          answer: 'Open the Orders page after placing an order. Active orders show the latest restaurant and delivery status when available.',
        },
      ]}
      cta={{
        title: 'Still need help?',
        description: 'Reach Thinava support by phone, WhatsApp, or email.',
        primaryLabel: 'WhatsApp Support',
        primaryHref: SUPPORT_WHATSAPP_LINK,
        secondaryLabel: 'Email Support',
        secondaryHref: SUPPORT_EMAIL_LINK || SUPPORT_TEL,
      }}
    />
  )
}
