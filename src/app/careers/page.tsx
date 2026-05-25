import type { Metadata } from 'next'
import { StaticInfoPage } from '@/components/pages/StaticInfoPage'
import { SUPPORT_EMAIL_LINK } from '@/lib/support'

export const metadata: Metadata = {
  title: 'Careers',
  description: 'Explore future Thinava roles for delivery partners, operations, and support in Tadepalligudem.',
  openGraph: {
    title: 'Careers at Thinava',
    description: 'Thinava is preparing hiring opportunities in Tadepalligudem across delivery, operations, and support.',
  },
}

export default function CareersPage() {
  return (
    <StaticInfoPage
      eyebrow="Careers"
      title="Build the local food network with Thinava."
      description="Currently hiring soon in Tadepalligudem. We are building a team across delivery, operations, restaurant success, and customer support."
      sections={[
        {
          title: 'Delivery Partners',
          body: 'Future rider opportunities will focus on predictable dispatch, local route familiarity, and fair operating support.',
        },
        {
          title: 'Operations',
          body: 'Operations roles will help coordinate restaurant readiness, delivery quality, issue resolution, and city-level growth.',
        },
        {
          title: 'Support',
          body: 'Support roles will help customers, riders, and restaurants resolve order questions quickly and professionally.',
        },
        {
          title: 'Future Openings',
          items: [
            'Delivery partner onboarding',
            'Restaurant success associates',
            'Customer support associates',
            'Local operations coordinators',
          ],
        },
      ]}
      cta={{
        title: 'Interested in joining?',
        description: 'Share your interest with the Thinava team and we will get back when hiring opens.',
        primaryLabel: 'Email Support',
        primaryHref: SUPPORT_EMAIL_LINK,
        secondaryLabel: 'Delivery Signup',
        secondaryHref: '/delivery/signup',
      }}
    />
  )
}
