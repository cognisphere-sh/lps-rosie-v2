import { money, num } from '@/lib/format'
import { jobNameIncludesCustomer } from '@/lib/job-identity'
import { itemPill, type Tone } from '@/lib/job-requests'
import type { JobRequestItem, JobRequestRow } from '@/lib/rows'

export interface HtmlQuote {
  html: string
  text: string
}

export interface QuoteTemplateOptions {
  /** Include the saved availability status in the copyable output. */
  includeAvailabilityStatus?: boolean
}

/** The customer-facing quantity: unavailable is zero, then availability, then demand. */
export function quoteQuantity(item: Pick<JobRequestItem, 'status' | 'availableQuantity' | 'quantity'>): number | null {
  if (item.status === 'unavailable') return 0
  if (item.availableQuantity != null && Number.isFinite(item.availableQuantity)) return item.availableQuantity
  if (item.quantity != null && Number.isFinite(item.quantity)) return item.quantity
  return null
}

/** Total using the same availability-first quantity a quote displays; unavailable is zero, priced or not. */
export function quoteLineTotal(item: Pick<JobRequestItem, 'status' | 'availableQuantity' | 'quantity' | 'unitPrice'>): number | null {
  if (item.status === 'unavailable') return 0
  const quantity = quoteQuantity(item)
  if (quantity == null || item.unitPrice == null || !Number.isFinite(item.unitPrice)) return null
  return quantity * item.unitPrice
}

/** The quote's subtotal: every line's quote total, unpriced lines counting zero. */
export function quoteSubtotal(items: Pick<JobRequestItem, 'status' | 'availableQuantity' | 'quantity' | 'unitPrice'>[]): number {
  return items.reduce((sum, item) => sum + (quoteLineTotal(item) ?? 0), 0)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]!)
}

// Email clients drop CSS variables: the light theme's tone pill colours, inlined.
export const TONE_COLORS: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: '#E9F3EA', fg: '#2F7A44' },
  lime: { bg: '#F3F8E3', fg: '#5F7D1A' },
  grey: { bg: '#EDF1ED', fg: '#55685A' },
  amber: { bg: '#FBF3DF', fg: '#8A5A00' },
  yellow: { bg: '#FBF6D2', fg: '#6E5B00' },
  orange: { bg: '#FDEBDD', fg: '#9A4A0B' },
  red: { bg: '#FAEAE5', fg: '#B3391F' },
  teal: { bg: '#E6F2F6', fg: '#2A6274' },
  blue: { bg: '#EAF4FF', fg: '#075EA8' },
  purple: { bg: '#F1EEFE', fg: '#5B45C4' },
}

function quoteLine(item: JobRequestItem): { quantity: string; size: string; name: string; status: string; tone: Tone; note: string; unit: string; total: string } | null {
  const quantity = quoteQuantity(item)
  const total = quoteLineTotal(item)
  if (quantity == null || total == null) return null
  const pill = itemPill(item.status, item.quantity, item.availableQuantity)
  // The customer's own ask, even when a substitute is selected.
  return {
    quantity: num(quantity),
    size: item.size?.trim() || '—',
    name: item.name,
    status: pill.label,
    tone: pill.tone,
    note: item.noteForCustomer?.trim() || '—',
    unit: item.unitPrice == null ? '—' : money(item.unitPrice),
    total: money(total),
  }
}

/**
 * Converts a saved Job Request into Rosie's compact Gmail-ready quote region.
 * It uses zero for unavailable rows (which need no price), confirmed
 * availability when present, then requested demand, and refuses incomplete
 * pricing rather than copying a partial customer quote.
 */
export function jobRequestToHtmlQuote(request: JobRequestRow, options: QuoteTemplateOptions = {}): HtmlQuote {
  const lines = request.items.map(quoteLine)
  if (!lines.length) throw new Error('Add at least one priced line before copying an HTML quote.')
  if (lines.some((line) => line == null)) throw new Error('Every line needs a quantity and unit price before copying a quote.')

  const quoteLines = lines as NonNullable<typeof lines[number]>[]
  const subtotal = quoteSubtotal(request.items)
  const customer = request.customer?.company?.trim() || request.customer?.name?.trim() || 'Customer'
  const job = request.name?.trim() || `JR-${request.id}`
  const identity = jobNameIncludesCustomer(request) ? job : `${customer} · ${job}`
  const cell = 'border:1px solid #d1d5db;padding:0.25rem 0.35rem;vertical-align:top;'
  const header = `${cell}background:#edf6f0;font-weight:700;text-align:left;white-space:nowrap;`
  const currency = `${cell}text-align:right;white-space:nowrap;`
  const statusCell = (line: typeof quoteLines[number]) => options.includeAvailabilityStatus ? `<td style="${cell}white-space:nowrap;font-weight:700;background:${TONE_COLORS[line.tone].bg};color:${TONE_COLORS[line.tone].fg}">${escapeHtml(line.status)}</td>` : ''
  const rows = quoteLines.map((line) => `<tr><td style="${cell}white-space:nowrap">${escapeHtml(line.quantity)}</td><td style="${cell}white-space:nowrap">${escapeHtml(line.size)}</td><td style="${cell}max-width:12rem;white-space:normal">${escapeHtml(line.name)}</td>${statusCell(line)}<td style="${cell}max-width:12rem;white-space:normal">${escapeHtml(line.note)}</td><td style="${currency}">${escapeHtml(line.unit)}</td><td style="${currency}">${escapeHtml(line.total)}</td></tr>`).join('')
  const headings = ['Qty', 'Size', 'Plant', ...(options.includeAvailabilityStatus ? ['Status'] : []), 'Note', 'Each', 'Total'].map((label) => `<th style="${header}">${label}</th>`).join('')
  const subtotalText = money(subtotal)
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:0.85rem;color:#202820;background:#ffffff;padding:0.25rem"><p style="margin:0 0 0.75rem"><strong>Quote · JR-${request.id}</strong><br>${escapeHtml(identity)}</p><table style="border-collapse:collapse;width:auto;max-width:100%;line-height:1.25;font-family:Arial,Helvetica,sans-serif;font-size:0.85rem;color:#202820;background:#ffffff"><thead><tr>${headings}</tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="${options.includeAvailabilityStatus ? 6 : 5}" style="${cell}text-align:right"><strong>Subtotal</strong></td><td style="${currency}"><strong>${subtotalText}</strong></td></tr></tfoot></table></div>`
  const text = `${quoteLines.map((line) => `${line.quantity} x ${line.size} ${line.name}${options.includeAvailabilityStatus ? ` - ${line.status}` : ''}${line.note === '—' ? '' : ` - ${line.note}`} - ${line.unit} - ${line.total}`).join('\n')}\n\nSubtotal: ${subtotalText}`
  return { html, text }
}
