import type { Metadata } from 'next'

import { AuthFrame } from '@/components/auth-frame'
import { authenticatedPortalName, authenticatedPortalMetadata } from '@/lib/portal-branding-server'

export async function generateMetadata(): Promise<Metadata> {
  return await authenticatedPortalMetadata() ?? { title: 'Local Plant Supply' }
}

export default async function ChangePasswordLayout({ children }: { children: React.ReactNode }) {
  return <AuthFrame portalName={await authenticatedPortalName()}>{children}</AuthFrame>
}
