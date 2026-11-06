/** Shared partner identity for page chrome, sign-in and browser titles. */
export function partnerPortalName(supplierName?: string | null): string {
  return supplierName?.trim() || 'Partner Portal'
}

/** Only portal paths may supply a company id for the sign-in heading. */
export function partnerLoginContext(next: string | null): { supplierId: number | null } | null {
  if (!next) return null
  const match = /^\/partner(?:\/([1-9]\d*))?(?:\/[^?#\\\s]*)?$/.exec(next)
  if (!match) return null
  const supplierId = match[1] ? Number(match[1]) : null
  if (supplierId !== null && !Number.isSafeInteger(supplierId)) return null
  return { supplierId }
}
