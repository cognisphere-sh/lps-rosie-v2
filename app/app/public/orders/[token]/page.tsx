import type { Metadata } from 'next'
import { PublicOrder } from '@/components/workspace/public-order'

export const metadata: Metadata = { title: 'Order · Local Plant Supply', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  return <PublicOrder token={(await params).token} />
}
