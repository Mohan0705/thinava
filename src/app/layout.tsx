import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import { DevCacheReset } from '@/components/app/DevCacheReset'
import { AuthBootstrap } from '@/features/auth/AuthBootstrap'
import { AuthSessionEvents } from '@/features/auth/AuthSessionEvents'
import FloatingSupportButton from '@/components/support/FloatingSupportButton'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#FF6B35',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://thinava.vercel.app'),
  title: {
    default: 'Thinava - Food Delivery in Tadepalligudem',
    template: '%s | Thinava',
  },
  description: 'Order delicious food from the best restaurants in Tadepalligudem. Fast delivery, great taste!',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Thinava - Food Delivery in Tadepalligudem',
    description: 'Local-first food delivery from trusted restaurants in Tadepalligudem.',
    siteName: 'Thinava',
    type: 'website',
    url: '/',
  },
  twitter: {
    card: 'summary',
    title: 'Thinava - Food Delivery in Tadepalligudem',
    description: 'Local-first food delivery from trusted restaurants in Tadepalligudem.',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Thinava',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark')
              } else {
                document.documentElement.classList.remove('dark')
              }
            } catch (_) {}
          `
        }} />
      </head>
      <body className={`${plusJakarta.variable} font-sans`}>
        <DevCacheReset />
        <AuthBootstrap />
        <AuthSessionEvents />
        {children}
        <FloatingSupportButton />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
