import type { Metadata } from 'next'
import { StaticInfoPage } from '@/components/pages/StaticInfoPage'

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn about Thinava, a local-first food delivery platform for trusted restaurants and fast local delivery in Tadepalligudem.',
  openGraph: {
    title: 'About Thinava',
    description: 'Thinava supports trusted restaurants, local businesses, and fast food delivery in Tadepalligudem.',
  },
}

export default function AboutPage() {
  return (
    <StaticInfoPage
      eyebrow="About Thinava"
      title="Local-first food delivery for Tadepalligudem."
      description="Thinava connects customers with trusted local restaurants through a delivery experience built for reliability, freshness, and community growth."
      sections={[
        {
          title: 'Our Mission',
          body: 'Make dependable food delivery accessible to every neighborhood in Tadepalligudem while helping local restaurants grow sustainably.',
        },
        {
          title: 'Our Vision',
          body: 'Build the most trusted local food network in Andhra Pradesh, where restaurants, riders, and customers all benefit from fair operations.',
        },
        {
          title: 'Why Thinava',
          items: [
            'Trusted restaurants with a focus on quality and consistency.',
            'Fast local delivery designed around Tadepalligudem routes.',
            'Customer-first support for order, delivery, and account questions.',
          ],
        },
        {
          title: 'Supporting Local Business',
          body: 'We prioritize local restaurant visibility, practical onboarding, and operational support so neighborhood kitchens can reach more customers without losing their identity.',
        },
      ]}
      cta={{
        title: 'Hungry now?',
        description: 'Browse restaurants serving around Tadepalligudem and find your next meal from trusted local kitchens.',
        primaryLabel: 'Explore Restaurants',
        primaryHref: '/restaurants',
        secondaryLabel: 'Partner With Us',
        secondaryHref: '/partner-with-us',
      }}
    />
  )
}
