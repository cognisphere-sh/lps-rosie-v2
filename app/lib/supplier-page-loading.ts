import type { SupplierCompany } from '@/lib/rows'

export type SupplierPageBody = {
  companies?: SupplierCompany[]
  total?: number
  pageCount?: number
}

/** One bounded page read. HTTP errors and malformed JSON reject like network errors. */
export async function fetchSupplierPage(
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<SupplierPageBody> {
  const response = await fetcher(url)
  if (!response.ok) throw new Error(`Supplier page request failed (${response.status})`)
  return response.json() as Promise<SupplierPageBody>
}

/** Keep pages already revealed while replacing a retried page by company id. */
export function appendSupplierPage(
  current: SupplierCompany[],
  next: SupplierCompany[],
): SupplierCompany[] {
  const nextIds = new Set(next.map((company) => company.id))
  return [...current.filter((company) => !nextIds.has(company.id)), ...next]
}
