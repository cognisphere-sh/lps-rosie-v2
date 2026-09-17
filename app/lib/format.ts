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

const monthDayFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  month: '2-digit',
  day: '2-digit',
})

/** Calendar dates stay on their saved day; event timestamps use business time. */
export function formatMonthDay(value: string | null | undefined, separator = '-'): string {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const day = new Date(`${value}T00:00:00Z`)
    if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value) return ''
    return `${value.slice(5, 7)}${separator}${value.slice(8, 10)}`
  }
  const timestamp = new Date(value)
  if (!Number.isFinite(timestamp.getTime())) return ''
  const parts = monthDayFmt.formatToParts(timestamp)
  return `${parts.find((part) => part.type === 'month')!.value}${separator}${parts.find((part) => part.type === 'day')!.value}`
}
