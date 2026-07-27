const priceFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function money(value: unknown): string {
  const n = Number(value)
  return Number.isFinite(n) ? priceFmt.format(n) : ''
}

export function num(value: unknown): string {
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

