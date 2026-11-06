import type { Metadata } from 'next'

import { partnerPortalName } from '@/lib/portal-branding'
import { partnerMetadata } from '@/lib/portal-pwa'

export const metadata: Metadata = partnerMetadata(partnerPortalName())

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return children
}
