import type { ColFilters } from '@/lib/table-config'

export const PARTNER_FILTER_OPTIONS = {
  'LPS Partners': 'true',
  'Not partners': 'false',
} as const

export type SupplierFilterValues = {
  name: string
  city: string[]
  category: string[]
  state: string[]
  partner: string[]
}

export function supplierFilterValues(filters: ColFilters): SupplierFilterValues {
  const list = (key: string) => Array.isArray(filters[key]) ? filters[key] as string[] : []
  return {
    name: typeof filters.name === 'string' ? filters.name : '',
    city: list('city'),
    category: list('category'),
    state: list('state'),
    partner: list('lps_partner'),
  }
}

export function supplierFilterSummary(values: SupplierFilterValues): string[] {
  const summaries: string[] = []
  if (values.name) summaries.push(`Name: ${values.name}`)
  if (values.city.length) summaries.push(`City: ${values.city.join(', ')}`)
  if (values.category.length) summaries.push(`Type: ${values.category.join(', ')}`)
  if (values.state.length) summaries.push(`State: ${values.state.join(', ')}`)
  const partner = Object.entries(PARTNER_FILTER_OPTIONS).find(([, value]) => values.partner.includes(value))?.[0]
  if (partner) summaries.push(`Partner: ${partner}`)
  return summaries
}
