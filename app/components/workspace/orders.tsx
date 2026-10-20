'use client'

import Link from 'next/link'
import { Check, ChevronDown, Layers, LayoutGrid, List, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import { PartnerListCard } from './partner-request-card-layout'
import { JobMetadata } from './job-metadata'
import { PartnerDetailHeader, PartnerFulfillment } from './partner-detail-header'
import { SummaryStrip } from './partner-summary-strip'
import { AnswerCell } from './answer-cell'
import { datePickerProps, EditableText, EditableTextarea } from './editable'
import { ARJobSchedules } from '@/components/workspace/ar-job-schedules'
import { formatWeekdayMonthDay, money, num } from '@/lib/format'
import { orderRecordName, isApsSupplier, ORDER_ITEM_STATUSES, ORDER_ITEM_STATUS_LABELS, ORDER_STATUS_META, orderSubtotal, type FulfillmentMethod, type Order, type OrderItem, type OrderLineChoice, type OrderStatus } from '@/lib/orders'
import { cn } from '@/lib/utils'
import { itemPill, toneDot, toneTint } from '@/lib/job-requests'
import { CopyOrderMenu } from './copy-order-menu'
import { confirmDialog } from './confirm-dialog'
import { EmptyState } from '@/components/workspace/empty-state'

const field = 'h-10 rounded-md border border-input bg-background px-2 text-[12px] outline-none focus-visible:border-ring'
const button = 'inline-flex min-h-10 items-center justify-center rounded-md border border-border px-3 text-[12px] font-semibold transition-colors duration-150 hover:bg-muted disabled:opacity-50'
const primary = 'inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-[opacity,transform,scale] duration-100 ease-lps hover:opacity-90 active:scale-[.97] disabled:opacity-50'

// An order's status in the shared tones (`--lps-tone-*`): text and border read
// the tone's `-fg`, which holds 4.5:1 on the card and the tint in both themes.
const orderBorder = 'border-[var(--order-text)]'
const orderText = 'text-[var(--order-text)]'
const orderTint = 'bg-[var(--order-bg)]'
function orderPalette(status: OrderStatus): CSSProperties {
  const tone = ORDER_STATUS_META[status]?.tone ?? 'grey'
  return { '--order-text': `var(--lps-tone-${tone}-fg)`, '--order-bg': `var(--lps-tone-${tone}-bg)` } as CSSProperties
}

function OrderStatusPill({ status, compact = false }: { status: OrderStatus; compact?: boolean }) {
  return <span data-order-status={status} style={orderPalette(status)} className={cn('inline-flex items-center justify-center whitespace-nowrap rounded-full border transition-colors duration-150 ease-lps', compact ? 'px-2.5 py-0.5 text-[12px] font-semibold' : 'h-7 px-3 text-[13px] font-medium sm:w-[8.5rem]', orderBorder, orderText, orderTint)}>{ORDER_STATUS_META[status]?.label ?? status}</span>
}

function OrderMethodPill({ order, onFulfillmentChange, busy = false }: {
  order: Order; onFulfillmentChange?: (method: FulfillmentMethod | null) => void; busy?: boolean
}) {
  return (order.fulfillmentMethod || onFulfillmentChange) ? <span className={cn('relative inline-flex items-center whitespace-nowrap rounded-full border border-lps-edge bg-card px-2 py-0.5 text-[11px] font-semibold text-primary', onFulfillmentChange && 'transition-colors duration-150 hover:bg-secondary focus-within:ring-2 focus-within:ring-ring')}>
      <span aria-hidden="true">{order.fulfillmentMethod === 'pickup' ? 'Pickup' : order.fulfillmentMethod === 'delivery' ? 'Delivery' : '—'}</span>
      {onFulfillmentChange && <select aria-label={`Pickup or delivery for ${orderRecordName(order)}`} value={order.fulfillmentMethod ?? ''} disabled={busy}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait"
        onChange={(event) => onFulfillmentChange(event.target.value as FulfillmentMethod || null)}>
        <option value="">—</option><option value="pickup">Pickup</option><option value="delivery">Delivery</option>
      </select>}
    </span> : null
}

function OrderFulfillment({ order }: { order: Order }) {
  return <PartnerFulfillment method={order.fulfillmentMethod} date={order.fulfillmentDate} />
}

/** Compact order rows open the supplier's dedicated order page. */
export function PartnerOrderCard({ order, supplierId }: { order: Order; supplierId: number }) {
  const name = order.jobNames?.join(' · ') || orderRecordName(order)
  const customers = [...new Set((order.customerDetails ?? []).map(({ customer }) => customer?.company || customer?.name).filter((c): c is string => !!c))]
  return <PartnerListCard href={`/partner/${supplierId}/orders/${order.id}`} label={`${ORDER_STATUS_META[order.status].label} order ${orderRecordName(order)}`}
    // The status-coloured border request cards carry (New blue, Processing amber, Ready green).
    className={orderBorder} style={orderPalette(order.status)}
    data={{ 'data-order-row-status': order.status }} status={<OrderStatusPill status={order.status} />} name={name}
    count={order.items.length} customer={customers.join(' · ') || null}
    date={<JobMetadata request={{ id: order.id, expectedInstallDate: order.fulfillmentDate, fulfillmentMethod: order.fulfillmentMethod }} showFulfillment={false} className="grid-cols-[max-content]" />} />
}

export type OrderView = 'order' | 'status' | 'plant'
export const ORDER_BUCKETS = ['new', 'processing', 'order_ready'] as const
export type OrderFilter = (typeof ORDER_BUCKETS)[number]

export function OrderStatusFilters({ orders, selected, onChange }: { orders: Order[]; selected: readonly OrderFilter[]; onChange: (value: OrderFilter[]) => void }) {
  return <div role="group" aria-label="Order work buckets" className="flex gap-2 overflow-x-auto max-[899px]:w-full">
    {ORDER_BUCKETS.map((status) => {
      const label = status === 'order_ready' ? 'Ready' : ORDER_STATUS_META[status].label
      const count = orders.filter((order) => order.status === status).length
      const active = selected.includes(status)
      return <button key={status} type="button" data-order-bucket={status} aria-pressed={active}
        aria-label={`${label}: ${count} ${count === 1 ? 'order' : 'orders'}, ${active ? 'selected' : 'not selected'}`}
        onClick={() => onChange(active ? selected.filter((value) => value !== status) : [...selected, status])}
        style={orderPalette(status)}
        className={cn('flex w-[9rem] min-w-[6.5rem] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-2 max-[899px]:w-auto max-[899px]:min-w-0 max-[899px]:flex-1 max-[899px]:py-1.5', orderBorder, orderText,
          active ? orderTint : 'bg-transparent hover:bg-[var(--order-bg)]')}>
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-medium">{active && <Check aria-hidden="true" className="size-3.5" />}{label}</span><span className="text-[18px] font-semibold tabular-nums leading-tight">{count}</span>
      </button>
    })}
  </div>
}

export function OrderViewControls({ value, onChange, includeOrders = false, floating = false }: { value: OrderView; onChange: (value: OrderView) => void; includeOrders?: boolean; floating?: boolean }) {
  const views = [...(includeOrders ? [{ id: 'order' as const, label: 'By order', Icon: List }] : []), { id: 'plant' as const, label: 'By plant', Icon: Layers }, { id: 'status' as const, label: 'By status', Icon: LayoutGrid }]
  return <div role="group" aria-label="Group order rows" className={cn('flex w-fit gap-1 rounded-xl border border-border bg-card p-1 min-[900px]:p-1.5', floating && 'absolute bottom-3 left-1/2 -translate-x-1/2 shadow-[var(--lps-shadow)]')}>
    {views.map(({ id, label, Icon }) => <button key={id} type="button" aria-label={label} title={label} aria-pressed={value === id} onClick={() => onChange(id)} className={cn('flex size-11 min-[900px]:size-9 cursor-pointer items-center justify-center rounded-lg border-none transition-colors duration-150 ease-lps', value === id ? 'bg-foreground text-background' : 'bg-transparent text-muted-foreground hover:bg-lps-tint hover:text-foreground')}><Icon aria-hidden="true" className="size-5" /></button>)}
  </div>
}

type OrderItemEditor = (item: OrderItem, column: string, value: string) => Promise<void>

type OrderLine = { order: Order; item: OrderItem }
const orderLineStyle = (status: string): CSSProperties & { '--order-line-accent': string } => {
  const tone = itemPill(status, null, null).tone
  return { background: toneTint(tone), borderLeft: `3px solid ${toneDot(tone)}`, '--order-line-accent': toneDot(tone) }
}
const itemColors: Record<string, string> = {
  available: 'text-[var(--lps-tone-green-fg)]', partial_qty: 'text-[var(--lps-tone-yellow-fg)]', need_to_order: 'text-[var(--lps-tone-orange-fg)]',
  arriving_soon: 'text-[var(--lps-tone-lime-fg)]', diff_size_sub: 'text-[var(--lps-tone-purple-fg)]',
  unavailable: 'text-[var(--lps-tone-red-fg)]', pending: 'text-muted-foreground',
}

function OrderItemStatus({ status, onChange, portal = false, touch = false }: { status: string; onChange?: (status: string) => void; portal?: boolean; touch?: boolean }) {
  // `portal`: the request page's status pill — rounded, toned text, centred in its cell.
  if (onChange) return <select aria-label="Update plant status" className={portal
    ? cn('cursor-pointer rounded-full border border-border bg-secondary/60 px-3 font-medium outline-none transition-colors duration-150 ease-lps focus-visible:ring-2 focus-visible:ring-ring', itemColors[status] ?? 'text-muted-foreground', touch ? 'min-h-11 w-full text-[14px]' : 'h-9 max-w-40 text-[12px]')
    : `${field} h-8 max-w-40 py-0`} value={status} onChange={(event) => onChange(event.target.value)}>
    {ORDER_ITEM_STATUSES.map((value) => <option key={value} value={value}>{ORDER_ITEM_STATUS_LABELS[value]}</option>)}
  </select>
  return <span className={cn('inline-flex min-h-7 items-center rounded-full border border-current px-2.5 text-[12px] font-medium transition-colors duration-150 ease-lps', itemColors[status] ?? 'text-muted-foreground')}>{ORDER_ITEM_STATUS_LABELS[status] ?? status}</span>
}

const supplierNoteFields = [
  { key: 'noteForSupplier', label: 'Note for supplier' },
  { key: 'noteFromSupplier', label: 'Note from supplier' },
] as const
const customerNoteFields = [
  { key: 'noteForCustomer', label: 'Note for customer' },
] as const
type NoteKey = 'noteForSupplier' | 'noteFromSupplier' | 'noteForCustomer'
const noteColumn: Record<NoteKey, string> = { noteForSupplier: 'note_for_supplier', noteFromSupplier: 'note_from_supplier', noteForCustomer: 'note_for_customer' }
const noteLabel: Record<NoteKey, string> = { noteForSupplier: 'Note for supplier', noteFromSupplier: 'Note from supplier', noteForCustomer: 'Note for customer' }

function OrderLines({ lines, supplierId, showOrder = false, onStatusChange, onDelete, onPriceChange, onEdit }: { onEdit?: OrderItemEditor; lines: OrderLine[]; supplierId?: number; showOrder?: boolean; onStatusChange?: (item: OrderItem, status: string) => void; onDelete?: (item: OrderItem) => void; onPriceChange?: (item: OrderItem, price: string) => void }) {
  const cell = (item: OrderItem, column: string, value: string | number | null | undefined, numeric = false) => onEdit
    ? <EditableText table="order_items" id={item.id} column={column} value={value ?? null} numeric={numeric} className={column === 'name' ? 'whitespace-normal [overflow-wrap:anywhere]' : undefined} align={numeric && !mobile ? 'right' : 'left'} touchTarget title={`Edit ${column.replaceAll('_', ' ')} for ${item.name}`} render={column === 'unit_price' ? money : numeric ? num : undefined} onCommit={(value) => onEdit(item, column, value)} onSaved={() => {}} />
    : <span>{column === 'unit_price' ? money(value) || '—' : numeric ? num(value) : value || '—'}</span>
  const noteCell = (item: OrderItem, key: NoteKey) => onEdit
    ? <EditableTextarea table="order_items" id={item.id} column={noteColumn[key]} value={item[key] ?? null} placeholder="Add note…" editLabel={`${noteLabel[key]} for ${item.name}`} compact onCommit={(value) => onEdit(item, noteColumn[key], value)} onSaved={() => {}} />
    : <span className="block whitespace-pre-wrap px-1.5 text-[12px] text-muted-foreground [overflow-wrap:anywhere]">{item[key] || '—'}</span>
  const noteFields = [...supplierNoteFields, ...customerNoteFields]
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    if (!window.matchMedia) return
    const media = window.matchMedia('(max-width: 899px)')
    const update = () => setMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const source = (order: Order) => supplierId != null && showOrder
    ? <Link href={`/partner/${supplierId}/orders/${order.id}`} className="font-semibold text-primary underline underline-offset-2">{orderRecordName(order)}</Link> : null

  // The supplier's drawing follows the availability-request page (2026-10-07):
  // one bordered table with hairline rows, the tone as a left bar and tint,
  // our note under the plant it is about, and labelled phone cards.
  const askNote = (item: OrderItem, phone = false) => <>
    {item.noteForSupplier && <span className={cn('block whitespace-pre-wrap font-normal text-muted-foreground [overflow-wrap:anywhere]', phone ? 'mt-1 text-[12px] leading-4' : 'mt-0.5 text-[12px] leading-4')}>{item.noteForSupplier}</span>}
    {item.noteFromSupplier && <span className={cn('block whitespace-pre-wrap font-normal text-foreground [overflow-wrap:anywhere]', phone ? 'mt-1 text-[12px] leading-4' : 'mt-0.5 text-[12px] leading-4')}>Your note: {item.noteFromSupplier}</span>}
  </>
  const fieldLabel = 'text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground'
  if (supplierId != null) return <div className="min-w-0" aria-label="Order plants" data-testid={mobile ? "order-mobile-lines" : undefined}>
    {!mobile && <div className="overflow-x-auto rounded-2xl border border-border bg-card"><table className="w-full min-w-[860px] table-fixed border-collapse text-left text-[13px]">
      <colgroup>
        {showOrder && <col style={{ width: 100 }} />}
        <col style={{ width: 72 }} /><col style={{ width: 96 }} /><col />
        <col style={{ width: 180 }} /><col style={{ width: 120 }} /><col style={{ width: 120 }} />
      </colgroup>
      <thead className="border-b border-border text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground"><tr>{showOrder && <th className="px-4 py-3">Order</th>}{['Qty', 'Size', 'Plant', 'Status', 'Unit price', 'Line total'].map((label) => <th key={label} className={cn('px-3 py-3', ['Qty', 'Unit price', 'Line total'].includes(label) && 'text-right', label === 'Status' && 'text-center')}>{label}</th>)}</tr></thead>
      <tbody>{lines.map(({ order, item }) => <tr key={`${order.id}:${item.id}`} className="border-b border-lps-hair align-middle last:border-b-0 [&>td:first-child]:border-l-[3px] [&>td:first-child]:border-l-[var(--order-line-accent)]" style={{ ...orderLineStyle(item.status), borderLeft: undefined }}>
        {showOrder && <td className="px-4 py-3.5">{source(order)}</td>}
        <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{num(item.quantity)}</td>
        <td className="px-3 py-3.5 text-[12px] text-muted-foreground [overflow-wrap:anywhere]">{item.size || '—'}</td>
        <td className="px-3 py-3.5 [overflow-wrap:anywhere]"><span className="block text-[13px] font-semibold text-foreground">{item.name}</span>{askNote(item)}</td>
        <td className="px-3 py-3.5"><div className="flex justify-center"><OrderItemStatus portal status={item.status} onChange={onStatusChange ? (status) => onStatusChange(item, status) : undefined} /></div></td>
        <td className="px-3 py-3.5"><AnswerCell value={item.unitPrice == null ? '' : String(item.unitPrice)} display={money(item.unitPrice)} editable={!!onPriceChange} placeholder="—" ariaLabel={`Price for ${item.name}`} inputMode="decimal" align="right" plain prefix="$" onCommit={(price) => onPriceChange?.(item, price)} /></td>
        <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{money(item.total) || '—'}</td>
      </tr>)}</tbody>
    </table></div>}
    {mobile && <div className="space-y-4">{lines.map(({ order, item }, index) => <article aria-label={`Line ${index + 1}, ${item.name}`} key={`${order.id}:${item.id}`} className="min-w-0 overflow-hidden rounded-xl border border-border bg-card [overflow-wrap:anywhere]" style={orderLineStyle(item.status)}>
      <div className="min-w-0 border-b border-lps-hair px-3 py-3">
        {showOrder && <div className="mb-1 text-[12px]">{source(order)}</div>}
        <p className="m-0 break-words text-[16px] font-bold leading-5 text-foreground">{item.name}</p>
        <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">Qty {num(item.quantity) || '—'}{item.size ? ` · ${item.size}` : ''}</p>
        {askNote(item, true)}
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-3 p-3">
        <div className="col-span-2 flex min-w-0 flex-col gap-1"><span className={fieldLabel}>Status</span><OrderItemStatus portal touch status={item.status} onChange={onStatusChange ? (status) => onStatusChange(item, status) : undefined} /></div>
        <label className="flex min-w-0 flex-col gap-1"><span className={fieldLabel}>Price</span><AnswerCell value={item.unitPrice == null ? '' : String(item.unitPrice)} display={money(item.unitPrice)} editable={!!onPriceChange} placeholder="—" ariaLabel={`Price for ${item.name}`} inputMode="decimal" align="right" touch prefix="$" onCommit={(price) => onPriceChange?.(item, price)} /></label>
        <div className="flex min-w-0 flex-col gap-1"><span className={fieldLabel}>Line total</span><span className="flex min-h-11 items-center justify-end text-[14px] font-semibold tabular-nums">{money(item.total) || '—'}</span></div>
      </div>
    </article>)}</div>}
  </div>
  if (mobile) return <div className="min-w-0 space-y-4" data-testid="order-mobile-lines">
    {lines.map(({ order, item }, index) => <article key={`${order.id}:${item.id}`} aria-label={`Line ${index + 1}, ${item.name}`} className="min-w-0 overflow-hidden rounded-xl border border-border bg-card [overflow-wrap:anywhere]" style={orderLineStyle(item.status)}>
      <div className="min-w-0 border-b border-lps-hair px-3 py-2">
        {showOrder && <div className="mb-2 text-[12px]">{source(order)} <span className="text-muted-foreground">· {ORDER_STATUS_META[order.status].label}</span></div>}
        <p className="m-0 text-[16px] font-bold leading-5 text-foreground">{cell(item, 'name', item.name)}</p>
        <div className="mt-0.5 grid grid-cols-2 gap-2 text-[12px] text-muted-foreground"><label>Quantity{cell(item, 'quantity', item.quantity, true)}</label><label>Size{cell(item, 'size', item.size)}</label></div>
      </div>
      <dl className="m-0 grid min-w-0 grid-cols-2 gap-3 p-3">
        <div className="col-span-2 space-y-1"><dt className="text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">Status</dt><dd className="m-0"><OrderItemStatus status={item.status} onChange={onStatusChange ? (status) => onStatusChange(item, status) : undefined} /></dd></div>
        <div className="space-y-1"><dt className="text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">Unit price</dt><dd className="m-0 text-[13px] tabular-nums">{cell(item, 'unit_price', item.unitPrice, true)}</dd></div>
        <div className="space-y-1"><dt className="text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">Total</dt><dd className="m-0 text-[13px] tabular-nums">{money(item.total) || '—'}</dd></div>
        <div className="col-span-2 flex items-end justify-between gap-2 space-y-1"><div className="space-y-2">{noteFields.map(({ key, label }) => <div key={key}><dt className="text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">{label}</dt><dd className="m-0 whitespace-pre-wrap text-[13px]">{noteCell(item, key)}</dd></div>)}</div>{onDelete && <button type="button" aria-label={`Delete ${item.name} from order`} title="Delete order row" onClick={() => onDelete(item)} className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={16} /></button>}</div>
      </dl>
    </article>)}
  </div>
  return <div className="overflow-x-auto border-y border-border bg-card">
    <table className="w-full min-w-[1100px] table-fixed text-left text-[13px]">
      <colgroup>
        {showOrder && <col style={{ width: 120 }} />}
        <col style={{ width: 80 }} /><col style={{ width: 96 }} /><col style={{ width: 220 }} />
        <col style={{ width: 170 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} />
        {noteFields.map(({ key }) => <col key={key} />)}
        {onDelete && <col style={{ width: 48 }} />}
      </colgroup>
      <thead className="border-b border-border bg-lps-headrow text-[11px] font-bold uppercase tracking-[.05em] text-foreground"><tr>{showOrder && <th className="px-1.5 py-1">Order</th>}<th className="px-1.5 py-1 text-right">Quantity</th><th className="px-1.5 py-1">Size</th><th className="px-1.5 py-1">Plant name</th><th className="px-1.5 py-1">Status</th><th className="px-1.5 py-1 text-right">Unit price</th><th className="px-1.5 py-1 text-right">Total</th><>{noteFields.map(({ key, label }) => <th key={key} className="px-1.5 py-1">{label}</th>)}</>{onDelete && <th className="w-12" aria-label="Actions" />}</tr></thead>
      <tbody>{lines.map(({ order, item }) => <tr key={`${order.id}:${item.id}`} className="border-b border-lps-hair align-middle last:border-0" style={orderLineStyle(item.status)}>
        {showOrder && <td className="px-1.5 py-1">{source(order)}<span className="mt-1 block whitespace-nowrap text-[11px] text-muted-foreground">{ORDER_STATUS_META[order.status].label}</span></td>}
        <td className="px-1.5 py-1 text-right tabular-nums">{cell(item, 'quantity', item.quantity, true)}</td>
        <td className="min-w-24 px-1.5 py-1">{cell(item, 'size', item.size)}</td><td className="px-1.5 py-1 [overflow-wrap:anywhere]">{cell(item, 'name', item.name)}</td>
        <td className="whitespace-nowrap px-1.5 py-1"><OrderItemStatus status={item.status} onChange={onStatusChange ? (status) => onStatusChange(item, status) : undefined} /></td>
        <td className="whitespace-nowrap px-1.5 py-1 text-right tabular-nums">{cell(item, 'unit_price', item.unitPrice, true)}</td><td className="whitespace-nowrap px-1.5 py-1 text-right tabular-nums">{money(item.total) || '—'}</td>
        {noteFields.map(({ key }) => <td key={key} className="min-w-36 px-1.5 py-1"><p className="m-0 whitespace-pre-wrap text-[12px] text-muted-foreground [overflow-wrap:anywhere]">{noteCell(item, key)}</p></td>)}{onDelete && <td className="px-2 py-2 text-center"><button type="button" aria-label={`Delete ${item.name} from order`} title="Delete order row" onClick={() => onDelete(item)} className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={16} /></button></td>}
      </tr>)}</tbody>
    </table>
  </div>
}

/** The same rows serve the page and the supplier's cross-order views. */
export function OrderLineGroups({ orders, groupBy, supplierId, onStatusChange, onEdit }: { onEdit?: OrderItemEditor; orders: Order[]; groupBy: 'status' | 'plant'; supplierId?: number; onStatusChange?: (item: OrderItem, status: string) => void }) {
  const groups = new Map<string, { label: string; lines: OrderLine[] }>()
  for (const order of orders) for (const item of order.items) {
    const key = groupBy === 'status' ? item.status : item.name.trim().toLocaleLowerCase()
    if (!groups.has(key)) groups.set(key, { label: groupBy === 'status' ? ORDER_ITEM_STATUS_LABELS[item.status] ?? item.status : item.name, lines: [] })
    groups.get(key)!.lines.push({ order, item })
  }
  return <div className="flex flex-col gap-3">
    {[...groups].map(([key, group]) => <section key={key} aria-label={`${groupBy === 'status' ? 'Status' : 'Plant'}: ${group.label}`} className="min-w-0 space-y-2">
      <h2 className="m-0 px-1 py-1 text-[13px] font-semibold">{group.label} <span className="ml-1 text-muted-foreground">({group.lines.length})</span></h2>
      <OrderLines lines={group.lines} supplierId={supplierId} showOrder={supplierId != null} onStatusChange={onStatusChange} onEdit={onEdit} />
    </section>)}
  </div>
}

function OrderSummary({ order }: { order: Order }) {
  return <section aria-label="Order summary"><SummaryStrip items={order.items} subtotal={orderSubtotal(order)} statusOptions={Object.entries(ORDER_ITEM_STATUS_LABELS).map(([value, label]) => ({ value, label }))} /></section>
}

/** The supplier's availability request for this job, if any (one per job and supplier). */
function OrderRequestLink({ order, supplierId }: { order: Order; supplierId?: number }) {
  const id = order.availabilityRequestId
  return id != null && <nav aria-label="Order availability request" className="flex flex-wrap items-center gap-2 text-[12px]">
    <span className="text-muted-foreground">Availability request:</span><Link href={supplierId != null ? `/partner/${supplierId}/requests/${id}` : `/suppliers/${order.supplierId}?tab=requests&ar=${id}`} className="font-medium text-primary underline underline-offset-2">{order.availabilityRequestName || `AR-${id}`}</Link>
  </nav>
}

function OrderPrintSheet({ order }: { order: Order }) {
  const [node, setNode] = useState<HTMLElement | null>(null)
  useEffect(() => setNode(document.body), [])
  if (!node) return null
  return createPortal(<div id="order-print-sheet" className="hidden print:block" aria-hidden>
    <h1 className="mb-2 text-[18px] font-bold">{orderRecordName(order)}</h1>
    <p className="text-[12px]">{order.supplierName} · {ORDER_STATUS_META[order.status].label}</p>
    <OrderFulfillment order={order} />
    {order.noteForSupplier && <p className="whitespace-pre-wrap text-[12px]">Note for supplier: {order.noteForSupplier}</p>}
    {order.noteFromSupplier && <p className="whitespace-pre-wrap text-[12px]">Note from supplier: {order.noteFromSupplier}</p>}
    <p className="text-[11px]">Availability request: {order.availabilityRequestId != null ? order.availabilityRequestName || `AR-${order.availabilityRequestId}` : '—'}</p>
    <table className="mt-3 w-full border-collapse text-left text-[11px] [&_td]:border [&_td]:border-neutral-400 [&_td]:p-2 [&_th]:border [&_th]:border-neutral-400 [&_th]:p-2">
      <thead><tr>{['Plant / size', 'Quantity', 'Status', 'Unit price', 'Total', 'Note for supplier'].map((label) => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{order.items.map((item) => <tr key={item.id} style={{ breakInside: 'avoid' }}><td>{item.name}{item.size ? ` · ${item.size}` : ''}</td><td>{num(item.quantity)}</td><td>{ORDER_ITEM_STATUS_LABELS[item.status] ?? item.status}</td><td>{money(item.unitPrice) || '—'}</td><td>{money(item.total) || '—'}</td><td className="whitespace-pre-wrap">{item.noteForSupplier}</td></tr>)}</tbody>
      <tfoot><tr><td colSpan={6}>{orderRecordName(order)} · Subtotal {money(orderSubtotal(order)) || '—'}</td></tr></tfoot>
    </table>
  </div>, node)
}

function OrderConfirmation({ order, supplier, busy, error, onClose, onSave }: { order: Order; supplier: boolean; busy: boolean; error: string | null; onClose: () => void; onSave: (body: object) => Promise<boolean> }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [date, setDate] = useState(order.fulfillmentDate ?? '')
  // A supplier writes their own reply; Chris writes LPS's note for the supplier.
  const noteKey = supplier ? 'noteFromSupplier' : 'noteForSupplier'
  const [note, setNote] = useState(order[noteKey] ?? '')
  const confirming = order.status === 'new'
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    return () => trigger?.focus()
  }, [])
  return createPortal(<dialog ref={dialog} aria-labelledby={titleId} aria-busy={busy} onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
    className="lps-pop lps-pop-dialog m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-[420px] overflow-y-auto rounded-2xl border border-border bg-popover p-4 text-foreground shadow-[var(--lps-shadow)] backdrop:bg-black/40">
    <form className="flex flex-col gap-4" onSubmit={async (event) => {
      event.preventDefault()
      if (busy || !date) return
      if (await onSave({ ...(confirming ? { status: 'processing' } : {}), fulfillmentDate: date, [noteKey]: note })) onClose()
    }}>
      <h2 id={titleId} className="m-0 text-[18px] font-semibold">{confirming ? 'Acknowledge Received' : 'Fulfillment details'} · {orderRecordName(order)}</h2>
      <div className="space-y-1"><span className="block text-[11px] text-muted-foreground">Customer request</span><ARJobSchedules schedules={order.jobSchedules} showFulfillmentMethod={false} /></div>
      <label className="flex flex-col gap-1 text-[12px] font-semibold">Fulfillment date<input aria-label={`Fulfillment date for ${orderRecordName(order)}`} required type="date" className={`${field} w-full min-w-0`} value={date} disabled={busy} {...datePickerProps({ onChange: (event) => setDate(event.target.value) })} /></label>
      <label className="flex flex-col gap-1 text-[12px] font-semibold">{supplier ? 'Your note on this order' : 'Note for supplier'}<textarea aria-label={supplier ? 'Your note on this order' : 'Note for supplier'} className="min-h-24 rounded-md border border-input bg-background p-2 text-[13px] font-normal" rows={3} maxLength={10000} value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} placeholder="Timing or other order details…" /></label>
      {confirming && <p className="m-0 text-[12px] text-muted-foreground">Set your fulfillment date to move this order to Processing.</p>}
      {error && <p role="alert" className="m-0 text-[12px] text-destructive">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" className={button} disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className={primary} disabled={busy || !date}>{busy ? 'Saving…' : confirming ? 'Acknowledge Received' : 'Save details'}</button></div>
    </form>
  </dialog>, document.body)
}

/** Match availability answers: selecting a status opens a deliberate save step. */
function OrderItemStatusDialog({ order, item, initialStatus, withNote, busy, error, onClose, onSave }: {
  order: Order; item: OrderItem; initialStatus: string; withNote: boolean; busy: boolean; error: string | null
  onClose: () => void; onSave: (status: string, note: string | undefined) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [status, setStatus] = useState(initialStatus)
  // The supplier's note is saved on the row (0146), so it starts as the saved one.
  const [note, setNote] = useState(item.noteFromSupplier ?? '')
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    return () => trigger?.focus()
  }, [])
  return createPortal(<dialog ref={dialog} aria-labelledby={titleId} aria-busy={busy} onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
    className="lps-pop lps-pop-dialog m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-[420px] overflow-y-auto rounded-2xl border border-border bg-popover p-4 text-foreground shadow-[var(--lps-shadow)] backdrop:bg-black/40">
    <form className="flex flex-col gap-4" onSubmit={async (event) => {
      event.preventDefault()
      if (!busy) { onSave(status, withNote ? note : undefined); onClose() }
    }}>
      <h2 id={titleId} className="m-0 text-[18px] font-semibold">Update plant status · {orderRecordName(order)}</h2>
      <p className="m-0 text-[13px] text-muted-foreground">{item.name}{item.size ? ` · ${item.size}` : ''}</p>
      <label className="flex flex-col gap-1 text-[12px] font-semibold">Status
        <select aria-label={`Plant status for ${item.name}`} className={`${field} w-full`} value={status} disabled={busy} onChange={(event) => setStatus(event.target.value)}>
          {ORDER_ITEM_STATUSES.map((value) => <option key={value} value={value}>{ORDER_ITEM_STATUS_LABELS[value]}</option>)}
        </select>
      </label>
      {withNote && <label className="flex flex-col gap-1 text-[12px] font-semibold">Your note on this plant
        <textarea aria-label={`Status details for ${item.name}`} value={note} onChange={(event) => setNote(event.target.value)} maxLength={10000} rows={3}
          placeholder={status === 'unavailable' ? 'Why is this unavailable?' : status === 'diff_size_sub' ? 'Describe the size or substitute.' : 'ETA, pricing, conditions, or other details…'} className="min-h-20 rounded-md border border-input bg-background p-2 text-[13px] font-normal" />
      </label>}
      <p className="m-0 text-[12px] text-muted-foreground">This is staged until you save all order status changes.</p>
      {error && <p role="alert" className="m-0 text-[12px] text-destructive">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" className={button} disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className={primary} disabled={busy}>{busy ? 'Saving…' : 'Save status'}</button></div>
    </form>
  </dialog>, document.body)
}

/** Admin and supplier views share the same guarded lifecycle controls. */
export function OrderCard({ order: saved, supplierId, canEdit = false, canEditFulfillmentMethod = false, onChanged }: { order: Order; supplierId?: number; canEdit?: boolean; canEditFulfillmentMethod?: boolean; onChanged?: () => void | Promise<void> }) {
  // Optimistic: in-flight writes are overlaid on the saved order and each is
  // dropped once its write (and the refetch after it) settles — success shows
  // the refetched value, failure the old one.
  const [pendingFields, setPendingFields] = useState<Partial<Order>>({})
  const [pendingItems, setPendingItems] = useState<Record<number, Partial<OrderItem>>>({})
  const order: Order = Object.keys(pendingFields).length || Object.keys(pendingItems).length
    ? { ...saved, ...pendingFields, items: saved.items.map((item) => (pendingItems[item.id] ? { ...item, ...pendingItems[item.id] } : item)) }
    : saved
  const overlayItem = (id: number, patch: Partial<OrderItem> | null) => setPendingItems((current) => {
    const next = { ...current }
    if (patch) next[id] = { ...next[id], ...patch }
    else delete next[id]
    return next
  })
  const [expanded, setExpanded] = useState(false)
  const contentId = useId()
  const [confirmOpen, setConfirmOpen] = useState(false)
  // Ready tells LPS the plants can go; the button asks once more before it does.
  const [confirmReady, setConfirmReady] = useState(false)
  const [statusUpdate, setStatusUpdate] = useState<{ item: OrderItem; status: string } | null>(null)
  const [stagedStatuses, setStagedStatuses] = useState<Record<number, { item: OrderItem; status: string; note?: string }>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const closed = order.closed === true || order.status === 'closed_won' || order.status === 'closed_lost'
  const editable = canEdit && !closed

  async function write(body: Partial<Order>) {
    if (!editable || busy) return false
    setBusy(true); setError(null)
    setPendingFields(body)
    try {
      const url = supplierId != null ? `/api/partner/${supplierId}/orders/${order.id}` : `/api/orders/${order.id}`
      const res = await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const result = await res.json() as { error?: string }
      if (!res.ok) throw new Error(result.error ?? 'Could not update order')
      await onChanged?.()
      return true
    } catch (error) { setError((error as Error).message); return false }
    finally { setPendingFields({}); setBusy(false) }
  }

  async function editItem(item: OrderItem, column: string, value: string) {
    const response = await fetch(`/api/orders/${order.id}/items/${item.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ column, value }),
    })
    const result = await response.json() as { error?: string }
    if (!response.ok) throw new Error(result.error ?? 'Could not save order item')
    await onChanged?.()
  }

  async function writeItemStatus(item: OrderItem, status: string, note?: string) {
    if (!editable || busy) return false
    setBusy(true); setError(null)
    overlayItem(item.id, { status, ...(note !== undefined ? { noteFromSupplier: note.trim() || null } : {}) })
    try {
      const url = supplierId != null
        ? `/api/partner/${supplierId}/orders/${order.id}/items/${item.id}`
        : `/api/orders/${order.id}/items/${item.id}`
      const res = await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status, ...(note !== undefined ? { noteFromSupplier: note } : {}) }) })
      const body = await res.json() as { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Could not update plant status')
      await onChanged?.()
      return true
    } catch (error) { setError((error as Error).message); return false } finally { overlayItem(item.id, null); setBusy(false) }
  }

  async function writeItemPrice(item: OrderItem, value: string) {
    const price = value.trim() === '' ? null : Number(value)
    if (price !== null && (!Number.isFinite(price) || price <= 0 || price >= 100000000 || Math.abs(price * 100 - Math.round(price * 100)) > 0.000001)) {
      setError('Enter a positive price with at most two decimal places.'); return
    }
    if (!editable || busy || price === item.unitPrice) return
    setBusy(true); setError(null)
    overlayItem(item.id, { unitPrice: price })
    try {
      const res = await fetch(`/api/partner/${supplierId}/orders/${order.id}/items/${item.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ unitPrice: price }) })
      const body = await res.json() as { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Could not save price')
      await onChanged?.()
    } catch (error) { setError((error as Error).message) } finally { overlayItem(item.id, null); setBusy(false) }
  }

  async function addRow() {
    if (!editable || busy) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/orders/${order.id}/items`, { method: 'POST' })
      const body = await res.json() as { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Could not add a row')
      await onChanged?.()
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }

  async function deleteRow(item: OrderItem) {
    if (!editable || busy || !(await confirmDialog({
      title: `Delete ${item.name} from ${orderRecordName(order)}?`,
      body: order.items.length === 1 ? 'It is the last row, so the order is deleted too.' : undefined,
      action: 'Delete row',
      destructive: true,
    }))) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/orders/${order.id}/items/${item.id}`, { method: 'DELETE' })
      const body = await res.json() as { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Could not delete the row')
      await onChanged?.()
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }

  function requestItemStatus(item: OrderItem, status: string) {
    if (status !== item.status) setStatusUpdate({ item, status })
  }

  async function saveStagedStatuses() {
    const changes = Object.values(stagedStatuses)
    if (!changes.length || busy) return
    setError(null)
    // Optimistic: the staged statuses become the shown ones and the save bar
    // goes now; a refused line puts it and the lines after it back on stage.
    for (const change of changes) overlayItem(change.item.id, { status: change.status })
    setStagedStatuses({})
    try {
      for (const [index, change] of changes.entries()) {
        if (!(await writeItemStatus(change.item, change.status, change.note))) {
          for (const rest of changes.slice(index + 1)) overlayItem(rest.item.id, null)
          setStagedStatuses(Object.fromEntries(changes.slice(index).map((c) => [c.item.id, c])))
          return
        }
      }
      const url = supplierId != null ? `/api/partner/${supplierId}/orders/${order.id}/status-notification` : null
      if (url) {
        const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ changes: changes.map(({ item, status, note }) => ({ itemId: item.id, status, note: note ?? '' })) }) })
        const body = await res.json() as { error?: string }; if (!res.ok) throw new Error(body.error ?? 'Could not notify Rosie')
      }
    } catch (error) { setError((error as Error).message) }
  }

  // Confirming a supplier order belongs in the supplier portal. Chris's job
  // cards remain a compact view/control surface for arrangement and tracking.
  const actions = editable && (order.status === 'new'
    ? supplierId != null && <button type="button" className={cn(primary, 'min-h-11 flex-none print:hidden')} disabled={busy} onClick={() => { setError(null); setConfirmOpen(true) }}>Acknowledge Received</button>
    : <><button type="button" className={button} disabled={busy} onClick={() => { setError(null); setConfirmOpen(true) }}>Edit fulfillment details</button>{order.status === 'processing' && <button type="button" className={cn(primary, 'min-h-11', supplierId != null && 'min-h-12 flex-1 text-[16px] min-[900px]:max-w-sm')} disabled={busy || !order.fulfillmentDate}
      onBlur={() => setConfirmReady(false)}
      onClick={() => { if (!confirmReady) { setConfirmReady(true); return } setConfirmReady(false); void write({ status: 'order_ready' }) }}>
      {busy ? 'Saving…' : confirmReady ? `Confirm: ready for ${formatWeekdayMonthDay(order.fulfillmentDate) || 'fulfillment'}` : 'Mark as Ready'}</button>}</>)

  const fulfillmentChange = editable && canEditFulfillmentMethod ? (method: FulfillmentMethod | null) => void write({ fulfillmentMethod: method }) : undefined

  if (supplierId != null) return <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pb-5 pl-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] md:px-4 [&>*]:shrink-0">
      {error && !confirmOpen && <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">{error}</div>}
      <PartnerDetailHeader name={order.jobNames?.join(' · ') || orderRecordName(order)} status={<OrderStatusPill status={order.status} />} schedule={<OrderFulfillment order={order} />}
        contacts={order.customerDetails ?? []} note={order.noteForSupplier}>
        {order.noteFromSupplier && <p className="m-0 whitespace-pre-wrap text-[12px] [overflow-wrap:anywhere]"><span className="text-muted-foreground">Your note: </span>{order.noteFromSupplier}</p>}
        <OrderRequestLink order={order} supplierId={supplierId} />
        {!canEdit && !closed && <p className="m-0 text-[12px] text-muted-foreground">This account has read-only access to this order.</p>}
        {order.confirmationDate && <p className="m-0 text-[11px] text-muted-foreground">Acknowledged: {formatWeekdayMonthDay(order.confirmationDate)}</p>}
      </PartnerDetailHeader>
      <OrderPrintSheet order={order} />
      <OrderSummary order={order} />
      <OrderLines lines={order.items.map((item) => ({ order, item: stagedStatuses[item.id] ? { ...item, status: stagedStatuses[item.id].status } : item }))} supplierId={supplierId} onStatusChange={editable ? requestItemStatus : undefined} onPriceChange={editable && !busy ? writeItemPrice : undefined} />
      {closed && <p className="m-0 text-[12px] text-muted-foreground">This order is closed.</p>}
    </div>
    {/* Centred and wide, as the request page's Submit availability bar. */}
    {editable && <footer aria-label="Order actions" className="flex flex-none justify-center border-t border-border bg-card px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] md:px-4 print:hidden">
      <div className="flex w-full max-w-sm flex-wrap items-center justify-center gap-2 [&>button]:min-h-12 [&>button]:flex-1 [&>button]:rounded-lg [&>button]:text-[16px]">{actions}</div>
    </footer>}
    {editable && Object.keys(stagedStatuses).length > 0 && <footer aria-label="Save order status changes" className="flex flex-none flex-col items-center gap-2 border-t border-border bg-card px-3 py-3 md:px-4 print:hidden"><button type="button" className={cn(primary, 'min-h-12 w-full max-w-sm rounded-lg text-[16px]')} disabled={busy} onClick={() => void saveStagedStatuses()}>{busy ? 'Saving…' : `Save ${Object.keys(stagedStatuses).length} status change${Object.keys(stagedStatuses).length === 1 ? '' : 's'}`}</button><span className="text-[12px] text-muted-foreground">Sends one update to Rosie.</span></footer>}
    {editable && confirmOpen && <OrderConfirmation order={order} supplier={supplierId != null} busy={busy} error={error} onClose={() => setConfirmOpen(false)} onSave={write} />}
    {editable && statusUpdate && <OrderItemStatusDialog order={order} item={statusUpdate.item} initialStatus={statusUpdate.status} withNote={supplierId != null} busy={busy} error={error}
      onClose={() => setStatusUpdate(null)} onSave={(status, note) => setStagedStatuses((current) => ({ ...current, [statusUpdate.item.id]: { item: statusUpdate.item, status, note } }))} />}
  </div>

  return <article aria-label={`Order ${orderRecordName(order)}`} className="@container flex-none overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
    <header className="flex flex-col gap-1.5 px-3.5 py-2.5 transition-colors duration-150 hover:bg-lps-tint">
      <div className="flex min-w-0 items-start gap-2.5">
        <button type="button" aria-expanded={expanded} aria-controls={contentId} aria-label={`${expanded ? 'Collapse' : 'Expand'} order ${orderRecordName(order)}`} onClick={() => setExpanded((value) => !value)} className="relative flex size-6 flex-none cursor-pointer items-center justify-center self-start rounded-md border-none bg-transparent text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5 pointer-coarse:after:content-['']"><ChevronDown aria-hidden="true" size={14} className={cn('transition-transform duration-150 ease-lps', !expanded && '-rotate-90')} /></button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
            <OrderStatusPill status={order.status} compact />
            <span className="min-w-0 max-w-full truncate text-[13px] font-semibold text-foreground" title={`Created ${formatWeekdayMonthDay(order.createdAt) || '—'}`}>
              <span className="text-primary">{orderRecordName(order)}</span>{order.jobNames?.length ? ` - ${order.jobNames.join(' · ')}` : ''}
            </span>
            <div aria-label="Customer EDD" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              {(order.jobSchedules?.length ? order.jobSchedules : [{ jobRequestId: null, jobName: null, expectedInstallDate: null }]).map((schedule, index) => <div key={schedule.jobRequestId ?? index} className="flex items-center gap-1.5" title="Expected delivery date">
                {(order.jobSchedules?.length ?? 0) > 1 && <span className="text-[11px] text-muted-foreground">{schedule.jobName || (schedule.jobRequestId ? `JR-${schedule.jobRequestId}` : `Job ${index + 1}`)}</span>}
                <JobMetadata request={{ id: schedule.jobRequestId ?? index, expectedInstallDate: schedule.expectedInstallDate, fulfillmentMethod: null }} showFulfillment={false} className="grid-cols-[max-content]" />
              </div>)}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <OrderMethodPill order={order} onFulfillmentChange={fulfillmentChange} busy={busy} />
              <span aria-hidden="true">·</span>
              <span>{order.items.length} {order.items.length === 1 ? 'item' : 'items'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold tabular-nums text-foreground">{money(orderSubtotal(order)) || '—'}</span>
              <CopyOrderMenu order={order} canShare={canEdit} closed={closed} onChanged={onChanged} />
            </div>
          </div>
        </div>
      </div>
      {/* Indented to the title column (chevron + gap). In a narrow card the
          segments stack instead of crushing into one another. */}
      <div className="flex min-w-0 flex-wrap items-center gap-2 pl-8.5 text-[11px] text-muted-foreground">
        <span className="inline-flex max-w-full items-stretch overflow-hidden rounded-xl border border-lps-edge bg-card text-[11px] font-semibold @max-lg:flex-col">
          <Link href={`/suppliers/${order.supplierId}`} className="flex min-h-8 min-w-0 items-center px-2 py-0.5 text-foreground hover:text-primary hover:underline">{order.supplierName}</Link>
          <span className="flex min-w-0 flex-none items-center border-l border-lps-hair px-2 py-0.5 text-muted-foreground @max-lg:min-h-8 @max-lg:border-l-0 @max-lg:border-t">Fulfillment: <span className="ml-1 whitespace-nowrap font-semibold tabular-nums text-foreground">{formatWeekdayMonthDay(order.fulfillmentDate) || 'To be confirmed'}</span></span>
          {order.noteForSupplier && <span title={order.noteForSupplier} className="flex min-w-0 max-w-48 items-center border-l border-lps-hair px-2 py-0.5 font-normal @max-lg:min-h-8 @max-lg:max-w-none @max-lg:border-l-0 @max-lg:border-t"><span className="truncate">{order.noteForSupplier}</span></span>}
        </span>
        {order.confirmationDate && <span>Acknowledged: {formatWeekdayMonthDay(order.confirmationDate)}</span>}
        <div className="ml-auto"><OrderRequestLink order={order} /></div>
      </div>
    </header>
    {error && !confirmOpen && <p role="alert" className="mx-3.5 mt-2 text-[12px] text-destructive">{error}</p>}
    <div id={contentId} hidden={!expanded} className="space-y-3 border-t border-border">
      {editable && <div className="flex flex-wrap items-center gap-2 bg-lps-tint px-3.5 py-2">{actions}{Object.keys(stagedStatuses).length > 0 && <button type="button" className={primary} disabled={busy} onClick={() => void saveStagedStatuses()}>{busy ? 'Saving…' : 'Save status changes'}</button>}</div>}
      {[...supplierNoteFields, ...customerNoteFields].map(({ key, label }) => order[key] && <div key={key} className="px-3.5"><h4 className="text-[12px] font-semibold">{label}</h4><p className="whitespace-pre-wrap text-[12px] text-muted-foreground [overflow-wrap:anywhere]">{order[key]}</p></div>)}
      <OrderLines lines={order.items.map((item) => ({ order, item: stagedStatuses[item.id] ? { ...item, status: stagedStatuses[item.id].status } : item }))} onEdit={editable ? editItem : undefined} onStatusChange={editable ? requestItemStatus : undefined} onDelete={editable ? (item) => void deleteRow(item) : undefined} />
      {editable && <div className="px-3.5 pb-3"><button type="button" className={button} disabled={busy} onClick={() => void addRow()}><Plus aria-hidden="true" size={14} className="mr-1" />Add row</button></div>}
    </div>
    {editable && confirmOpen && <OrderConfirmation order={order} supplier={supplierId != null} busy={busy} error={error} onClose={() => setConfirmOpen(false)} onSave={write} />}
    {editable && statusUpdate && <OrderItemStatusDialog order={order} item={statusUpdate.item} initialStatus={statusUpdate.status} withNote={supplierId != null} busy={busy} error={error}
      onClose={() => setStatusUpdate(null)} onSave={(status, note) => setStagedStatuses((current) => ({ ...current, [statusUpdate.item.id]: { item: statusUpdate.item, status, note } }))} />}
  </article>
}

interface OrdersPayload { orders: Order[]; lines: OrderLineChoice[]; fulfillmentMethod: FulfillmentMethod | null; error?: string }

/**
 * One order per job and supplier (0146): Chris ticks the lines to order and
 * each becomes a row copied from its selected candidate.
 */
export function JobOrders({ jobRequestId, onChanged, version = 0 }: { jobRequestId: number; onChanged?: () => void; version?: number }) {
  const [data, setData] = useState<OrdersPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState(false)
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [unticked, setUnticked] = useState<Set<number>>(new Set())
  const [method, setMethod] = useState<FulfillmentMethod | ''>('')
  const [noteForSupplier, setNoteForSupplier] = useState('')
  const [noteForCustomer, setNoteForCustomer] = useState('')
  const [createdId, setCreatedId] = useState<number | null>(null)
  const revision = useRef(0)
  const initializedJob = useRef<number | null>(null)

  const load = useCallback(async () => {
    const version = ++revision.current
    setLoading(true)
    try {
      const res = await fetch(`/api/orders?job=${jobRequestId}`, { cache: 'no-store' })
      const body = await res.json() as OrdersPayload
      if (!res.ok) throw new Error(body.error ?? 'Could not load orders')
      if (version !== revision.current) return
      setData(body)
      setError(null)
      setSupplierId((current) => body.lines.some((line) => line.supplierId === current) ? current
        : body.lines.find((line) => isApsSupplier(line.supplierName))?.supplierId ?? body.lines[0]?.supplierId ?? null)
      if (initializedJob.current !== jobRequestId) {
        setMethod(body.fulfillmentMethod ?? '')
        initializedJob.current = jobRequestId
      }
    } catch (error) { if (version === revision.current) setError((error as Error).message) }
    finally { if (version === revision.current) setLoading(false) }
  }, [jobRequestId])

  useEffect(() => { void load(); return () => { revision.current += 1 } }, [load, version])
  useEffect(() => { setUnticked(new Set()); setCreatedId(null) }, [jobRequestId, supplierId])

  const suppliers = [...new Map((data?.lines ?? []).map((line) => [line.supplierId, line.supplierName])).entries()]
  const lines = (data?.lines ?? []).filter((line) => line.supplierId === supplierId)
  const picked = lines.filter((line) => !unticked.has(line.jobRequestItemId))
  const pickedTotal = picked.reduce((sum, line) => sum + (line.quantity ?? 0) * (line.unitPrice ?? 0), 0)
  const unpriced = picked.filter((line) => line.unitPrice == null).length
  const supplierName = suppliers.find(([id]) => id === supplierId)?.[1] ?? 'The supplier'
  // Lines for a supplier with an open order go onto it; its header stays as it is.
  const openOrder = data?.orders.find((order) => order.supplierId === supplierId && !order.closed && ['new', 'processing', 'order_ready'].includes(order.status))

  async function create() {
    if (supplierId == null || !picked.length) return
    setCreating(true); setError(null)
    try {
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        jobRequestId, supplierId, fulfillmentMethod: method || null, noteForSupplier: noteForSupplier || null, noteForCustomer: noteForCustomer || null,
        jobRequestItemIds: picked.map((line) => line.jobRequestItemId) }) })
      const body = await res.json() as { id: number; error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Could not create order')
      setCreatedId(body.id); setOpen(false); setNoteForSupplier(''); setNoteForCustomer('')
      await load(); onChanged?.()
    } catch (error) { setError((error as Error).message) }
    finally { setCreating(false) }
  }

  return <section className="flex flex-col gap-3 p-3" aria-label="Job orders">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[12px] text-muted-foreground">{data?.orders.length ?? 0} {data?.orders.length === 1 ? 'order' : 'orders'} · One order per supplier; each row is a line&apos;s selected candidate.</p><button type="button" className={button} onClick={() => setOpen(!open)}>{open ? 'Cancel new order' : 'Create order'}</button></div>
    {error && <p role="alert" className="text-[12px] text-destructive">{error}</p>}
    {createdId && <p role="status" className="text-[12px] font-medium">Saved to {orderRecordName({ id: createdId, recordName: data?.orders.find((order) => order.id === createdId)?.recordName })}.</p>}
    {open && <form className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3" onSubmit={(event) => { event.preventDefault(); void create() }}>
      <h3 className="text-[13px] font-bold">Order selected candidates · JR-{jobRequestId}</h3>
      {loading && !data ? <p className="text-[12px] text-muted-foreground">Loading lines…</p> : !suppliers.length ? <p className="text-[12px] text-muted-foreground">Every line&apos;s selected candidate is already on an order.</p> : <>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">Supplier<select className={field} value={supplierId ?? ''} onChange={(event) => setSupplierId(Number(event.target.value))}>{suppliers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          {!openOrder && <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">Pickup / delivery<select className={field} value={method} onChange={(event) => setMethod(event.target.value as FulfillmentMethod | '')}><option value="">To be arranged</option><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select></label>}
        </div>
        {openOrder && <p className="m-0 text-[12px] text-muted-foreground">These lines are added to {orderRecordName(openOrder)}, the open order with this supplier.</p>}
        <div className="flex flex-col divide-y divide-border">
          {lines.map((line) => {
            const checked = !unticked.has(line.jobRequestItemId)
            return <label key={line.jobRequestItemId} className="flex min-h-10 flex-wrap items-center gap-x-2 gap-y-1 py-1.5 text-[12px]">
              <input type="checkbox" aria-label={`Order ${line.name}`} checked={checked} onChange={(event) => setUnticked((current) => {
                const next = new Set(current)
                if (event.target.checked) next.delete(line.jobRequestItemId); else next.add(line.jobRequestItemId)
                return next
              })} />
              <span className="tabular-nums">{line.quantity == null ? '—' : num(line.quantity)} ×</span>
              <span className="font-semibold">{[line.size, line.name].filter(Boolean).join(' ')}</span>
              <span className="text-muted-foreground">{ORDER_ITEM_STATUS_LABELS[line.status] ?? line.status} · {money(line.unitPrice) || 'No price'}</span>
            </label>
          })}
        </div>
        {!openOrder && <>
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">Note for supplier<textarea className="min-h-16 rounded-md border border-input bg-background p-2 text-[12px]" value={noteForSupplier} onChange={(event) => setNoteForSupplier(event.target.value)} /></label>
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">Note for customer<textarea className="min-h-16 rounded-md border border-input bg-background p-2 text-[12px]" value={noteForCustomer} onChange={(event) => setNoteForCustomer(event.target.value)} /></label>
        </>}
        {picked.length > 0 && <p className="m-0 text-[12px] text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{money(pickedTotal) || '$0.00'}</span>
          {unpriced > 0 && <> · {unpriced} {unpriced === 1 ? 'row has' : 'rows have'} no price</>}
          {' · '}{openOrder ? `${supplierName} sees the added rows on ${orderRecordName(openOrder)} straight away.` : `${supplierName} sees this order in their portal as soon as it is created.`}
        </p>}
        <div className="flex justify-end"><button type="submit" className={primary} disabled={creating || loading || !picked.length}>{creating ? 'Saving…' : openOrder ? `Add ${picked.length} to ${orderRecordName(openOrder)}` : `Create order with ${picked.length} ${picked.length === 1 ? 'row' : 'rows'}`}</button></div>
      </>}
    </form>}
    {loading && !data && <p className="py-6 text-center text-[12px] text-muted-foreground">Loading orders…</p>}
    {!loading && data?.orders.length === 0 && !open && <EmptyState art="seed" className="py-8" title="No orders yet" hint="Create an order from the job's selected candidates." />}
    {data?.orders.map((order) => <OrderCard key={order.id} order={order} canEdit canEditFulfillmentMethod onChanged={async () => { await load(); onChanged?.() }} />)}
  </section>
}
