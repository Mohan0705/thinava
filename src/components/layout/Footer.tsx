import Link from 'next/link'
import { Facebook, Twitter, Instagram, Mail, MessageCircle, Phone, MapPin } from 'lucide-react'
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY, SUPPORT_TEL, SUPPORT_WHATSAPP_LINK } from '@/lib/support'

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-thinava-border bg-thinava-text text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-thinava-primary">
                <span className="text-base font-bold text-white">T</span>
              </div>
              <span className="text-xl font-bold">Thinava</span>
            </div>
            <p className="text-sm leading-relaxed text-gray-400">
              Your local food delivery partner in Tadepalligudem. Fresh meals from trusted restaurants, delivered with care.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-300">Explore</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/restaurants" className="text-gray-400 transition-colors hover:text-white">
                  Restaurants
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-gray-400 transition-colors hover:text-white">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/careers" className="text-gray-400 transition-colors hover:text-white">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="/partner" className="text-gray-400 transition-colors hover:text-white">
                  Partner with us
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-300">Support</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/help" className="text-gray-400 transition-colors hover:text-white">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-gray-400 transition-colors hover:text-white">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-gray-400 transition-colors hover:text-white">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-gray-400 transition-colors hover:text-white">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-300">Contact</h3>
            <ul className="space-y-3 text-sm text-gray-400">
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-thinava-primary" />
                <a href={SUPPORT_TEL} className="hover:text-white transition-colors">
                  {SUPPORT_PHONE_DISPLAY}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <MessageCircle className="h-4 w-4 shrink-0 text-thinava-success" />
                <a href={SUPPORT_WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  WhatsApp
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-thinava-primary" />
                <span>{SUPPORT_EMAIL}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-thinava-primary" />
                <span>Tadepalligudem, Andhra Pradesh, India</span>
              </li>
            </ul>

            <div className="mt-6 flex gap-3">
              {[Facebook, Twitter, Instagram].map((Icon, i) => (
                <Link
                  key={i}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-gray-300 transition-colors hover:bg-white/20 hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-gray-500">
          <p>&copy; {new Date().getFullYear()} Thinava. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
