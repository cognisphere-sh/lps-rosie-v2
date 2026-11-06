import type { Metadata } from 'next'
import { PublicOrder } from '@/components/workspace/public-order'
import { publicOrder } from '@/lib/order-queries'
import { partnerMetadata } from '@/lib/portal-pwa'
import { partnerPortalName } from '@/lib/portal-branding'

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const order = await publicOrder((await params).token).catch(() => null)
  return { ...partnerMetadata(partnerPortalName(order?.supplierName), order?.supplierId),
    robots: { index: false, follow: false }, referrer: 'no-referrer' }
}
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  return <PublicOrder token={(await params).token} />
}
