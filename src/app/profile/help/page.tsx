import { Headphones, MessageCircle, MessageSquareText, PhoneCall } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { supportOptions } from '@/lib/profile-data'
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY, SUPPORT_TEL, SUPPORT_WHATSAPP_LINK } from '@/lib/support'

const supportChannels = [
  { icon: PhoneCall, title: 'Call support', detail: SUPPORT_PHONE_DISPLAY, href: SUPPORT_TEL },
  { icon: MessageCircle, title: 'WhatsApp support', detail: 'Chat on WhatsApp', href: SUPPORT_WHATSAPP_LINK },
  { icon: MessageSquareText, title: 'Email support', detail: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}` },
  { icon: Headphones, title: 'Live order help', detail: 'Available during active deliveries' },
]

export default function ProfileHelpPage() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Help & Support</CardTitle>
          <p className="text-sm text-gray-600">
            Reach the right support path faster for orders, account questions, and delivery issues.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {supportChannels.map((channel) => {
            const Icon = channel.icon
            return (
              <div key={channel.title} className="rounded-2xl border bg-gray-50 p-4">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                  <Icon className="h-5 w-5 text-orange-600" />
                </div>
                <p className="font-semibold text-gray-900">{channel.title}</p>
                {channel.href ? (
                  <a href={channel.href} className="mt-1 block text-sm text-orange-600 hover:text-orange-700">
                    {channel.detail}
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-gray-600">{channel.detail}</p>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Support Topics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {supportOptions.map((option) => (
            <div key={option.title} className="rounded-2xl border p-4">
              <p className="font-semibold text-gray-900">{option.title}</p>
              <p className="mt-1 text-sm text-gray-600">{option.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
