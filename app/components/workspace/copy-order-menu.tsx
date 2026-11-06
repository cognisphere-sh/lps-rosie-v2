'use client'

import { Check, ChevronDown, Copy, LoaderCircle } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CopyButton } from '@/components/workspace/copy-button'

import { orderShareContent } from '@/lib/order-share'
import { orderRecordName, type Order } from '@/lib/orders'
import { errorCopy } from '@/lib/error-copy'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/workspace/frame'

const FORMATS = [{ label: 'Copy HTML', kind: 'html' }, { label: 'Copy text', kind: 'text' }, { label: 'Copy link', kind: 'link' }] as const
const menuItem = 'flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-foreground outline-none hover:bg-muted focus-visible:bg-muted disabled:opacity-60'

export function CopyOrderMenu({ order, canShare, closed, supplierId, onPublicToken, onChanged, onPrint }: {
  order: Order; canShare: boolean; closed: boolean; onChanged?: () => void | Promise<void>
  supplierId?: number; onPublicToken?: (token: string | null) => void
  /** Print prints the supplier portal's order sheet (2026-10-21). */
  onPrint?: () => void
}) {
  const toast = useToast()
  const [token, setToken] = useState(order.publicToken ?? null)
  useEffect(() => setToken(order.publicToken ?? null), [order.id, order.publicToken])
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [copying, setCopying] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number; maxHeight: number; upwards: boolean } | null>(null)
  const menuId = useId()

  useLayoutEffect(() => {
    if (!open) { setPosition(null); return }
    const rect = root.current!.getBoundingClientRect()
    const height = menu.current?.offsetHeight || 200
    const below = window.innerHeight - rect.bottom - 12
    const above = rect.top - 12
    const upwards = below < height && above > below
    const maxHeight = Math.max(0, upwards ? above : below)
    setPosition({
      top: upwards ? rect.top - Math.min(height, maxHeight) - 4 : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.right - 224, window.innerWidth - 232)),
      maxHeight,
      upwards,
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false)
    }
    const close = (event: Event) => {
      if (!(event.target instanceof Node) || !menu.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(null), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  function finish() {
    setOpen(false)
    root.current?.querySelector('button')?.focus()
  }

  async function setPublic(isPublic: boolean) {
    if (!canShare || closed || copying != null || isPublic === (token != null)) return
    setCopying(isPublic ? 'Public' : 'Private')
    setMessage('')
    setFailed(false)
    try {
      const response = await fetch(supplierId == null ? `/api/orders/${order.id}` : `/api/partner/${supplierId}/orders/${order.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Could not update order sharing')
      if (isPublic && (typeof body.publicToken !== 'string' || !body.publicToken)) throw new Error('Could not create public link. Please try again.')
      const nextToken = body.publicToken ?? null
      setToken(nextToken)
      onPublicToken?.(nextToken)
      void onChanged?.()
      setMessage(isPublic ? 'Order is public' : 'Order is private. Previous link revoked.')
      toast(isPublic ? 'Order is public' : 'Order is private. Previous link revoked.')
    } catch (error) {
      setFailed(true)
      setMessage(errorCopy(error, 'Could not update order sharing'))
      toast(errorCopy(error, 'Could not update order sharing'), 'error')
    } finally {
      setCopying(null)
    }
  }

  async function copy(format: (typeof FORMATS)[number]) {
    setCopying(format.label)
    setMessage('')
    setFailed(false)
    try {
      const quote = orderShareContent({ ...order, publicToken: token }, window.location.origin, token && !closed ? 'public' : 'private')
      if (format.kind === 'link') {
        await navigator.clipboard.writeText(quote.url)
      } else if (format.kind === 'text') {
        await navigator.clipboard.writeText(quote.text)
      } else if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([quote.html], { type: 'text/html' }),
          'text/plain': new Blob([quote.text], { type: 'text/plain' }),
        })])
      } else {
        await navigator.clipboard.writeText(quote.html)
      }
      setMessage('Order copied')
      setCopied(format.label)
      finish()
      toast(format.kind === 'link' ? `${token && !closed ? 'Public' : 'Private'} link copied`
        : `${token && !closed ? 'Public' : 'Private'} order copied${format.kind === 'text' ? ' as text' : ''}`)
    } catch (error) {
      setFailed(true)
      setMessage('Could not copy order. Please try again.')
      toast(errorCopy(error, 'Could not copy order'), 'error')
    } finally {
      setCopying(null)
    }
  }

  const changingVisibility = copying === 'Public' || copying === 'Private'
  return <div ref={root} className="relative flex-none print:hidden" onKeyDown={(event) => {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true) }
      return
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      finish()
    }
    if (event.key === 'Tab') finish()
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
      const index = items.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[next]?.focus()
    }
  }}>
    <CopyButton aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      title="Copy order" aria-label={`Copy order ${orderRecordName(order)}`} onClick={() => setOpen((value) => !value)}
      className={cn(supplierId == null ? "relative pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5 pointer-coarse:after:content-[''] h-6 gap-1 px-2 py-0 text-[12px] has-[>svg]:px-2" : 'min-h-11 gap-2 rounded-lg px-3 text-sm font-semibold', copied && 'border-[var(--lps-tone-green-dot)] bg-[var(--lps-tone-green-bg)] text-[var(--lps-tone-green-fg)]')}>
      {copied ? <Check aria-hidden="true" className="size-3" /> : <Copy aria-hidden="true" className="size-3" />}
      {copied ? 'Copied!' : 'Copy order'} <ChevronDown aria-hidden="true" className="size-3" />
    </CopyButton>
    {message && <span role={failed ? 'alert' : 'status'} className={failed ? 'block text-[11px] text-destructive' : 'sr-only'}>{message}</span>}
    {open && createPortal(<div ref={menu} id={menuId} role="menu" aria-label="Copy order" style={position ? { top: position.top, left: position.left, maxHeight: position.maxHeight } : { visibility: 'hidden' }} className={`lps-pop ${position?.upwards ? 'lps-pop-up' : 'lps-pop-down'} fixed z-[100] w-56 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-[var(--lps-shadow)]`}>
      <button type="button" role="switch" aria-label="Public order link" aria-checked={token != null}
        aria-describedby={`${menuId}-visibility`} aria-busy={changingVisibility}
        disabled={copying != null || !canShare || closed} onClick={() => void setPublic(token == null)}
        className="flex min-h-9 w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2 text-[12px] font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:min-h-11">
        <span className={token ? 'text-muted-foreground' : 'text-foreground'}>Private</span>
        <span aria-hidden="true" className={cn('inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-150 ease-lps motion-reduce:transition-none', token ? 'bg-emerald-600' : 'bg-input')}>
          <span className={cn('flex size-4 items-center justify-center rounded-full bg-card shadow-sm transition-transform duration-150 ease-lps motion-reduce:transition-none', token ? 'translate-x-4 text-emerald-700' : 'translate-x-0 text-muted-foreground')}>
            {changingVisibility ? <LoaderCircle className="size-3 animate-spin" /> : token && <Check className="size-3" />}
          </span>
        </span>
        <span className={token ? 'text-foreground' : 'text-muted-foreground'}>Public</span>
      </button>
      <p id={`${menuId}-visibility`} className="m-0 px-2 pb-1 pt-1.5 text-[11px] leading-4 text-muted-foreground">
        {closed ? 'Closed orders cannot be shared publicly.' : token ? 'Anyone with the link can view this order.' : 'Links to the supplier portal.'}
      </p>
      {FORMATS.map((format) => <button key={format.label} type="button" role="menuitem" disabled={copying != null}
        onClick={() => void copy(format)} className={cn(menuItem, supplierId != null && 'min-h-11')}>
        {copying === format.label && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
        {copying === format.label ? 'Copying…' : format.label}
      </button>)}
      {onPrint && <button type="button" role="menuitem" disabled={copying != null} onClick={() => { finish(); onPrint() }}
        className={cn(menuItem, supplierId != null && 'min-h-11')}>Print</button>}
    </div>, document.body)}
  </div>
}
