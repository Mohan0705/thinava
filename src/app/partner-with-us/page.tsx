import type { Metadata } from 'next'
import { StaticInfoPage } from '@/components/pages/StaticInfoPage'
import { SUPPORT_WHATSAPP_LINK } from '@/lib/support'

export const metadata: Metadata = {
  title: 'Partner With Us',
  description: 'Become a Thinava restaurant partner and reach local customers in Tadepalligudem with fast onboarding and operational support.',
  openGraph: {
    title: 'Partner With Thinava',
    description: 'Thinava helps local restaurants grow with customer reach, fast onboarding, and practical support.',
  },
}

export default function PartnerWithUsPage() {
  return (
    <StaticInfoPage
      eyebrow="Restaurant Partners"
      title="Grow your restaurant with Thinava."
      description="Thinava is built for local restaurants that want dependable digital reach, simple onboarding, and delivery operations focused on Tadepalligudem."
      sections={[
        {
          title: 'Low or 0 Commission Model',
          body: 'We are designing restaurant-friendly commercial models that help local kitchens keep more value while growing online orders.',
        },
        {
          title: 'Local Customer Reach',
          body: 'Reach customers actively searching for biryani, tiffins, fast food, meals, snacks, and local favorites nearby.',
        },
        {
          title: 'Fast Onboarding',
          body: 'Get your restaurant profile, menu, timings, images, and availability controls set up with a practical launch process.',
        },
        {
          title: 'Operational Support',
          items: [
            'Restaurant dashboard for menu and order management.',
            'Manual pause and reopening controls for busy hours.',
            'Support for business growth, visibility, and customer trust.',
          ],
        },
      ]}
      cta={{
        title: 'Become a Restaurant Partner',
        description: 'Start a conversation with Thinava and bring your menu to local customers.',
        primaryLabel: 'Become a Restaurant Partner',
        primaryHref: '/restaurant-auth',
        secondaryLabel: 'WhatsApp Us',
        secondaryHref: SUPPORT_WHATSAPP_LINK,
      }}
    />
  )
}
