import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display, Roboto } from 'next/font/google'

import { PWAInstallPopup } from '@/components/pwa/install-popup'
import { PWAProvider } from '@/components/pwa/pwa-provider'
import { RouteTransitions } from '@/components/workspace/route-transitions'

import './globals.css'
import './partner-chat.css'

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
  icons: {
    icon: '/lps-cactus-icon-192.png',
    apple: '/lps-cactus-apple-touch-icon.png',
  },
  // Let full-screen chat wallpaper continue behind the iOS status bar. The
  // workspace frame applies the safe-area inset to ordinary page chrome and
  // each mobile chat applies it to its own floating controls.
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Plant Supply' },
}

export const viewport: Viewport = {
  // Keep Android/browser chrome neutral, independent of the saved page accent.
  themeColor: '#1A1A1A',
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
          <RouteTransitions />
        </PWAProvider>
      </body>
    </html>
  )
}
