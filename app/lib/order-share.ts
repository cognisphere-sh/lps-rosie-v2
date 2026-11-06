import { formatWeekdayMonthDay, money, num } from './format'
import { orderEdd, orderRecordName, orderSubtotal, type Order } from './orders'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

/**
 * What a copied or printed order states up top (2026-10-21): mode and target
 * date — the job's (0149) — then each Additional details field (0151; they
 * carry the customer). No supplier, order number or change log.
 */
export function orderSheetDetails(order: Order): Array<[string, string]> {
  return [
    ['Mode', order.fulfillmentMethod === 'pickup' ? 'Pickup' : order.fulfillmentMethod === 'delivery' ? 'Delivery' : 'To be confirmed'],
    ['Target date', formatWeekdayMonthDay(orderEdd(order)) || 'To be confirmed'],
    ...(order.additionalDetails ?? []).map(({ field, value }): [string, string] => [field, value]),
  ]
}

export type DetailsBlock = { kind: 'text'; text: string } | { kind: 'fields'; fields: [string, string][] }

const tableCells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
const separator = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/

/**
 * Markdown split into its `| a | b |` pipe-row pairs and the text between; a
 * header row (one followed by `| --- |`) is dropped. Reads a change log
 * written as a table (Additional details are JSON since 0151).
 */
export function detailsBlocks(markdown: string): DetailsBlock[] {
  const blocks: DetailsBlock[] = []
  const lines = markdown.trim().split('\n')
  let text: string[] = []
  const flush = () => { if (text.join('').trim()) blocks.push({ kind: 'text', text: text.join('\n').trim() }); text = [] }
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].trim().startsWith('|')) { text.push(lines[index]); continue }
    flush()
    const rows: string[][] = []
    for (; index < lines.length && lines[index].trim().startsWith('|'); index++) {
      if (separator.test(lines[index])) rows.pop()
      else rows.push(tableCells(lines[index]))
    }
    index--
    const fields = rows.flatMap((cells) => cells.flatMap((cell, at) => at % 2 || !cell ? [] : [[cell, cells[at + 1] ?? ''] as [string, string]]))
    if (fields.length) blocks.push({ kind: 'fields', fields })
  }
  flush()
  return blocks
}

/** A change log is bullets (0150); one written as a pipe table reads as `- date: change` bullets. */
export function changeLogBullets(text: string): string {
  return detailsBlocks(text).map((block) => block.kind === 'fields'
    ? block.fields.map(([date, change]) => `- ${date}: ${change}`).join('\n') : block.text).join('\n')
}


/**
 * A copied order (2026-10-21) is titled with its job's name, linked to the
 * order: the public page when public, the supplier's portal page when private.
 * Mode, Target date and each Additional details field
 * are rows of one table; the change log is not copied.
 */
export function orderShareContent(order: Order, origin: string, visibility: 'public' | 'private' = order.publicToken ? 'public' : 'private') {
  if (visibility === 'public' && !order.publicToken) throw new Error('A public order link is required')
  const url = new URL(visibility === 'public' ? `/public/orders/${order.publicToken}` : `/partner/${order.supplierId}/orders/${order.id}`, origin).href
  const name = order.jobNames?.join(' · ') || orderRecordName(order)
  const cell = 'border:1px solid #dce4de;padding:10px 12px;text-align:left;vertical-align:top'
  const details = orderSheetDetails(order)
  const label = `${cell};width:150px;background:#f3f6f4;color:#506057;font-size:12px`
  const metadata = `<table role="presentation" style="width:100%;border-collapse:collapse;margin:12px 0 20px">${details.map(([field, value]) => `<tr><th style="${label}">${escapeHtml(field)}</th><td style="${cell};font-weight:600">${escapeHtml(value).replaceAll('\n', '<br>')}</td></tr>`).join('')}</table>`
  const headings = ['Qty', 'Size', 'Name', 'Unit Price', 'Total']
  const rows = order.items.map((item) => `<tr>${[
    `<td style="${cell};text-align:right;white-space:nowrap">${escapeHtml(num(item.quantity))}</td>`,
    `<td style="${cell};white-space:nowrap">${escapeHtml(item.size || '—')}</td>`,
    `<td style="${cell}">${escapeHtml(item.name)}${item.noteForSupplier ? `<div style="margin-top:2px;color:#506057;font-size:12px;white-space:pre-wrap">${escapeHtml(item.noteForSupplier)}</div>` : ''}</td>`,
    `<td style="${cell};text-align:right;white-space:nowrap">${escapeHtml(money(item.unitPrice) || '—')}</td>`,
    `<td style="${cell};text-align:right;white-space:nowrap">${escapeHtml(money(item.total) || '—')}</td>`,
  ].join('')}</tr>`).join('')
  const subtotal = money(orderSubtotal(order)) || '—'
  // The Text Quote's line format without the line total (2026-10-21): `qty x size name - note - unit`.
  const lines = order.items.map((item) => `${num(item.quantity)} x ${item.size?.trim() || '—'} ${item.name}${item.noteForSupplier?.trim() ? ` - ${item.noteForSupplier.trim().replace(/\s*\n\s*/g, '; ')}` : ''} - ${money(item.unitPrice) || '—'}`)
  return {
    url,
    html: `<div style="max-width:960px;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#202e26"><h1 style="margin:0 0 4px;font-size:26px"><a href="${escapeHtml(url)}" style="color:#226345;text-decoration:underline">${escapeHtml(name)}</a></h1>${metadata}<table aria-label="Order items" style="width:auto;max-width:100%;border-collapse:collapse;font-size:13px"><thead><tr>${headings.map((heading) => `<th style="${cell};background:#eaf1ec;font-weight:600">${heading}</th>`).join('')}</tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="5" style="${cell};text-align:right;background:#eaf1ec"><strong style="font-size:20px">Subtotal: ${escapeHtml(subtotal)}</strong></td></tr></tfoot></table></div>`,
    text: [
      `${name}: ${url}`, '',
      ...details.map(([field, value]) => `${field}: ${value}`),
      '', ...lines, '', `Subtotal: ${subtotal}`,
    ].join('\n'),
  }
}
