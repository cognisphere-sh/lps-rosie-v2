import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'

import { canAccessSupplier } from '@/lib/auth'
import { partnerSupplier } from '@/lib/availability-queries'
import { partnerLoginContext, partnerPortalName } from '@/lib/portal-branding'
import { resolveUser } from '@/lib/session'
import { partnerMetadata } from '@/lib/portal-pwa'

// Request-local memoization keeps metadata and the rendered heading in sync.
export const supplierPortalName = cache(async (supplierId: number) => {
  const supplier = await partnerSupplier(supplierId).catch(() => null)
  return partnerPortalName(supplier?.name)
})

// A supplier-specific sign-in link reveals only the portal's display name;
// all portal data stays behind the existing session and company access gates.
export async function loginPortalName(next: string | null): Promise<string | null> {
  const context = partnerLoginContext(next)
  if (!context) return null
  return context.supplierId === null ? partnerPortalName() : supplierPortalName(context.supplierId)
}

const authenticatedPortalIdentity = cache(async (supplierId?: number) => {
  const user = await resolveUser((await cookies()).toString())
  const id = supplierId ?? (user?.role === 'partner' ? user.supplierId : null)
  if (!user || id == null || !Number.isSafeInteger(id) || id <= 0 ||
      !(await canAccessSupplier(user, id))) return null
  return { name: await supplierPortalName(id), supplierId: id }
})

export async function authenticatedPortalName(supplierId?: number): Promise<string | null> {
  return (await authenticatedPortalIdentity(supplierId))?.name ?? null
}

export async function authenticatedPortalMetadata(supplierId?: number) {
  const identity = await authenticatedPortalIdentity(supplierId)
  return identity ? partnerMetadata(identity.name, identity.supplierId) : null
}

export async function loginPortalMetadata(next: string | null) {
  const name = await loginPortalName(next)
  return name ? partnerMetadata(name, partnerLoginContext(next)?.supplierId) : null
}
