import type { Metadata } from 'next'
import { StaticInfoPage } from '@/components/pages/StaticInfoPage'
import { SUPPORT_EMAIL_LINK } from '@/lib/support'

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about Thinava orders, delivery timing, cancellations, refunds, restaurant support, and tracking.',
  openGraph: {
    title: 'Thinava FAQ',
    description: 'Answers to common Thinava customer, delivery, and restaurant partner questions.',
  },
}

export default function FaqPage() {
  return (
    <StaticInfoPage
      eyebrow="FAQ"
      title="Frequently asked questions"
      description="Quick answers for common Thinava customer and restaurant partner questions."
      faqItems={[
        {
          question: 'Why is a restaurant shown as closed?',
          answer: 'Restaurants can be closed because they are outside operating hours or because the owner manually paused ordering. You can still browse the restaurant and menu.',
        },
        {
          question: 'Can I add items from a closed restaurant?',
          answer: 'Closed restaurants remain visible for browsing, but checkout and order placement are blocked until the restaurant is open again.',
        },
        {
          question: 'Where does Thinava currently operate?',
          answer: 'Thinava is focused on local food delivery in Tadepalligudem, Andhra Pradesh, India.',
        },
        {
          question: 'How do restaurants join Thinava?',
          answer: 'Restaurants can start from the Partner With Us page or contact support for onboarding help.',
        },
        {
          question: 'Who do I contact for refund or order issues?',
          answer: 'Use the Help Center, WhatsApp support, or email Thinava with your order details so the team can review the issue.',
        },
        {
          question: 'How do I track an active order?',
          answer: 'Open your Orders page to see restaurant confirmation, preparation, rider assignment, and delivery updates when available.',
        },
      ]}
      cta={{
        title: 'Could not find an answer?',
        description: 'Send your question to Thinava support and include any order details if relevant.',
        primaryLabel: 'Contact Support',
        primaryHref: SUPPORT_EMAIL_LINK,
        secondaryLabel: 'Help Center',
        secondaryHref: '/help',
      }}
    />
  )
}
