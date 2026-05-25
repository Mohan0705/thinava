import Link from 'next/link'
import { Instagram, Mail, MapPin, MessageCircle, Phone, Twitter } from 'lucide-react'
import {
  SUPPORT_EMAIL,
  SUPPORT_EMAIL_LINK,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_TEL,
  SUPPORT_WHATSAPP_LINK,
} from '@/lib/support'

const footerSections = [
  {
    title: 'Explore',
    links: [
      { label: 'Restaurants', href: '/restaurants' },
      { label: 'About Us', href: '/about' },
      { label: 'Careers', href: '/careers' },
      { label: 'Partner with us', href: '/partner-with-us' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help Center', href: '/help' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
    ],
  },
]

const socialLinks = [
  {
    label: 'Thinava on Instagram',
    href: 'https://www.instagram.com/thinava.app?igsh=NzFqNmNiMnprN3pt',
    Icon: Instagram,
  },
  {
    label: 'Thinava on X',
    href: 'https://x.com/thinavaapp',
    Icon: Twitter,
  },
]

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-800 bg-slate-950 text-white">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-9 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1.15fr]">
          <div className="max-w-sm">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-thinava-primary">
                <span className="text-base font-bold text-white">T</span>
              </div>
              <span className="text-xl font-bold">Thinava</span>
            </div>
            <p className="text-sm leading-relaxed text-gray-400">
              Your local food delivery partner in Tadepalligudem. Fresh meals from trusted restaurants, delivered with care.
            </p>
          </div>

          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-300">{section.title}</h3>
              <ul className="space-y-2.5 text-sm">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-gray-400 transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

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
                <a href={SUPPORT_EMAIL_LINK} className="break-all hover:text-white transition-colors">
                  {SUPPORT_EMAIL}
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-thinava-primary" />
                <span>Tadepalligudem, Andhra Pradesh, India</span>
              </li>
            </ul>

            <div className="mt-6 flex flex-wrap gap-3">
              {socialLinks.map(({ href, label, Icon }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-gray-300 transition-colors hover:bg-thinava-primary hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
              <a
                href={SUPPORT_EMAIL_LINK}
                aria-label="Email Thinava support"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-gray-300 transition-colors hover:bg-thinava-primary hover:text-white"
              >
                <Mail className="h-4 w-4" />
              </a>
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
