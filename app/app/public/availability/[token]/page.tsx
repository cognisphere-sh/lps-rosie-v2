import type { Metadata, Viewport } from 'next'
import { PublicAvailability } from '@/components/workspace/public-availability'
import { publicAvailabilityRequest } from '@/lib/availability-queries'
import { redactPartnerRequestRefs } from '@/lib/partner-display'
import { partnerMetadata } from '@/lib/portal-pwa'
import { partnerPortalName } from '@/lib/portal-branding'

type Props = { params: Promise<{ token: string }> }

// Title and description are what a messaging app's link preview shows: the
// description is the job name the page's header shows, or the company when
// the link is dead or the request has no job name.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const request = await publicAvailabilityRequest((await params).token).catch(() => null)
  return {
    ...partnerMetadata(partnerPortalName(request?.supplierName), request?.supplierId),
    description: request?.jobName ? redactPartnerRequestRefs(request.jobName) : partnerPortalName(request?.supplierName),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  }
}
// The page is always dark (globals.css `:root:has(#public-availability)`), so the browser chrome is too.
export const viewport: Viewport = { themeColor: '#0A0A0A', colorScheme: 'dark' }
export default async function Page({ params }: Props) {
  return <PublicAvailability token={(await params).token} />
}
