'use client'

import { Check, ChevronDown, LoaderCircle, Share2 } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { ARDetail } from '@/lib/availability'
import { money, num } from '@/lib/format'
import type { Order } from '@/lib/orders'

type Props = ({ order: Order; request?: never } | { request: ARDetail; order?: never }) & {
  onPublicToken: (token: string) => void
}
const options = ['Copy public URL', 'Copy private URL', 'Copy text', 'Print PDF'] as const

export function PartnerShareMenu({ order, request, onPublicToken }: Props) {
  const record = order ?? request
  const closed = order ? Boolean(order.closed || ['closed_won', 'closed_lost'].includes(order.status)) : request.status === 'closed'
  const path = order ? `orders/${order.id}` : `requests/${request.id}`
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(''), 2000)
    return () => window.clearTimeout(timer)
  }, [message])

  useLayoutEffect(() => {
    if (!open) { setPosition(null); return }
    const rect = trigger.current!.getBoundingClientRect()
    setPosition({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.right - 224, window.innerWidth - 232)) })
  }, [open])

  useEffect(() => {
    if (open && position) menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [open, position])

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false)
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

  function finish() {
    setOpen(false)
    trigger.current?.focus()
  }

  async function select(option: (typeof options)[number]) {
    setError(''); setMessage('')
    if (option === 'Print PDF') { finish(); window.print(); return }
    setBusy(option)
    try {
      let value: string
      if (option === 'Copy text') {
        const items = order ? order.items : request.items.map(item => ({ ...item, quantity: item.demandedQuantity }))
        value = items.map(item => `${num(item.quantity) || '—'} x ${item.size?.trim() || '—'} ${item.name} ${money(item.unitPrice) || '—'}`).join('\n')
      } else if (option === 'Copy private URL') {
        value = `${window.location.origin}/partner/${record.supplierId}/${path}`
      } else {
        let token = record.publicToken
        if (!token) {
          const response = await fetch(`/api/partner/${record.supplierId}/${path}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublic: true }),
          })
          const body = await response.json()
          if (!response.ok) throw new Error(body.error ?? 'Could not create public link. Please try again.')
          if (typeof body.publicToken !== 'string' || !body.publicToken) throw new Error('Could not create public link. Please try again.')
          token = body.publicToken
          onPublicToken(body.publicToken)
        }
        value = `${window.location.origin}/public/${order ? 'orders' : 'availability'}/${token}`
      }
      await navigator.clipboard.writeText(value)
      setMessage(option === 'Copy text' ? 'Text copied' : `${option === 'Copy public URL' ? 'Public' : 'Private'} URL copied`)
      finish()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not copy. Please try again.')
    } finally { setBusy(null) }
  }

  return <div className="relative flex-none print:hidden" onKeyDown={event => {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true) }
      return
    }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish() }
    if (event.key === 'Tab') { setOpen(false); trigger.current?.focus() }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
      const index = items.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[next]?.focus()
    }
  }}>
    <button ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:bg-lps-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => { setError(''); setOpen(value => !value) }}>
      {message ? <Check className="size-4" aria-hidden="true" /> : <Share2 className="size-4" aria-hidden="true" />}Share<ChevronDown className="size-3.5" aria-hidden="true" />
    </button>
    <span aria-live="polite" className="sr-only">{message}</span>
    {open && createPortal(<div ref={menu} id={menuId} role="menu" aria-label="Share" style={position ?? { visibility: 'hidden' }}
      className="lps-pop lps-pop-down fixed z-[100] w-56 max-w-[calc(100vw-16px)] rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-[var(--lps-shadow)] print:hidden">
      {options.map(option => <button key={option} type="button" role="menuitem" disabled={busy != null || (option === 'Copy public URL' && closed)}
        title={option === 'Copy public URL' && closed ? 'Closed records cannot be shared publicly' : undefined}
        onClick={() => void select(option)}
        className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] outline-none hover:bg-muted focus-visible:bg-muted disabled:cursor-not-allowed disabled:opacity-60">
        {busy === option && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}{option}
      </button>)}
      {error && <p role="alert" className="m-0 px-3 py-2 text-xs text-destructive">{error}</p>}
    </div>, document.body)}
  </div>
}
