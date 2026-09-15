import type { JobInboxRow } from '@/lib/job-inbox'

/** Match every word against the complete server-provided job and plant corpus. */
export function searchJobInbox<T extends JobInboxRow>(rows: T[], query: string): T[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return rows
  return rows.filter((row) => {
    const text = (row.searchText ?? [
      `JR-${row.id}`, row.name, row.customerCompany, row.customerContact,
    ].filter(Boolean).join('\n')).toLowerCase()
    return terms.every((term) => text.includes(term))
  })
}
