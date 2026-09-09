import type { JobRequestRow } from '@/lib/rows'

export const JOB_NAME_MAX_LENGTH = 160

export interface StructuredJobIdentity {
  name: string | null
  customer: { company: string | null; name: string | null } | null
}

export interface StoredJobIdentityComponents {
  company: string | null
  job: string | null
  contact: string | null
}

export const nonblankJobIdentity = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export interface BalancedHeaderGeometry {
  width: number
  edge: number
  flank: number
  identity: number
  identityCenter: number
}

/** Geometry mirrored by both balanced header grids; 44px controls never invade identity. */
export function balancedHeaderGeometry(width: number, edge = 0): BalancedHeaderGeometry | null {
  if (!Number.isFinite(width) || !Number.isFinite(edge) || width < 0 || edge < 0) return null
  const available = width - edge * 2
  if (available < 88) return null
  const flank = Math.max(44, available / 4)
  const identity = available - flank * 2
  if (identity < 0) return null
  return { width, edge, flank, identity, identityCenter: width / 2 }
}

/** The three independently stored display components—never parsed or inferred. */
export function storedJobIdentityComponents(
  request: StructuredJobIdentity,
): StoredJobIdentityComponents {
  return {
    company: nonblankJobIdentity(request.customer?.company),
    job: nonblankJobIdentity(request.name),
    contact: nonblankJobIdentity(request.customer?.name),
  }
}

/** Exact nonblank value order. Missing values take their adjacent separator with them. */
export function structuredJobIdentitySegments(request: StructuredJobIdentity): string[] {
  const { company, job, contact } = storedJobIdentityComponents(request)
  return [company, job, contact].filter((value): value is string => value !== null)
}

export const structuredJobIdentityLine = (request: StructuredJobIdentity): string =>
  structuredJobIdentitySegments(request).join(' | ')

export const jobRequestIdentityLine = (request: JobRequestRow): string =>
  structuredJobIdentityLine(request)
