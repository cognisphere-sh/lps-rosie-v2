'use client'
import { Check, Copy, LoaderCircle, Share2 } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

export function ARSharing({ id, token, closed, onChange, align = 'left', compact = false, endpoint = `/api/availability-requests/${id}` }: {
  id: number; token: string | null; closed: boolean; onChange: (token: string | null) => void
  align?: 'left' | 'right'
  /** Phones: the icon alone, so a header row keeps its other controls beside it. */
  compact?: boolean
  endpoint?: string
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied'>('idle')
  const [error, setError] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const panelId = useId()
  // The panel's left edge relative to the trigger, kept inside the viewport:
  // anchored to a trigger with other buttons beside it, a phone has no room
  // for it to hang off the trigger's edge.
  const [offset, setOffset] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const box = root.current?.getBoundingClientRect()
      const width = panel.current?.offsetWidth
      if (!box || !width) return
      const wanted = align === 'right' ? box.right - width : box.left
      setOffset(Math.max(16, Math.min(wanted, window.innerWidth - 16 - width)) - box.left)
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, align])
  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])
  useEffect(() => {
    if (copyState !== 'copied') return
    const timer = window.setTimeout(() => setCopyState('idle'), 2000)
    return () => window.clearTimeout(timer)
  }, [copyState])
  async function copy(value: string) {
    setCopyState('copying')
    setNotice('')
    const url = `${window.location.origin}/public/availability/${value}`
    try {
      await navigator.clipboard.writeText(url)
      setCopyState('copied')
      setNotice('Link copied')
    } catch {
      setCopyState('idle')
      setNotice('Could not copy automatically. Select and copy the URL above.')
    }
  }
  async function publish(isPublic: boolean) {
    setBusy(true); setError(''); setNotice('')
    // Optimistic for Make private only: a public link needs the server's token.
    const before = token
    if (!isPublic) onChange(null)
    try {
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublic }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      onChange(body.publicToken)
      if (body.publicToken) await copy(body.publicToken)
      else setNotice('Request is private. Previous link revoked.')
    } catch (e) {
      if (!isPublic) onChange(before)
      setError((e as Error).message)
    } finally { setBusy(false) }
  }
  return <div ref={root} className="relative inline-block text-left" onKeyDown={event => {
    if (open && event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus()
    }
  }}>
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={panelId}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:bg-lps-tint"
      onClick={() => setOpen(value => !value)}><Share2 className="size-4" aria-hidden="true" /><span className={compact ? 'max-[899px]:sr-only' : undefined}>Share</span></button>
    {open && <section ref={panel} id={panelId} aria-label="Request sharing"
      style={offset == null ? undefined : { left: offset, right: 'auto' }} className={`lps-pop lps-pop-down absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full z-[90] mt-2 w-80 max-w-[calc(100vw-2rem)] space-y-3 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg`}>
      <p className="font-semibold">{token ? 'Public request' : 'Private request'}</p>
      <p className="text-xs text-muted-foreground">{closed ? 'This request is closed and cannot be made public.' : token ? 'Anyone with this link can view and answer this request until it closes or is made private.' : 'Make this request public so anyone with the link can view and answer it.'}</p>
      {token && <>
        <input aria-label="Public request URL" readOnly className="w-full rounded border p-2 text-xs" value={`${typeof window === 'undefined' ? '' : window.location.origin}/public/availability/${token}`} onFocus={e => e.target.select()} />
        <button type="button" disabled={copyState === 'copying'}
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-[13px] font-semibold transition-colors duration-150 ease-lps disabled:opacity-60 ${copyState === 'copied' ? 'border-[var(--lps-tone-green-dot)] bg-[var(--lps-tone-green-bg)] text-[var(--lps-tone-green-fg)]' : 'hover:bg-muted'}`}
          onClick={() => void copy(token)}>
          {copyState === 'copied' ? <Check aria-hidden="true" className="size-4" /> : copyState === 'copying' ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Copy aria-hidden="true" className="size-4" />}
          {copyState === 'copied' ? 'Copied!' : copyState === 'copying' ? 'Copying…' : 'Copy public URL'}
        </button>
      </>}
      <button type="button" disabled={busy || (closed && !token)} className="min-h-11 rounded-lg border px-4 text-[13px] font-semibold transition-colors hover:bg-muted disabled:opacity-50"
        onClick={() => void publish(!token)}>{busy ? 'Saving…' : token ? 'Make private' : 'Make public'}</button>
      {notice && <p role="status" className="text-xs">{notice}</p>}
      {error && <p role="alert" className="text-[12px] text-destructive">{error}</p>}
    </section>}
  </div>
}
