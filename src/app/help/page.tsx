import Link from 'next/link'
import { MessageCircle, PhoneCall } from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import MobileNav from '@/components/layout/MobileNav'
import { SUPPORT_PHONE_DISPLAY, SUPPORT_TEL, SUPPORT_WHATSAPP_LINK } from '@/lib/support'

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[#fffaf5] pb-20 md:pb-0">
      <Header />
      <main className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-orange-100 bg-white p-8 shadow-[0_30px_80px_-40px_rgba(249,115,22,0.25)]">
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
            <PhoneCall className="h-4 w-4" />
            Thinava support
          </div>
          <h1 className="mt-5 text-4xl font-bold text-slate-950">Need help right now?</h1>
          <p className="mt-4 text-base text-slate-600">
            For order issues, rider support, restaurant questions, or account help, call the Thinava support line directly.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={SUPPORT_TEL}
              className="inline-flex items-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              <PhoneCall className="mr-2 h-4 w-4" />
              Call {SUPPORT_PHONE_DISPLAY}
            </a>
            <a
              href={SUPPORT_WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full bg-green-500 px-6 py-3 text-sm font-semibold text-white hover:bg-green-600 transition-colors"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp
            </a>
            <Link
              href="/profile/help"
              className="inline-flex items-center rounded-full border border-orange-200 px-6 py-3 text-sm font-semibold text-orange-700"
            >
              Open help topics
            </Link>
          </div>
        </div>
      </main>
      <Footer />
      <MobileNav />
    </div>
  )
}
