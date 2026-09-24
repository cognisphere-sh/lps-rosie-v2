'use client'

import Link from 'next/link'
import { Check, ChevronDown, Layers, LayoutGrid, List, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import { PartnerCardFulfillment } from './partner-request-card-layout'
import { JobMetadata } from './job-metadata'
import { PartnerDetailHeader, PartnerFulfillment } from './partner-detail-header'
import { SummaryStrip } from './partner-summary-strip'
import { AnswerCell } from './availability'
import { EditableText, EditableTextarea } from './editable'
import { ARJobSchedules } from '@/components/workspace/ar-job-schedules'
import { arResponseLabel } from '@/lib/availability'
import { formatWeekdayMonthDay, money, num } from '@/lib/format'
import { orderRecordName, isApsSupplier, ORDER_ITEM_STATUSES, ORDER_ITEM_STATUS_LABELS, ORDER_STATUS_META, orderSubtotal, type DirectOrderCandidate, type FulfillmentMethod, type Order, type OrderCandidate, type OrderItem, type OrderStatus } from '@/lib/orders'
import { cn } from '@/lib/utils'
import { itemPill, toneDot, toneTint } from '@/lib/job-requests'
import { CopyOrderMenu } from './copy-order-menu'

const field = 'h-10 rounded-md border border-input bg-background px-2 text-[12px] outline-none focus-visible:border-ring'
const button = 'inline-flex min-h-10 items-center justify-center rounded-md border border-border px-3 text-[12px] font-semibold hover:bg-muted disabled:opacity-50'
const primary = 'inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50'

const orderPalettes = {
  new: ['#075EA8', '#EAF4FF', '#1976C9', '#7FC4FF', '#102A3D', '#3E9BE0'],
  processing: ['#8A3F00', '#FFF2DD', '#B85C00', '#FFB86B', '#3A2412', '#D57A1F'],
  order_ready: ['#126B36', '#EAF8EF', '#25864B', '#79D99B', '#12301F', '#36A463'],
  closed_won: ['#126B36', '#EAF8EF', '#25864B', '#79D99B', '#12301F', '#36A463'],
  closed_lost: ['#A42B32', '#FFF0F1', '#B83D46', '#FFB2B9', '#3D1C22', '#E16A76'],
  all: ['#1E3B28', '#EDF4EE', '#486251', '#E8E8E8', '#253029', '#9EAEA2'],
}
const orderBorder = 'border-[var(--order-border)] dark:border-[var(--order-dark-border)]'
const orderText = 'text-[var(--order-text)] dark:text-[var(--order-dark-text)]'
const orderTint = 'bg-[var(--order-bg)] dark:bg-[var(--order-dark-bg)]'
function orderPalette(status: OrderStatus | 'all'): CSSProperties {
  const [text, background, border, darkText, darkBackground, darkBorder] = orderPalettes[status]
  return { '--order-text': text, '--order-bg': background, '--order-border': border,
    '--order-dark-text': darkText, '--order-dark-bg': darkBackground, '--order-dark-border': darkBorder } as CSSProperties
}

function OrderStatusPill({ status }: { status: OrderStatus }) {
  return <span data-order-status={status} style={orderPalette(status)} className={cn('inline-flex h-7 items-center justify-center whitespace-nowrap rounded-full border px-3 text-[12.5px] font-medium sm:w-[8.5rem]', orderBorder, orderText, orderTint)}>{ORDER_STATUS_META[status]?.label ?? status}</span>
}

function OrderMetadata({ order, showFulfillmentDate = false, onFulfillmentChange, busy = false }: {
  order: Order; showFulfillmentDate?: boolean; onFulfillmentChange?: (method: FulfillmentMethod | null) => void; busy?: boolean
}) {
  return <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
    {(order.jobSchedules ?? []).map((schedule, index) => <span key={schedule.jobRequestId ?? index} className="inline-flex min-w-0 items-center gap-1.5" aria-label="Customer request schedule">
      {(schedule.jobName || schedule.jobRequestId) && <span className="font-semibold text-foreground">{schedule.jobName || `JR-${schedule.jobRequestId}`}</span>}
      <span title="Expected delivery date" className="whitespace-nowrap font-semibold tabular-nums text-foreground">{formatWeekdayMonthDay(schedule.expectedInstallDate) || '—'}</span>
    </span>)}
    <span className="whitespace-nowrap">Created: <span className="font-semibold tabular-nums text-foreground">{formatWeekdayMonthDay(order.createdAt) || '—'}</span></span>
    {showFulfillmentDate && <span>Fulfillment date: <span className="font-semibold tabular-nums text-foreground">{formatWeekdayMonthDay(order.fulfillmentDate) || 'To be confirmed'}</span></span>}
    {(order.fulfillmentMethod || onFulfillmentChange) && <span className={cn('relative inline-flex items-center whitespace-nowrap rounded-full border border-lps-edge bg-card px-2 py-0.5 font-semibold text-primary', onFulfillmentChange && 'hover:bg-secondary focus-within:ring-2 focus-within:ring-ring')}>
      <span aria-hidden="true">{order.fulfillmentMethod === 'pickup' ? 'Pickup' : order.fulfillmentMethod === 'delivery' ? 'Delivery' : '—'}</span>
      {onFulfillmentChange && <select aria-label={`Pickup or delivery for ${orderRecordName(order)}`} value={order.fulfillmentMethod ?? ''} disabled={busy}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait"
        onChange={(event) => onFulfillmentChange(event.target.value as FulfillmentMethod || null)}>
        <option value="">—</option><option value="pickup">Pickup</option><option value="delivery">Delivery</option>
      </select>}
    </span>}
  </div>
}

function OrderFulfillment({ order }: { order: Order }) {
  return <PartnerFulfillment method={order.fulfillmentMethod} date={order.fulfillmentDate} />
}

/** Compact order rows open the supplier's dedicated order page. */
export function PartnerOrderCard({ order, supplierId }: { order: Order; supplierId: number }) {
  const name = order.jobNames?.join(' · ') || orderRecordName(order)
  const note = order.noteForSupplier?.trim()
  return <Link href={`/partner/${supplierId}/orders/${order.id}`} aria-label={`${ORDER_STATUS_META[order.status].label} order ${orderRecordName(order)}`}
    data-order-row-status={order.status}
    className="flex flex-none flex-col gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 no-underline shadow-sm transition-shadow hover:bg-lps-tint hover:shadow-md">
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
      <span className="inline-flex [&>span]:h-6 [&>span]:w-auto [&>span]:px-2 [&>span]:text-[11px]"><OrderStatusPill status={order.status} /></span>
      <span className="min-w-0 max-w-full truncate text-[12.5px] font-semibold text-foreground" title={name}>{name}</span>
      <JobMetadata request={{ id: order.id, expectedInstallDate: order.fulfillmentDate, fulfillmentMethod: order.fulfillmentMethod }} showFulfillment={false} className="grid-cols-[max-content]" />
      <span className="ml-auto flex items-center gap-2 whitespace-nowrap text-[11px] text-muted-foreground">
        <PartnerCardFulfillment method={order.fulfillmentMethod} /><span aria-hidden="true">:</span>
        <span>{order.items.length} {order.items.length === 1 ? 'item' : 'items'}</span><span aria-hidden="true">:</span>
        <span className="font-semibold tabular-nums text-foreground">{money(orderSubtotal(order)) || '—'}</span>
      </span>
    </div>
    {(order.customerDetails?.length || note) && <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
      {order.customerDetails?.map(({ customer }, index) => (customer?.company || customer?.name) && <span key={index} className="font-semibold text-foreground">{customer?.company || customer?.name}</span>)}
      {note && <span title={note} className="whitespace-pre-wrap [overflow-wrap:anywhere]">{note}</span>}
    </div>}
  </Link>
}

export type OrderView = 'order' | 'status' | 'plant'
export const ORDER_BUCKETS = ['new', 'processing', 'order_ready'] as const
export type OrderFilter = (typeof ORDER_BUCKETS)[number]

export function OrderStatusFilters({ orders, selected, onChange }: { orders: Order[]; selected: readonly OrderFilter[]; onChange: (value: OrderFilter[]) => void }) {
  return <div role="group" aria-label="Order work buckets" className="flex gap-2 overflow-x-auto">
    {(['all', ...ORDER_BUCKETS] as const).map((status) => {
      const label = status === 'all' ? 'All' : status === 'order_ready' ? 'Ready' : ORDER_STATUS_META[status].label
      const count = status === 'all' ? orders.length : orders.filter((order) => order.status === status).length
      const active = status === 'all' ? ORDER_BUCKETS.every((bucket) => selected.includes(bucket)) : selected.length === 1 && selected.includes(status)
      return <button key={status} type="button" data-order-bucket={status} aria-pressed={active}
        aria-label={status === 'all' ? `Select all order buckets, ${count} open orders` : `${label}: ${count} orders, ${active ? 'selected' : 'not selected'}`}
        onClick={() => onChange(status === 'all' ? [...ORDER_BUCKETS] : [status])}
        style={orderPalette(status)}
        className={cn('flex w-[9rem] min-w-[6.5rem] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-2', orderBorder, orderText,
          active ? orderTint : 'bg-transparent hover:bg-[var(--order-bg)] dark:hover:bg-[var(--order-dark-bg)]')}>
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-medium">{active && <Check aria-hidden="true" className="size-3.5" />}{label}</span><span className="text-[18px] font-semibold tabular-nums leading-tight">{count}</span>
      </button>
    })}
  </div>
}

export function OrderViewControls({ value, onChange, includeOrders = false, floating = false }: { value: OrderView; onChange: (value: OrderView) => void; includeOrders?: boolean; floating?: boolean }) {
  const views = [...(includeOrders ? [{ id: 'order' as const, label: 'By order', Icon: List }] : []), { id: 'plant' as const, label: 'By plant', Icon: Layers }, { id: 'status' as const, label: 'By status', Icon: LayoutGrid }]
  return <div role="group" aria-label="Group order rows" className={cn('flex w-fit gap-1 rounded-xl border border-border bg-card p-1.5', floating && 'absolute bottom-3 left-1/2 -translate-x-1/2 shadow-lg')}>
    {views.map(({ id, label, Icon }) => <button key={id} type="button" aria-label={label} title={label} aria-pressed={value === id} onClick={() => onChange(id)} className={cn('flex size-9 cursor-pointer items-center justify-center rounded-lg border-none', value === id ? 'bg-foreground text-background' : 'bg-transparent text-muted-foreground hover:bg-lps-tint hover:text-foreground')}><Icon aria-hidden="true" className="size-5" /></button>)}
  </div>
}

type OrderItemEditor = (item: OrderItem, column: string, value: string) => Promise<void>

type OrderLine = { order: Order; item: OrderItem }
const orderLineStyle = (status: string): CSSProperties & { '--order-line-accent': string } => {
  const tone = itemPill(status === 'diff_size_qty_sub' ? 'alternative_proposed' : status, null, null).tone
  return { background: toneTint(tone), borderLeft: `3px solid ${toneDot(tone)}`, '--order-line-accent': toneDot(tone) }
}
const itemColors: Record<string, string> = {
  available: 'text-[#126B36] dark:text-[#79D99B]', need_to_order: 'text-[#075EA8] dark:text-[#7FC4FF]',
  arriving_soon: 'text-[#075EA8] dark:text-[#7FC4FF]', diff_size_qty_sub: 'text-[#7252BB] dark:text-[#BC9EFF]',
  unavailable: 'text-[#A42B32] dark:text-[#FFB2B9]', pending: 'text-muted-foreground',
}

function OrderItemStatus({ status, onChange }: { status: string; onChange?: (status: string) => void }) {
  if (onChange) return <select aria-label="Update plant status" className={`${field} h-8 max-w-40 py-0`} value={status} onChange={(event) => onChange(event.target.value)}>
    {ORDER_ITEM_STATUSES.map((value) => <option key={value} value={value}>{ORDER_ITEM_STATUS_LABELS[value]}</option>)}
  </select>
  return <span className={cn('inline-flex min-h-7 items-center rounded-full border border-current px-2.5 text-[12px] font-medium', itemColors[status] ?? 'text-muted-foreground')}>{ORDER_ITEM_STATUS_LABELS[status] ?? status}</span>
}

const supplierNoteFields = [
  { key: 'noteForSupplier', label: 'Note for supplier' },
  { key: 'noteFromSupplier', label: 'Note from supplier' },
] as const
const customerNoteFields = [
  { key: 'noteFromCustomer', label: 'Note from customer' },
  { key: 'noteForCustomer', label: 'Note for customer' },
] as const

function OrderLines({ lines, supplierId, showOrder = false, onStatusChange, onDelete, onPriceChange, onEdit }: { onEdit?: OrderItemEditor; lines: OrderLine[]; supplierId?: number; showOrder?: boolean; onStatusChange?: (item: OrderItem, status: string) => void; onDelete?: (item: OrderItem) => void; onPriceChange?: (item: OrderItem, price: string) => void }) {
  const cell = (item: OrderItem, column: string, value: string | number | null | undefined, numeric = false) => onEdit
    ? <EditableText table="order_items" id={item.id} column={column} value={value ?? null} numeric={numeric} className={column === 'name' ? 'whitespace-normal [overflow-wrap:anywhere]' : undefined} align={numeric ? 'right' : 'left'} touchTarget title={`Edit ${column.replaceAll('_', ' ')} for ${item.name}`} render={column === 'unit_price' ? money : numeric ? num : undefined} onCommit={(value) => onEdit(item, column, value)} onSaved={() => {}} />
    : <span>{column === 'unit_price' ? money(value) || '—' : numeric ? num(value) : value || '—'}</span>
  const noteCell = (item: OrderItem, key: 'noteForSupplier' | 'noteFromSupplier') => onEdit
    ? <EditableTextarea table="order_items" id={item.id} column={key === 'noteForSupplier' ? 'note_for_supplier' : 'note_from_supplier'} value={item[key]} placeholder="Add note…" editLabel={`${key === 'noteForSupplier' ? 'Note to supplier' : 'Note from supplier'} for ${item.name}`} compact onCommit={(value) => onEdit(item, key === 'noteForSupplier' ? 'note_for_supplier' : 'note_from_supplier', value)} onSaved={() => {}} />
    : <span className="block whitespace-pre-wrap px-1.5 text-[12px] text-muted-foreground [overflow-wrap:anywhere]">{item[key] || '—'}</span>
  const noteFields = supplierNoteFields
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

  if (supplierId != null) return <div className="min-w-0 space-y-2" aria-label="Order plants" data-testid={mobile ? "order-mobile-lines" : undefined}>
    {!mobile && <div className="overflow-x-auto"><table className="w-full min-w-[1000px] table-fixed border-separate border-spacing-y-2 text-left text-[12.5px]">
      <colgroup>
        {showOrder && <col style={{ width: 100 }} />}
        <col style={{ width: 64 }} /><col style={{ width: 90 }} /><col style={{ width: 220 }} />
        <col style={{ width: 170 }} /><col style={{ width: 112 }} /><col style={{ width: 112 }} /><col />
      </colgroup>
      <thead className="bg-secondary/60 text-[10.5px] text-muted-foreground"><tr>{showOrder && <th className="p-2">Order</th>}{['Qty', 'Size', 'Name', 'Status', 'Unit price', 'Line total', 'Note from supplier'].map((label) => <th key={label} className={cn('p-2', ['Qty', 'Unit price', 'Line total'].includes(label) && 'text-right')}>{label}</th>)}</tr></thead>
      <tbody>{lines.map(({ order, item }) => <tr key={`${order.id}:${item.id}`} className="bg-card align-top [&>td:first-child]:border-l-[3px] [&>td:first-child]:border-l-[var(--order-line-accent)]" style={orderLineStyle(item.status)}>
        {showOrder && <td className="p-3">{source(order)}</td>}
        <td className="rounded-l-xl border-y border-l border-border p-3 text-right tabular-nums">{num(item.quantity)}</td><td className="border-y border-border p-3">{item.size || '—'}</td>
        <td className="border-y border-border p-3 [overflow-wrap:anywhere]"><span className="font-semibold">{item.name}</span>{item.noteForSupplier && <p className="m-0 mt-1 whitespace-pre-wrap text-[12px] text-muted-foreground [overflow-wrap:anywhere]"><span className="font-semibold">Note for supplier: </span>{item.noteForSupplier}</p>}</td>
        <td className={cn('border-y border-border p-3', itemColors[item.status])}><OrderItemStatus status={item.status} onChange={onStatusChange ? (status) => onStatusChange(item, status) : undefined} /></td>
        <td className="border-y border-border p-3"><AnswerCell value={item.unitPrice == null ? '' : String(item.unitPrice)} display={money(item.unitPrice)} editable={!!onPriceChange} placeholder="—" ariaLabel={`Price for ${item.name}`} inputMode="decimal" align="right" plain onCommit={(price) => onPriceChange?.(item, price)} /></td>
        <td className="border-y border-border p-3 text-right tabular-nums">{money(item.total) || '—'}</td>
        <td className="rounded-r-xl border-y border-r border-border p-3 whitespace-pre-wrap [overflow-wrap:anywhere]">{item.noteFromSupplier || '—'}</td>
      </tr>)}</tbody>
    </table></div>}
    {mobile && lines.map(({ order, item }, index) => <article aria-label={`Line ${index + 1}, ${item.name}`} key={`${order.id}:${item.id}`} className="space-y-3 rounded-xl border border-border bg-card p-3" style={orderLineStyle(item.status)}>
      {showOrder && source(order)}
      <div><p className="m-0 font-semibold">{item.name}</p>{item.noteForSupplier && <p className="m-0 mt-1 whitespace-pre-wrap text-[12px] text-muted-foreground"><span className="font-semibold">Note for supplier: </span>{item.noteForSupplier}</p>}<p className="m-0 mt-1 text-[12px] text-muted-foreground">Qty {num(item.quantity)} · {item.size || '—'}</p></div>
      <OrderItemStatus status={item.status} onChange={onStatusChange ? (status) => onStatusChange(item, status) : undefined} />
      <label className="flex items-center justify-between gap-3 text-[12px]">Price<AnswerCell value={item.unitPrice == null ? '' : String(item.unitPrice)} display={money(item.unitPrice)} editable={!!onPriceChange} placeholder="—" ariaLabel={`Price for ${item.name}`} inputMode="decimal" align="right" touch onCommit={(price) => onPriceChange?.(item, price)} /></label>
      <div className="flex items-center justify-between gap-3 text-[12px]"><span>Line total</span><span className="tabular-nums">{money(item.total) || '—'}</span></div>
      <div className="text-[12px]"><span className="text-muted-foreground">Note from supplier</span><p className="m-0 whitespace-pre-wrap">{item.noteFromSupplier || '—'}</p></div>
    </article>)}
  </div>
  if (mobile) return <div className="min-w-0 space-y-3" data-testid="order-mobile-lines">
    {lines.map(({ order, item }, index) => <article key={`${order.id}:${item.id}`} aria-label={`Line ${index + 1}, ${item.name}`} className="min-w-0 overflow-hidden rounded-xl border border-border bg-card [overflow-wrap:anywhere]" style={orderLineStyle(item.status)}>
      <div className="min-w-0 border-b border-lps-hair px-1.5 py-1">
        {showOrder && <div className="mb-2 text-[12px]">{source(order)} <span className="text-muted-foreground">· {ORDER_STATUS_META[order.status].label}</span></div>}
        <p className="m-0 text-[15px] font-bold leading-5 text-foreground">{cell(item, 'name', item.name)}</p>
        <div className="mt-0.5 grid grid-cols-2 gap-2 text-[12px] text-muted-foreground"><label>Quantity{cell(item, 'quantity', item.quantity, true)}</label><label>Size{cell(item, 'size', item.size)}</label></div>
      </div>
      <dl className="m-0 grid min-w-0 grid-cols-2 gap-3 p-3">
        <div className="col-span-2 space-y-1"><dt className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">Status</dt><dd className="m-0"><OrderItemStatus status={item.status} onChange={onStatusChange ? (status) => onStatusChange(item, status) : undefined} /></dd></div>
        <div className="space-y-1"><dt className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">Unit price</dt><dd className="m-0 text-[13px] tabular-nums">{cell(item, 'unit_price', item.unitPrice, true)}</dd></div>
        <div className="space-y-1"><dt className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">Total</dt><dd className="m-0 text-[13px] tabular-nums">{money(item.total) || '—'}</dd></div>
        <div className="col-span-2 flex items-end justify-between gap-2 space-y-1"><div className="space-y-2">{noteFields.map(({ key, label }) => <div key={key}><dt className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">{label}</dt><dd className="m-0 whitespace-pre-wrap text-[13px]">{noteCell(item, key)}</dd></div>)}</div>{onDelete && <button type="button" aria-label={`Delete ${item.name} from order`} title="Delete order row" onClick={() => onDelete(item)} className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={16} /></button>}</div>
      </dl>
    </article>)}
  </div>
  return <div className="overflow-x-auto border-y border-border bg-card">
    <table className="w-full min-w-[1100px] table-fixed text-left text-[12.5px]">
      <colgroup>
        {showOrder && <col style={{ width: 120 }} />}
        <col style={{ width: 80 }} /><col style={{ width: 96 }} /><col style={{ width: 220 }} />
        <col style={{ width: 170 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} />
        {noteFields.map(({ key }) => <col key={key} />)}
        {onDelete && <col style={{ width: 48 }} />}
      </colgroup>
      <thead className="border-b border-border bg-lps-headrow text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground"><tr>{showOrder && <th className="px-1.5 py-1">Order</th>}<th className="px-1.5 py-1 text-right">Quantity</th><th className="px-1.5 py-1">Size</th><th className="px-1.5 py-1">Plant name</th><th className="px-1.5 py-1">Status</th><th className="px-1.5 py-1 text-right">Unit price</th><th className="px-1.5 py-1 text-right">Total</th><>{noteFields.map(({ key, label }) => <th key={key} className="px-1.5 py-1">{label}</th>)}</>{onDelete && <th className="w-12" aria-label="Actions" />}</tr></thead>
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

function OrderRequestLinks({ order, supplierId }: { order: Order; supplierId?: number }) {
  return order.availabilityRequestIds.length > 0 && <nav aria-label="Order availability requests" className="flex flex-wrap items-center gap-2 text-[12px]">
    <span className="text-muted-foreground">Availability requests:</span>{order.availabilityRequestIds.map((id) => <Link key={id} href={supplierId != null ? `/partner/${supplierId}/requests/${id}` : `/suppliers/${order.supplierId}?tab=requests&ar=${id}`} className="font-medium text-primary underline underline-offset-2">{order.availabilityRequestNames?.[id] || `AR-${id}`}</Link>)}
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
    <p className="text-[11px]">Availability requests: {order.availabilityRequestIds.map((id) => order.availabilityRequestNames?.[id] || `AR-${id}`).join(', ') || '—'}</p>
    <table className="mt-3 w-full border-collapse text-left text-[11px] [&_td]:border [&_td]:border-neutral-400 [&_td]:p-2 [&_th]:border [&_th]:border-neutral-400 [&_th]:p-2">
      <thead><tr>{['Plant / size', 'Quantity', 'Status', 'Unit price', 'Total', 'Note for supplier', 'Note from supplier'].map((label) => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{order.items.map((item) => <tr key={item.id} style={{ breakInside: 'avoid' }}><td>{item.name}{item.size ? ` · ${item.size}` : ''}</td><td>{num(item.quantity)}</td><td>{ORDER_ITEM_STATUS_LABELS[item.status] ?? item.status}</td><td>{money(item.unitPrice) || '—'}</td><td>{money(item.total) || '—'}</td><td className="whitespace-pre-wrap">{item.noteForSupplier}</td><td className="whitespace-pre-wrap">{item.noteFromSupplier}</td></tr>)}</tbody>
      <tfoot><tr><td colSpan={7}>{orderRecordName(order)} · Subtotal {money(orderSubtotal(order)) || '—'}</td></tr></tfoot>
    </table>
  </div>, node)
}

function OrderConfirmation({ order, busy, error, onClose, onSave }: { order: Order; busy: boolean; error: string | null; onClose: () => void; onSave: (body: object) => Promise<boolean> }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [date, setDate] = useState(order.fulfillmentDate ?? '')
  const [note, setNote] = useState(order.noteFromSupplier ?? '')
  const confirming = order.status === 'new'
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    return () => trigger?.focus()
  }, [])
  return createPortal(<dialog ref={dialog} aria-labelledby={titleId} aria-busy={busy} onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
    className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-[420px] overflow-y-auto rounded-2xl border border-border bg-popover p-4 text-foreground shadow-[var(--lps-shadow)] backdrop:bg-black/40">
    <form className="flex flex-col gap-4" onSubmit={async (event) => {
      event.preventDefault()
      if (busy || !date) return
      if (await onSave({ ...(confirming ? { status: 'processing' } : {}), fulfillmentDate: date, noteFromSupplier: note })) onClose()
    }}>
      <h2 id={titleId} className="m-0 text-[17px] font-semibold">{confirming ? 'Acknowledge Received' : 'Fulfillment details'} · {orderRecordName(order)}</h2>
      <div className="space-y-1"><span className="block text-[11px] text-muted-foreground">Customer request</span><ARJobSchedules schedules={order.jobSchedules} showFulfillmentMethod={false} /></div>
      <label className="flex flex-col gap-1 text-[12px] font-semibold">Fulfillment date<input aria-label={`Fulfillment date for ${orderRecordName(order)}`} required type="date" className={`${field} w-full min-w-0`} value={date} disabled={busy} onChange={(event) => setDate(event.target.value)} /></label>
      <label className="flex flex-col gap-1 text-[12px] font-semibold">Note for this order<textarea aria-label="Note for this order" className="min-h-24 rounded-md border border-input bg-background p-2 text-[13px] font-normal" rows={3} maxLength={10000} value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} placeholder="Timing or other order details…" /></label>
      {confirming && <p className="m-0 text-[12px] text-muted-foreground">Set your fulfillment date to move this order to Processing.</p>}
      {error && <p role="alert" className="m-0 text-[12px] text-destructive">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" className={button} disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className={primary} disabled={busy || !date}>{busy ? 'Saving…' : confirming ? 'Acknowledge Received' : 'Save details'}</button></div>
    </form>
  </dialog>, document.body)
}

/** Match availability answers: selecting a status opens a deliberate save step. */
function OrderItemStatusDialog({ order, item, initialStatus, busy, error, onClose, onSave }: {
  order: Order; item: OrderItem; initialStatus: string; busy: boolean; error: string | null
  onClose: () => void; onSave: (status: string, note: string) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [status, setStatus] = useState(initialStatus)
  const [note, setNote] = useState('')
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    return () => trigger?.focus()
  }, [])
  return createPortal(<dialog ref={dialog} aria-labelledby={titleId} aria-busy={busy} onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
    className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-[420px] overflow-y-auto rounded-2xl border border-border bg-popover p-4 text-foreground shadow-[var(--lps-shadow)] backdrop:bg-black/40">
    <form className="flex flex-col gap-4" onSubmit={async (event) => {
      event.preventDefault()
      if (!busy) { onSave(status, note); onClose() }
    }}>
      <h2 id={titleId} className="m-0 text-[17px] font-semibold">Update plant status · {orderRecordName(order)}</h2>
      <p className="m-0 text-[13px] text-muted-foreground">{item.name}{item.size ? ` · ${item.size}` : ''}</p>
      <label className="flex flex-col gap-1 text-[12px] font-semibold">Status
        <select aria-label={`Plant status for ${item.name}`} className={`${field} w-full`} value={status} disabled={busy} onChange={(event) => setStatus(event.target.value)}>
          {ORDER_ITEM_STATUSES.map((value) => <option key={value} value={value}>{ORDER_ITEM_STATUS_LABELS[value]}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[12px] font-semibold">Details for Rosie
        <textarea aria-label={`Status details for ${item.name}`} value={note} onChange={(event) => setNote(event.target.value)} maxLength={10000} rows={3}
          placeholder={status === 'unavailable' ? 'Why is this unavailable?' : status === 'diff_size_qty_sub' ? 'Describe the size, quantity, or substitute.' : 'ETA, pricing, conditions, or other details…'} className="min-h-20 rounded-md border border-input bg-background p-2 text-[13px] font-normal" />
      </label>
      <p className="m-0 text-[12px] text-muted-foreground">This is staged until you save all order status changes.</p>
      {error && <p role="alert" className="m-0 text-[12px] text-destructive">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" className={button} disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className={primary} disabled={busy}>{busy ? 'Saving…' : 'Save status'}</button></div>
    </form>
  </dialog>, document.body)
}

/** Admin and supplier views share the same guarded lifecycle controls. */
export function OrderCard({ order, supplierId, canEdit = false, canEditFulfillmentMethod = false, onChanged }: { order: Order; supplierId?: number; canEdit?: boolean; canEditFulfillmentMethod?: boolean; onChanged?: () => void | Promise<void> }) {
  const [expanded, setExpanded] = useState(false)
  const contentId = useId()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [statusUpdate, setStatusUpdate] = useState<{ item: OrderItem; status: string } | null>(null)
  const [stagedStatuses, setStagedStatuses] = useState<Record<number, { item: OrderItem; status: string; note: string }>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const closed = order.closed === true || order.status === 'closed_won' || order.status === 'closed_lost'
  const editable = canEdit && !closed

  async function write(body: object) {
    if (!editable || busy) return false
    setBusy(true); setError(null)
    try {
      const url = supplierId != null ? `/api/partner/${supplierId}/orders/${order.id}` : `/api/orders/${order.id}`
      const res = await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const result = await res.json() as { error?: string }
      if (!res.ok) throw new Error(result.error ?? 'Could not update order')
      await onChanged?.()
      return true
    } catch (error) { setError((error as Error).message); return false }
    finally { setBusy(false) }
  }

  async function editItem(item: OrderItem, column: string, value: string) {
    const response = await fetch(`/api/orders/${order.id}/items/${item.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ column, value }),
    })
    const result = await response.json() as { error?: string }
    if (!response.ok) throw new Error(result.error ?? 'Could not save order item')
    await onChanged?.()
  }

  async function writeItemStatus(item: OrderItem, status: string) {
    if (!editable || busy) return false
    setBusy(true); setError(null)
    try {
      const url = supplierId != null
        ? `/api/partner/${supplierId}/orders/${order.id}/items/${item.id}`
        : `/api/orders/${order.id}/items/${item.id}`
      const res = await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) })
      const body = await res.json() as { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Could not update plant status')
      await onChanged?.()
      return true
    } catch (error) { setError((error as Error).message); return false } finally { setBusy(false) }
  }

  async function writeItemPrice(item: OrderItem, value: string) {
    const price = value.trim() === '' ? null : Number(value)
    if (price !== null && (!Number.isFinite(price) || price <= 0 || price >= 100000000 || Math.abs(price * 100 - Math.round(price * 100)) > 0.000001)) {
      setError('Enter a positive price with at most two decimal places.'); return
    }
    if (!editable || busy || price === item.unitPrice) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/partner/${supplierId}/orders/${order.id}/items/${item.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ unitPrice: price }) })
      const body = await res.json() as { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Could not save price')
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
    try {
      for (const change of changes) if (!(await writeItemStatus(change.item, change.status))) return
      const url = supplierId != null ? `/api/partner/${supplierId}/orders/${order.id}/status-notification` : null
      if (url) {
        const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ changes: changes.map(({ item, status, note }) => ({ itemId: item.id, status, note })) }) })
        const body = await res.json() as { error?: string }; if (!res.ok) throw new Error(body.error ?? 'Could not notify Rosie')
      }
      setStagedStatuses({})
    } catch (error) { setError((error as Error).message) }
  }

  // Confirming a supplier order belongs in the supplier portal. Chris's job
  // cards remain a compact view/control surface for arrangement and tracking.
  const actions = editable && (order.status === 'new'
    ? supplierId != null && <button type="button" className={cn(primary, 'min-h-11 flex-none print:hidden')} disabled={busy} onClick={() => { setError(null); setConfirmOpen(true) }}>Acknowledge Received</button>
    : <><button type="button" className={button} disabled={busy} onClick={() => { setError(null); setConfirmOpen(true) }}>Edit fulfillment details</button>{order.status === 'processing' && <button type="button" className={cn(primary, 'min-h-11', supplierId != null && 'min-h-12 flex-1 text-[15px] min-[900px]:max-w-sm')} disabled={busy || !order.fulfillmentDate} onClick={() => void write({ status: 'order_ready' })}>{busy ? 'Saving…' : 'Mark as Ready'}</button>}</>)

  const fulfillmentChange = editable && canEditFulfillmentMethod ? (method: FulfillmentMethod | null) => void write({ fulfillmentMethod: method }) : undefined

  if (supplierId != null) return <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pb-5 pl-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] md:px-4 [&>*]:shrink-0">
      {error && !confirmOpen && <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">{error}</div>}
      <PartnerDetailHeader name={order.jobNames?.join(' · ') || orderRecordName(order)} status={<OrderStatusPill status={order.status} />} schedule={<OrderFulfillment order={order} />}
        contacts={order.customerDetails ?? []} note={order.noteForSupplier}>
        <OrderRequestLinks order={order} supplierId={supplierId} />
        {!canEdit && !closed && <p className="m-0 text-[12px] text-muted-foreground">This account has read-only access to this order.</p>}
        {order.confirmationDate && <p className="m-0 text-[11px] text-muted-foreground">Acknowledged: {formatWeekdayMonthDay(order.confirmationDate)}</p>}
      </PartnerDetailHeader>
      <OrderPrintSheet order={order} />
      <OrderSummary order={order} />
      <OrderLines lines={order.items.map((item) => ({ order, item: stagedStatuses[item.id] ? { ...item, status: stagedStatuses[item.id].status } : item }))} supplierId={supplierId} onStatusChange={editable ? requestItemStatus : undefined} onPriceChange={editable && !busy ? writeItemPrice : undefined} />
      {order.noteFromSupplier && <section aria-label="Note from supplier" className="space-y-2 rounded-xl border border-border bg-card p-4"><h2 className="m-0 text-[13px] font-semibold">Note for this order</h2><p className="m-0 whitespace-pre-wrap text-[13px] [overflow-wrap:anywhere]">{order.noteFromSupplier}</p></section>}
      {closed && <p className="m-0 text-[12px] text-muted-foreground">This order is closed.</p>}
    </div>
    {editable && <footer aria-label="Order actions" className="flex flex-none flex-wrap items-center gap-3 border-t border-border bg-card px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] md:px-4 print:hidden">
      {actions}
    </footer>}
    {editable && Object.keys(stagedStatuses).length > 0 && <footer aria-label="Save order status changes" className="flex flex-none items-center gap-3 border-t border-border bg-card px-3 py-3 md:px-4 print:hidden"><button type="button" className={cn(primary, 'min-h-12 flex-1 text-[15px] min-[900px]:max-w-sm')} disabled={busy} onClick={() => void saveStagedStatuses()}>{busy ? 'Saving…' : `Save ${Object.keys(stagedStatuses).length} status change${Object.keys(stagedStatuses).length === 1 ? '' : 's'}`}</button><span className="text-[11.5px] text-muted-foreground">Sends one update to Rosie.</span></footer>}
    {editable && confirmOpen && <OrderConfirmation order={order} busy={busy} error={error} onClose={() => setConfirmOpen(false)} onSave={write} />}
    {editable && statusUpdate && <OrderItemStatusDialog order={order} item={statusUpdate.item} initialStatus={statusUpdate.status} busy={busy} error={error}
      onClose={() => setStatusUpdate(null)} onSave={(status, note) => setStagedStatuses((current) => ({ ...current, [statusUpdate.item.id]: { item: statusUpdate.item, status, note } }))} />}
  </div>

  return <article aria-label={`Order ${orderRecordName(order)}`} className="flex-none overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
    <header className="flex flex-col gap-1.5 px-3.5 py-2.5 hover:bg-lps-tint">
      <div className="flex min-w-0 items-start gap-2.5">
        <button type="button" aria-expanded={expanded} aria-controls={contentId} aria-label={`${expanded ? 'Collapse' : 'Expand'} order ${orderRecordName(order)}`} onClick={() => setExpanded((value) => !value)} className="flex size-6 flex-none cursor-pointer items-center justify-center self-center rounded-md border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><ChevronDown aria-hidden="true" size={14} className={expanded ? '' : '-rotate-90'} /></button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
            <OrderStatusPill status={order.status} />
            <span className="min-w-0 truncate text-[12.5px] font-semibold text-primary">{orderRecordName(order)}</span>
            <div className="ml-auto flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <OrderMetadata order={order} onFulfillmentChange={fulfillmentChange} busy={busy} />
            </div>
          </div>
        </div>
        <div className="flex flex-none items-center self-center">
          <CopyOrderMenu order={order} canShare={canEdit} closed={closed} onChanged={onChanged} />
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex max-w-full items-stretch overflow-hidden rounded-xl border border-lps-edge bg-card text-[10.5px] font-semibold">
          <Link href={`/suppliers/${order.supplierId}`} className="flex min-h-8 min-w-0 items-center px-2 py-0.5 text-foreground hover:text-primary hover:underline">{order.supplierName}</Link>
          {order.noteFromSupplier && <span title={order.noteFromSupplier} className="flex min-w-0 max-w-64 items-center border-l border-lps-hair px-2 py-0.5 font-normal"><span className="truncate">{order.noteFromSupplier}</span></span>}
        </span>
        <span>Fulfillment: <span className="font-semibold text-foreground">{formatWeekdayMonthDay(order.fulfillmentDate) || 'To be confirmed'}</span></span>
        {order.confirmationDate && <span>Acknowledged: {formatWeekdayMonthDay(order.confirmationDate)}</span>}
        <div className="ml-auto"><OrderRequestLinks order={order} /></div>
        <div className="ml-auto flex shrink-0 items-baseline gap-2 whitespace-nowrap">
          <span className="text-[14px] text-muted-foreground">{order.items.length} {order.items.length === 1 ? 'item' : 'items'}</span>
          <span aria-hidden="true">:</span>
          <span className="text-[24px] font-semibold leading-tight tabular-nums text-foreground">{money(orderSubtotal(order)) || '—'}</span>
        </div>
      </div>
    </header>
    {error && !confirmOpen && <p role="alert" className="mx-3.5 mt-2 text-[12px] text-destructive">{error}</p>}
    <div id={contentId} hidden={!expanded} className="space-y-3 border-t border-border">
      {editable && <div className="flex flex-wrap items-center gap-2 bg-lps-tint px-3.5 py-2">{actions}{Object.keys(stagedStatuses).length > 0 && <button type="button" className={primary} disabled={busy} onClick={() => void saveStagedStatuses()}>{busy ? 'Saving…' : 'Save status changes'}</button>}</div>}
      {[...supplierNoteFields, ...customerNoteFields].map(({ key, label }) => order[key] && <div key={key} className="px-3.5"><h4 className="text-[12px] font-semibold">{label}</h4><p className="whitespace-pre-wrap text-[12px] text-muted-foreground [overflow-wrap:anywhere]">{order[key]}</p></div>)}
      <OrderLines lines={order.items.map((item) => ({ order, item: stagedStatuses[item.id] ? { ...item, status: stagedStatuses[item.id].status } : item }))} onEdit={editable ? editItem : undefined} onStatusChange={editable ? requestItemStatus : undefined} />
    </div>
    {editable && confirmOpen && <OrderConfirmation order={order} busy={busy} error={error} onClose={() => setConfirmOpen(false)} onSave={write} />}
    {editable && statusUpdate && <OrderItemStatusDialog order={order} item={statusUpdate.item} initialStatus={statusUpdate.status} busy={busy} error={error}
      onClose={() => setStatusUpdate(null)} onSave={(status, note) => setStagedStatuses((current) => ({ ...current, [statusUpdate.item.id]: { item: statusUpdate.item, status, note } }))} />}
  </article>
}

interface JobChoice { id: number; name: string | null; fulfillment_method?: FulfillmentMethod | null }
interface OrdersPayload { orders: Order[]; candidates: OrderCandidate[]; directCandidates: DirectOrderCandidate[]; suppliers: { id: number; name: string }[]; jobs: JobChoice[]; error?: string }
const allocationKey = (candidateId: number, jobItemId: number) => `${candidateId}:${jobItemId}`

/** Create one supplier order from all or part of one or several customer jobs. */
export function JobOrders({ jobRequestId, onChanged, version = 0 }: { jobRequestId: number; onChanged?: () => void; version?: number }) {
  const [data, setData] = useState<OrdersPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState(false)
  const [extraJobs, setExtraJobs] = useState<number[]>([])
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [confirmed, setConfirmed] = useState(false)
  const [method, setMethod] = useState<FulfillmentMethod | ''>('')
  const [noteForSupplier, setNoteForSupplier] = useState('')
  const [noteFromCustomer, setNoteFromCustomer] = useState('')
  const [noteForCustomer, setNoteForCustomer] = useState('')
  const [createdId, setCreatedId] = useState<number | null>(null)
  const revision = useRef(0)
  const initializedJob = useRef<number | null>(null)
  const extra = extraJobs.join(',')

  const load = useCallback(async () => {
    const version = ++revision.current
    setLoading(true)
    try {
      const res = await fetch(`/api/orders?job=${jobRequestId}${extra ? `&jobs=${extra}` : ''}`, { cache: 'no-store' })
      const body = await res.json() as OrdersPayload
      if (!res.ok) throw new Error(body.error ?? 'Could not load orders')
      if (version !== revision.current) return
      setData(body)
      setError(null)
      setSupplierId((current) => body.candidates.some((candidate) => candidate.supplierId === current) || body.suppliers?.some((supplier) => supplier.id === current) ? current
        : body.candidates.find((candidate) => isApsSupplier(candidate.supplierName))?.supplierId ?? body.candidates[0]?.supplierId
          ?? body.suppliers?.find((supplier) => isApsSupplier(supplier.name))?.id ?? body.suppliers?.[0]?.id ?? null)
      if (initializedJob.current !== jobRequestId) {
        setMethod(body.jobs.find((job) => job.id === jobRequestId)?.fulfillment_method ?? '')
        initializedJob.current = jobRequestId
      }
    } catch (error) { if (version === revision.current) setError((error as Error).message) }
    finally { if (version === revision.current) setLoading(false) }
  }, [jobRequestId, extra])

  useEffect(() => { void load(); return () => { revision.current += 1 } }, [load, version])
  useEffect(() => { setQuantities({}); setConfirmed(false); setExtraJobs([]); setCreatedId(null) }, [jobRequestId])

  const candidates = (data?.candidates ?? []).filter((candidate) => candidate.supplierId === supplierId)
  const directCandidates = data?.directCandidates ?? []
  const useDirect = candidates.length === 0 && directCandidates.length > 0
  const suppliers = candidates.length ? [...new Map((data?.candidates ?? []).map((candidate) => [candidate.supplierId, candidate.supplierName])).entries()] : (data?.suppliers ?? []).map((supplier) => [supplier.id, supplier.name] as const)
  const selectedItems = candidates.flatMap((candidate) => {
    const allocations = candidate.allocations.flatMap((allocation) => {
      const value = quantities[allocationKey(candidate.availabilityRequestItemId, allocation.jobRequestItemId)]
      return value !== undefined ? [{ jobRequestItemId: allocation.jobRequestItemId, quantity: Number(value) }] : []
    })
    return allocations.length ? [{ availabilityRequestItemId: candidate.availabilityRequestItemId, allocations }] : []
  })
  const selectedDirectItems = directCandidates.flatMap((candidate) => {
    const raw = quantities[`direct:${candidate.jobRequestItemId}`]
    return raw !== undefined ? [{ jobRequestItemId: candidate.jobRequestItemId, quantity: Number(raw) }] : []
  })
  const invalidQuantity = candidates.some((candidate) => {
    const values = candidate.allocations.map((allocation) => ({ allocation, raw: quantities[allocationKey(candidate.availabilityRequestItemId, allocation.jobRequestItemId)] })).filter(({ raw }) => raw !== undefined)
    return values.some(({ allocation, raw }) => !Number.isFinite(Number(raw)) || Number(raw) <= 0 || Number(raw) > allocation.remainingQuantity)
      || values.reduce((sum, { raw }) => sum + Number(raw), 0) > candidate.remainingQuantity
  })
    || directCandidates.some((candidate) => {
      const raw = quantities[`direct:${candidate.jobRequestItemId}`]
      return raw !== undefined && (!Number.isFinite(Number(raw)) || Number(raw) <= 0 || Number(raw) > candidate.remainingQuantity)
    })

  async function create() {
    setCreating(true); setError(null)
    try {
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ supplierId, customerConfirmed: confirmed, fulfillmentMethod: method || null, noteForSupplier: noteForSupplier || null, noteFromCustomer: noteFromCustomer || null, noteForCustomer: noteForCustomer || null, items: useDirect ? selectedDirectItems : selectedItems }) })
      const body = await res.json() as { id: number; error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Could not create order')
      setCreatedId(body.id); setQuantities({}); setConfirmed(false); setOpen(false); setNoteForSupplier(''); setNoteFromCustomer(''); setNoteForCustomer('')
      await load(); onChanged?.()
    } catch (error) { setError((error as Error).message) }
    finally { setCreating(false) }
  }

  return <section className="flex flex-col gap-3 p-3" aria-label="Job orders">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[12px] text-muted-foreground">{data?.orders.length ?? 0} orders · Combine jobs or split quantities into separate supplier orders.</p><div className="flex gap-2"><button type="button" className={button} onClick={() => setOpen(!open)}>{open ? 'Cancel new order' : 'Create order'}</button>{!open && <button type="button" className={button} onClick={() => setOpen(true)}>New row</button>}</div></div>
    {error && <p role="alert" className="text-[12px] text-destructive">{error}</p>}
    {createdId && <p role="status" className="text-[12px] font-medium">Order created. Its status is New, awaiting partner confirmation.</p>}
    {open && <form className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3" onSubmit={(event) => { event.preventDefault(); void create() }}>
      <h3 className="text-[13px] font-bold">Create supplier order</h3>
      <div className="flex flex-wrap items-center gap-2"><span className="text-[12px]">JR-{jobRequestId}</span>
        {extraJobs.map((id) => <button key={id} type="button" className={button} onClick={() => { setExtraJobs(extraJobs.filter((job) => job !== id)); setConfirmed(false) }}>JR-{id} · Remove</button>)}
        <select aria-label="Add another job to this order" className={`${field} max-w-full`} value="" onChange={(event) => { if (event.target.value) setExtraJobs([...extraJobs, Number(event.target.value)]); setConfirmed(false) }}>
          <option value="">Add another job…</option>{data?.jobs.filter((job) => job.id !== jobRequestId && !extraJobs.includes(job.id)).map((job) => <option key={job.id} value={job.id}>JR-{job.id}{job.name ? ` · ${job.name}` : ''}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">Supplier<select className={field} value={supplierId ?? ''} onChange={(event) => { setSupplierId(Number(event.target.value)); setConfirmed(false) }}><option value="" disabled>Select supplier</option>{suppliers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">Pickup / delivery<select className={field} value={method} onChange={(event) => setMethod(event.target.value as FulfillmentMethod | '')}><option value="">To be arranged</option><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select></label>
      </div>
      {loading ? <p className="text-[12px] text-muted-foreground">Loading available quantities…</p> : useDirect ? <div className="flex flex-col divide-y divide-border">
        <p className="py-2 text-[12px] text-muted-foreground">No availability request is required for these quoted lines. This order will commit the selected job.</p>
        {directCandidates.map((candidate) => {
          const key = `direct:${candidate.jobRequestItemId}`; const checked = quantities[key] !== undefined
          return <div key={key} className="py-2"><div className="flex flex-wrap gap-x-2 text-[12px]"><span className="font-semibold">{candidate.name}</span><span>{candidate.size}</span><span className="text-muted-foreground">JR-{candidate.jobRequestId} · {num(candidate.remainingQuantity)} remaining · {money(candidate.unitPrice) || 'Price pending'}</span></div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]"><label className="flex min-h-9 items-center gap-2"><input type="checkbox" aria-label={`Select ${candidate.name} for direct order`} checked={checked} onChange={(event) => { setQuantities((current) => { const next = { ...current }; if (event.target.checked) next[key] = String(candidate.remainingQuantity); else delete next[key]; return next }); setConfirmed(false) }} />Order quoted line</label><input aria-label={`Order quantity for ${candidate.name}`} type="number" min="0.001" step="any" max={candidate.remainingQuantity} disabled={!checked} className={`${field} w-24`} value={checked ? quantities[key] : ''} onChange={(event) => { setQuantities({ ...quantities, [key]: event.target.value }); setConfirmed(false) }} /><span className="text-[11px] text-muted-foreground">of {num(candidate.remainingQuantity)}</span></div>
          </div>
        })}
      </div> : candidates.length === 0 ? <p className="text-[12px] text-muted-foreground">No remaining quoted or supplier-response lines to order.</p> : <div className="flex flex-col divide-y divide-border">
        {candidates.map((candidate) => <div key={candidate.availabilityRequestItemId} className="py-2">
          <div className="flex flex-wrap gap-x-2 text-[12px]"><span className="font-semibold">{candidate.name}</span><span>{candidate.size}</span><span className="text-muted-foreground">{candidate.availabilityRequestName || `AR-${candidate.availabilityRequestId}`} · {arResponseLabel(candidate.status)} · {num(candidate.remainingQuantity)} remaining · {money(candidate.unitPrice) || 'Price pending'}</span></div>
          {candidate.allocations.map((allocation) => {
            const key = allocationKey(candidate.availabilityRequestItemId, allocation.jobRequestItemId)
            const checked = quantities[key] !== undefined
            const label = `Select ${candidate.name} for JR-${allocation.jobRequestId}`
            return <div key={key} className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
              <label className="flex min-h-9 items-center gap-2"><input type="checkbox" aria-label={label} checked={checked} onChange={(event) => {
                setQuantities((current) => {
                  const next = { ...current }
                  if (event.target.checked) {
                    const other = candidate.allocations.reduce((sum, otherAllocation) => sum + Number(current[allocationKey(candidate.availabilityRequestItemId, otherAllocation.jobRequestItemId)] ?? 0), 0)
                    next[key] = String(Math.max(0, Math.min(allocation.remainingQuantity, candidate.remainingQuantity - other)))
                  } else delete next[key]
                  return next
                }); setConfirmed(false)
              }} />JR-{allocation.jobRequestId}{allocation.jobName ? ` · ${allocation.jobName}` : ''}</label>
              <input aria-label={`Order quantity for ${candidate.name}, JR-${allocation.jobRequestId}`} type="number" min="0.001" step="any" max={allocation.remainingQuantity} disabled={!checked} className={`${field} w-24`} value={checked ? quantities[key] : ''} onChange={(event) => { setQuantities({ ...quantities, [key]: event.target.value }); setConfirmed(false) }} />
              <span className="text-[11px] text-muted-foreground">of {num(allocation.remainingQuantity)}</span>
            </div>
          })}
        </div>)}
      </div>}
      {invalidQuantity && <p role="alert" className="text-[12px] text-destructive">Enter positive quantities within the job and supplier quantities remaining.</p>}
      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">Note for supplier<textarea className="min-h-16 rounded-md border border-input bg-background p-2 text-[12px]" value={noteForSupplier} onChange={(event) => setNoteForSupplier(event.target.value)} /></label>
      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">Note from customer<textarea className="min-h-16 rounded-md border border-input bg-background p-2 text-[12px]" value={noteFromCustomer} onChange={(event) => setNoteFromCustomer(event.target.value)} /></label>
      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">Note for customer<textarea className="min-h-16 rounded-md border border-input bg-background p-2 text-[12px]" value={noteForCustomer} onChange={(event) => setNoteForCustomer(event.target.value)} /></label>
      <label className="flex items-start gap-2 text-[12px]"><input className="mt-0.5" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />Customer has confirmed the selected quantities for every included job.</label>
      <div className="flex justify-end"><button type="submit" className={primary} disabled={creating || loading || !confirmed || !(useDirect ? selectedDirectItems : selectedItems).length || invalidQuantity}>{creating ? 'Creating…' : 'Create new order'}</button></div>
    </form>}
    {loading && !data && <p className="py-6 text-center text-[12px] text-muted-foreground">Loading orders…</p>}
    {!loading && data?.orders.length === 0 && !open && <p className="py-6 text-center text-[12px] text-muted-foreground">No orders yet. Create an order once the customer confirms.</p>}
    {data?.orders.map((order) => <OrderCard key={order.id} order={order} canEdit canEditFulfillmentMethod onChanged={async () => { await load(); onChanged?.() }} />)}
  </section>
}
