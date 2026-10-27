import { arLineTotal, arResponseLabel, arResponseTone, arShownStatus, arSubtotal, availabilityRecordName, type ARDetail, type ARItem } from './availability'
import { money, num } from './format'
import { TONE_COLORS } from './job-request-html-quote'
import { requestRef } from './job-requests'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

/** A line's answer as copied: Diff Sz/Sub names its substitute. */
function answer(item: ARItem): string {
  const status = arShownStatus(item)
  const sub = status === 'diff_size_sub'
    ? item.offerDescription?.trim() || item.alternatives?.find((alternative) => alternative.id === item.offeredCandidateId)?.description
    : null
  return sub ? `${arResponseLabel(status)}: ${sub}` : arResponseLabel(status)
}

/**
 * A copied availability request (2026-10-26), in the Copy order's shape: the
 * job's name linked to the request — the public page for a Public copy, the
 * supplier's portal page for a Private one — then the print sheet's columns
 * and the subtotal. The text copy is only the lines and the link. No customer
 * details: those follow the Share Customer Info switch.
 */
export function availabilityShareContent(ar: ARDetail, origin: string, visibility: 'public' | 'private') {
  if (visibility === 'public' && !ar.publicToken) throw new Error('A public availability link is required')
  const url = new URL(visibility === 'public' ? `/public/availability/${ar.publicToken}` : `/partner/${ar.supplierId}/requests/${ar.id}`, origin).href
  const name = ar.jobName ?? (ar.jobRequestId != null ? requestRef(ar.jobRequestId) : availabilityRecordName(ar))
  const ref = `${availabilityRecordName(ar)} · ${ar.supplierName}`
  const cell = 'border:1px solid #dce4de;padding:8px 10px;text-align:left;vertical-align:top'
  const headings = ['Qty', 'Size', 'Name', 'Status', 'Avail. Qty', 'Unit Price', 'Total', 'Notes']
  const rows = ar.items.map((item) => {
    const tone = TONE_COLORS[arResponseTone(arShownStatus(item))]
    return `<tr>${[
      `<td style="${cell};text-align:right;white-space:nowrap">${escapeHtml(num(item.demandedQuantity) || '—')}</td>`,
      `<td style="${cell};white-space:nowrap">${escapeHtml(item.size || '—')}</td>`,
      `<td style="${cell}">${escapeHtml(item.name)}${item.noteForSupplier ? `<div style="margin-top:2px;color:#506057;font-size:12px;white-space:pre-wrap">${escapeHtml(item.noteForSupplier)}</div>` : ''}</td>`,
      `<td style="${cell};font-weight:700;background:${tone.bg};color:${tone.fg}">${escapeHtml(answer(item))}</td>`,
      `<td style="${cell};text-align:right;white-space:nowrap">${escapeHtml(num(item.availableQuantity) || '—')}</td>`,
      `<td style="${cell};text-align:right;white-space:nowrap">${escapeHtml(money(item.unitPrice) || '—')}</td>`,
      `<td style="${cell};text-align:right;white-space:nowrap">${escapeHtml(money(arLineTotal(item)) || '—')}</td>`,
      `<td style="${cell};white-space:pre-wrap">${escapeHtml(item.noteFromSupplier ?? '')}</td>`,
    ].join('')}</tr>`
  }).join('')
  const subtotal = money(arSubtotal(ar.items)) || '—'
  const note = ar.noteForSupplier?.trim()
  // Copy text is just the plant list and the link (2026-10-26): `qty × size name`.
  const lines = ar.items.map((item) => [num(item.demandedQuantity) && `${num(item.demandedQuantity)} ×`, item.size?.trim(), item.name]
    .filter(Boolean).join(' '))
  return {
    url,
    html: `<div style="max-width:960px;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#202e26"><h1 style="margin:0 0 4px;font-size:26px"><a href="${escapeHtml(url)}" style="color:#226345;text-decoration:underline">${escapeHtml(name)}</a></h1><p style="margin:0 0 16px;color:#506057">${escapeHtml(ref)}</p><table aria-label="Availability lines" style="width:auto;max-width:100%;border-collapse:collapse;font-size:13px"><thead><tr>${headings.map((heading) => `<th style="${cell};background:#eaf1ec;font-weight:600">${heading}</th>`).join('')}</tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="${headings.length}" style="${cell};text-align:right;background:#eaf1ec"><strong style="font-size:20px">Subtotal: ${escapeHtml(subtotal)}</strong></td></tr></tfoot></table>${note ? `<p style="margin:16px 0 0;white-space:pre-wrap"><strong>Note:</strong> ${escapeHtml(note)}</p>` : ''}</div>`,
    text: [...lines, '', url].join('\n'),
  }
}
