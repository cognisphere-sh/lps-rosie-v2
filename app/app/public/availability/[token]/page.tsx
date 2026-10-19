import type { Metadata, Viewport } from 'next'
import { PublicAvailability } from '@/components/workspace/public-availability'
export const metadata: Metadata = { title: 'Availability request · Local Plant Supply', robots: { index: false, follow: false }, referrer: 'no-referrer' }
// The page is always dark (globals.css `:root:has(#public-availability)`), so the browser chrome is too.
export const viewport: Viewport = { themeColor: '#0A0A0A', colorScheme: 'dark' }
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  return <PublicAvailability token={(await params).token} />
}
