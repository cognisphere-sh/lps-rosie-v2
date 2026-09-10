import type { Metadata } from 'next'
import { PublicAvailability } from '@/components/workspace/public-availability'
export const metadata: Metadata = { title: 'Availability request · Local Plant Supply', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  return <PublicAvailability token={(await params).token} />
}
