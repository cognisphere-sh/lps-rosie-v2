import { money, num } from './format'
import { orderSubtotal, type Order } from './orders'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

export function orderShareContent(order: Order, origin: string, visibility: 'public' | 'private' = order.publicToken ? 'public' : 'private') {
  if (visibility === 'public' && !order.publicToken) throw new Error('A public order link is required')
  const url = new URL(visibility === 'public' ? `/public/orders/${order.publicToken}` : `/partner/${order.supplierId}/orders/${order.id}`, origin).href
  const linkLabel = visibility === 'public' ? 'Public order' : 'Private order'
  const fulfillment = order.fulfillmentMethod === 'pickup' ? 'Pickup' : order.fulfillmentMethod === 'delivery' ? 'Delivery' : 'To be confirmed'
  const cell = 'border:1px solid #dce4de;padding:10px 12px;text-align:left;vertical-align:top;white-space:pre-wrap'
  const link = (label: string, href: string) => `<a href="${escapeHtml(href)}" style="color:#226345;text-decoration:underline">${escapeHtml(label)}</a>`
  const details: Array<[string, string]> = [
    ['Supplier', order.supplierName], ['Pickup or delivery', fulfillment],
    ['Fulfillment date', order.fulfillmentDate || 'To be confirmed'],
    ...(order.noteForSupplier ? [['Note', order.noteForSupplier] as [string, string]] : []),
    ...(order.noteFromSupplier ? [['Note from supplier', order.noteFromSupplier] as [string, string]] : []),
  ]
  const jobs = order.shareJobs ?? []
  const jobDetails = jobs.map((job) => ({
    name: job.jobName || 'Job',
    href: visibility === 'public' ? url : new URL(`/jobs?jr=${job.jobRequestId}`, origin).href,
    rows: [
      ['Customer', [job.customer?.company, job.customer?.name].filter(Boolean).join(' · ') || 'Not provided'],
      ...(job.customer?.email ? [['Email', job.customer.email]] : []),
      ...(job.customer?.phone ? [['Phone', job.customer.phone]] : []),
      ...(job.shippingAddress ? [['Delivery address', job.shippingAddress]] : []),
      ['Installation date', job.expectedInstallDate || 'To be confirmed'],
    ],
  }))
  const metadata = (rows: string[][]) => `<table role="presentation" style="width:100%;border-collapse:collapse;margin:12px 0 20px">${rows.map(([label, value]) => `<tr><th style="${cell};width:150px;background:#f3f6f4;color:#506057;font-size:12px">${escapeHtml(label)}</th><td style="${cell}">${escapeHtml(value)}</td></tr>`).join('')}</table>`
  const headings = ['Quantity', 'Size', 'Plant Name', 'Unit Price', 'Total']
  const rows = order.items.map((item) => [num(item.quantity), item.size || '—', item.name,
    money(item.unitPrice) || '—', money(item.total) || '—'])
  const subtotal = money(orderSubtotal(order)) || '—'
  return {
    html: `<div style="max-width:960px;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#202e26"><h1 style="margin:0 0 4px;font-size:26px">Order</h1>${visibility === 'public' ? `<p style="margin:0 0 20px">${link(linkLabel, url)}</p>` : ''}${metadata(details)}${jobDetails.map((job) => `<h2 style="font-size:18px;margin:20px 0 8px">${link(job.name, job.href)}</h2>${metadata(job.rows)}`).join('')}<h2 style="font-size:18px;margin:20px 0 8px">Plants</h2><table aria-label="Order items" style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>${headings.map((heading) => `<th style="${cell};background:#eaf1ec;font-weight:600">${heading}</th>`).join('')}</tr></thead><tbody>${rows.map((row, index) => `<tr style="background:${index % 2 ? '#f7f9f7' : '#ffffff'}">${row.map((value, column) => `<td style="${cell}${[0, 3, 4].includes(column) ? ';text-align:right' : ''}">${escapeHtml(value)}${column === 2 && order.items[index].noteForSupplier ? `<div style="margin-top:4px;font-size:12px;color:#647167;font-style:italic;white-space:pre-wrap">${escapeHtml(order.items[index].noteForSupplier!)}</div>` : ''}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr><td colspan="5" style="${cell};text-align:right;background:#eaf1ec"><strong style="font-size:20px">Subtotal: ${escapeHtml(subtotal)}</strong><br><span style="color:#506057">${rows.length} ${rows.length === 1 ? 'item' : 'items'}</span></td></tr></tfoot></table></div>`,
    text: ['Order', ...(visibility === 'public' ? [`${linkLabel}: ${url}`] : []), ...details.map(([label, value]) => `${label}: ${value}`), ...jobDetails.flatMap((job) => [`Job: ${job.name}`, job.href, ...job.rows.map(([label, value]) => `${label}: ${value}`)]), '', headings.join('\t'), ...rows.map((row, index) => row.map((value, column) => column === 2 && order.items[index].noteForSupplier ? `${value} — ${order.items[index].noteForSupplier}` : value).join('\t')), `Subtotal: ${subtotal}`, `${rows.length} items`].join('\n'),
  }
}
