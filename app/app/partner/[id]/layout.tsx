import type { Metadata } from 'next'

import { partnerPortalName } from '@/lib/portal-branding'
import { authenticatedPortalMetadata } from '@/lib/portal-branding-server'
import { partnerMetadata } from '@/lib/portal-pwa'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  return await authenticatedPortalMetadata(Number(id)) ?? partnerMetadata(partnerPortalName())
}

export default function SupplierPortalLayout({ children }: { children: React.ReactNode }) {
  return children
}
