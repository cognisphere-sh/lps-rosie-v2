'use client'

import { Check, ChevronDown, Copy, LoaderCircle } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CopyButton } from '@/components/workspace/copy-button'

import { orderShareContent } from '@/lib/order-share'
import { orderRecordName, type Order } from '@/lib/orders'
import { errorCopy } from '@/lib/error-copy'
import { useToast } from '@/components/workspace/shell'

const TEMPLATES = [{ label: 'Public', public: true }, { label: 'Private', public: false }] as const

export function CopyOrderMenu({ order, canShare, closed, onChanged }: {
  order: Order; canShare: boolean; closed: boolean; onChanged?: () => void | Promise<void>
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
    const height = menu.current?.offsetHeight || 160
    const below = window.innerHeight - rect.bottom - 12
    const above = rect.top - 12
    const upwards = below < height && above > below
    const maxHeight = Math.max(0, upwards ? above : below)
    setPosition({
      top: upwards ? rect.top - Math.min(height, maxHeight) - 4 : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.right - 192, window.innerWidth - 200)),
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

  async function copy(template: (typeof TEMPLATES)[number]) {
    setCopying(template.label)
    setMessage('')
    setFailed(false)
    try {
      let publicToken = token
      // Create a public link only when requested; private copies use authenticated links.
      if (canShare && !closed && template.public && !publicToken) {
        const response = await fetch(`/api/orders/${order.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPublic: template.public }),
        })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error ?? 'Could not update order sharing')
        publicToken = body.publicToken ?? null
        setToken(publicToken)
        void onChanged?.()
      }
      if (template.public && (!publicToken || closed)) throw new Error('This order cannot be shared publicly.')
      const quote = orderShareContent({ ...order, publicToken }, window.location.origin, template.public ? 'public' : 'private')
      if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([quote.html], { type: 'text/html' }),
          'text/plain': new Blob([quote.text], { type: 'text/plain' }),
        })])
      } else {
        await navigator.clipboard.writeText(quote.html)
      }
      setMessage('Order copied')
      setCopied(template.label)
      setOpen(false)
      toast(`${template.label} order copied`)
    } catch (error) {
      setFailed(true)
      setMessage('Could not copy order. Please try again.')
      toast(errorCopy(error, 'Could not copy order'), 'error')
    } finally {
      setCopying(null)
    }
  }

  return <div ref={root} className="relative flex-none" onKeyDown={(event) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      root.current?.querySelector('button')?.focus()
    }
  }}>
    <CopyButton aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      title="Copy order" aria-label={`Copy order ${orderRecordName(order)}`} onClick={() => setOpen((value) => !value)}
      className={`relative pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5 pointer-coarse:after:content-[''] h-6 gap-1 px-2 py-0 text-[12px] has-[>svg]:px-2 ${copied ? 'border-[var(--lps-tone-green-dot)] bg-[var(--lps-tone-green-bg)] text-[var(--lps-tone-green-fg)]' : ''}`}>
      {copied ? <Check aria-hidden="true" className="size-3" /> : <Copy aria-hidden="true" className="size-3" />}
      {copied ? 'Copied!' : 'Copy order'} <ChevronDown aria-hidden="true" className="size-3" />
    </CopyButton>
    {message && <span role={failed ? 'alert' : 'status'} className={failed ? 'block text-[11px] text-destructive' : 'sr-only'}>{message}</span>}
    {open && createPortal(<div ref={menu} id={menuId} role="menu" aria-label="Copy order link type" style={position ? { top: position.top, left: position.left, maxHeight: position.maxHeight } : { visibility: 'hidden' }} className={`lps-pop ${position?.upwards ? 'lps-pop-up' : 'lps-pop-down'} fixed z-[100] w-48 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-[var(--lps-shadow)]`}>
      {TEMPLATES.map((template) => <button key={template.label} type="button" role="menuitem" disabled={copying != null || (template.public && (closed || (!canShare && !token)))}
        onClick={() => void copy(template)} className="flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-foreground outline-none hover:bg-muted focus-visible:bg-muted disabled:opacity-60">
        {copying === template.label && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
        {copying === template.label ? 'Copying…' : template.label}
      </button>)}
    </div>, document.body)}
  </div>
}
