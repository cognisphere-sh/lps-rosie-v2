import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display, Roboto } from 'next/font/google'

import { PWAInstallPopup } from '@/components/pwa/install-popup'
import { PWAProvider } from '@/components/pwa/pwa-provider'

import './globals.css'

// The design system's two typefaces: Inter for everything, Playfair Display for
// display headings (`font-serif`). Wired to the --font-* vars globals.css maps.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const roboto = Roboto({ subsets: ['latin'], variable: '--font-roboto', display: 'swap' })
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Local Plant Supply',
  description: 'Suppliers and plant availability for Local Plant Supply.',
  // Linking the manifest is what makes Chrome run its installability check.
  manifest: '/manifest.json',
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Plant Supply' },
}

export const viewport: Viewport = {
  themeColor: '#2F7A44',
  // `viewport-fit=cover` is what gives the mobile tab bar's
  // `env(safe-area-inset-bottom)` a value once the app runs full screen.
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${roboto.variable} ${playfair.variable}`}>
      <body className="min-h-dvh bg-background text-foreground font-sans antialiased">
        <PWAProvider>
          {children}
          <PWAInstallPopup />
        </PWAProvider>
      </body>
    </html>
  )
}
