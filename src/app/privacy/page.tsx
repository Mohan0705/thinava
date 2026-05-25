import type { Metadata } from 'next'
import { StaticInfoPage } from '@/components/pages/StaticInfoPage'
import { SUPPORT_EMAIL } from '@/lib/support'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Thinava privacy policy covering collected information, location use, cookies, orders, payments, third-party tools, and account security.',
  openGraph: {
    title: 'Thinava Privacy Policy',
    description: 'Understand how Thinava handles account, location, order, payment, and support information.',
  },
}

export default function PrivacyPage() {
  return (
    <StaticInfoPage
      eyebrow="Privacy"
      title="Privacy Policy"
      description={`Thinava uses customer, restaurant, rider, and order information to operate food delivery, improve service quality, and provide support. For privacy questions, contact ${SUPPORT_EMAIL}.`}
      sections={[
        {
          title: 'Information We Collect',
          body: 'We may collect name, phone number, email, saved addresses, profile details, restaurant details, rider details, support messages, and account activity.',
        },
        {
          title: 'Location Usage',
          body: 'Location data helps show nearby service availability, save delivery addresses, coordinate rider pickup and delivery, and improve operational reliability.',
        },
        {
          title: 'Cookies and Local Storage',
          body: 'Thinava may use cookies, local storage, and similar browser storage for sessions, cart persistence, preferences, authentication, and app reliability.',
        },
        {
          title: 'Order and Payment Information',
          body: 'We process order items, totals, delivery details, payment method, coupon usage, order status, and refund-related information. Sensitive payment processing may be handled by third-party providers.',
        },
        {
          title: 'Third-Party Integrations',
          body: 'Thinava may use services for maps, authentication, image hosting, messaging, analytics, payment processing, and infrastructure. These services process data only as needed for platform operations.',
        },
        {
          title: 'Account Security',
          items: [
            'Keep your login credentials and OTPs private.',
            'Use accurate contact information so support can verify order issues.',
            `Report security or privacy questions at ${SUPPORT_EMAIL}.`,
          ],
        },
      ]}
    />
  )
}
