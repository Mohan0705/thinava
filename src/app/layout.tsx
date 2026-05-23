import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import { DevCacheReset } from '@/components/app/DevCacheReset'
import { AuthBootstrap } from '@/features/auth/AuthBootstrap'
import { AuthSessionEvents } from '@/features/auth/AuthSessionEvents'
import FloatingSupportButton from '@/components/support/FloatingSupportButton'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#f97316',
}

export const metadata: Metadata = {
  title: 'Thinava - Food Delivery in Tadepalligudem',
  description: 'Order delicious food from the best restaurants in Tadepalligudem. Fast delivery, great taste!',
  manifest: '/manifest.json',
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
      <body className={inter.className}>
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
