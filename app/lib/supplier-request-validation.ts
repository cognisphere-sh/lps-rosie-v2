const PARTNER_VALUES = new Set(['true', 'false'])

/** Validate only malformed values that Postgres cannot safely interpret. */
export function invalidSupplierRequest(params: URLSearchParams): string | null {
  for (const [key, value] of params) {
    if (key.includes('\0') || value.includes('\0')) return 'query parameter contains an invalid null character'
  }
  const partners = params.getAll('s.lps_partner')
  if (partners.some((value) => !PARTNER_VALUES.has(value))) {
    return 's.lps_partner must be true or false'
  }
  return null
}
