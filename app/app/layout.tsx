import type { Metadata } from 'next'
import { Inter, Playfair_Display, Roboto } from 'next/font/google'

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
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${roboto.variable} ${playfair.variable}`}>
      <body className="min-h-dvh bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
