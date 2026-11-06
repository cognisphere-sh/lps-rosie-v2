import type { Metadata, MetadataRoute } from 'next'

import appManifest from '@/public/manifest.json'
import { partnerPortalName } from '@/lib/portal-branding'

export function partnerMetadata(name: string, supplierId?: number | null): Metadata {
  return {
    title: { absolute: name },
    applicationName: name,
    manifest: supplierId ? `/partner/${supplierId}/manifest.webmanifest` : '/partner/manifest.webmanifest',
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: name },
  }
}

export function partnerManifest(name: string, supplierId?: number): MetadataRoute.Manifest {
  return {
    ...appManifest,
    // Match the original implicit start_url identity so existing installations
    // can adopt the supplier manifest instead of becoming a second app.
    id: '/requests',
    name: partnerPortalName(name),
    short_name: partnerPortalName(name),
    description: 'Manage orders, answer availability requests and message Chris.',
    start_url: supplierId ? `/partner/${supplierId}` : '/partner',
    display: 'standalone',
    icons: appManifest.icons.map(icon => ({ ...icon, purpose: icon.purpose as 'any' | 'maskable' })),
  }
}
