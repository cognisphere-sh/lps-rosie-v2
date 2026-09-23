import { money, num } from './format'
import { orderRecordName, ORDER_ITEM_STATUS_LABELS, ORDER_STATUS_META, orderSubtotal, type Order } from './orders'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

export function orderShareContent(order: Order, origin: string) {
  const url = new URL(order.publicToken ? `/public/orders/${order.publicToken}` : `/partner/${order.supplierId}/orders/${order.id}`, origin).href
  const linkLabel = order.publicToken ? 'Public order' : 'Supplier portal order'
  const details = [
    `Order ${orderRecordName(order)} · ${order.supplierName}`,
    `Status: ${ORDER_STATUS_META[order.status].label}`,
    `Pickup or delivery: ${order.fulfillmentMethod === 'pickup' ? 'Pickup' : order.fulfillmentMethod === 'delivery' ? 'Delivery' : 'To be confirmed'}`,
    ...(order.shareJobs?.length ? order.shareJobs.flatMap((job) => [
      `Job: ${job.jobName || `JR-${job.jobRequestId}`}`,
      `Customer: ${[job.customer?.company, job.customer?.name].filter(Boolean).join(' · ') || 'Not provided'}`,
      ...(job.customer?.email ? [`Email: ${job.customer.email}`] : []),
      ...(job.customer?.phone ? [`Phone: ${job.customer.phone}`] : []),
      ...(job.shippingAddress ? [`Delivery address: ${job.shippingAddress}`] : []),
      `Installation date: ${job.expectedInstallDate || 'To be confirmed'}`,
    ]) : ['Customer: Not provided', ...(order.jobSchedules?.length
      ? order.jobSchedules.map((job) => `Installation date: ${job.expectedInstallDate || 'To be confirmed'}`)
      : ['Installation date: To be confirmed'])]),
    ...(order.noteFromSupplier ? [`Note from supplier: ${order.noteFromSupplier}`] : []),
    ...(order.noteForSupplier ? [`Note for supplier: ${order.noteForSupplier}`] : []),
  ]
  const headings = ['Quantity', 'Plant', 'Size', 'Status', 'Unit price', 'Total', 'Note for supplier', 'Note from supplier']
  const rows = order.items.map((item) => [num(item.quantity), item.name, item.size || '—', ORDER_ITEM_STATUS_LABELS[item.status] ?? item.status,
    money(item.unitPrice) || '—', money(item.total) || '—', item.noteForSupplier || '—', item.noteFromSupplier || '—'])
  const subtotal = `Subtotal: ${money(orderSubtotal(order)) || '—'}`
  const cell = 'border:1px solid #cccccc;padding:8px;text-align:left;white-space:pre-wrap'
  return {
    html: `<div style="font-family:Arial,sans-serif;color:#202820">${details.map((line) => `<p style="white-space:pre-wrap">${escapeHtml(line)}</p>`).join('')}<p>${linkLabel}: <a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p><table style="border-collapse:collapse"><thead><tr>${headings.map((heading) => `<th style="${cell}">${heading}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value) => `<td style="${cell}">${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr><td colspan="8" style="${cell}"><strong>${escapeHtml(subtotal)}</strong></td></tr></tfoot></table></div>`,
    text: [...details, `${linkLabel}: ${url}`, '', headings.join('\t'), ...rows.map((row) => row.join('\t')), subtotal].join('\n'),
  }
}
