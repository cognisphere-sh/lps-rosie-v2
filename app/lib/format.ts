const priceFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function money(value: unknown): string {
  // Number(null) and Number('') are both zero. Missing supplier prices must stay
  // visibly missing rather than being advertised as $0.00/free.
  if (value == null || value === '') return ''
  const n = Number(value)
  return Number.isFinite(n) ? priceFmt.format(n) : ''
}

export function num(value: unknown): string {
  if (value == null || value === '') return ''
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString('en-US') : ''
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

