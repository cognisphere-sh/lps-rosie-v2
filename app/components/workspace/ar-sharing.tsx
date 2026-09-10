'use client'
import { Check, Copy, LoaderCircle, Share2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

export function ARSharing({ id, token, closed, onChange, align = 'left', endpoint = `/api/availability-requests/${id}` }: {
  id: number; token: string | null; closed: boolean; onChange: (token: string | null) => void
  align?: 'left' | 'right'
  endpoint?: string
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied'>('idle')
  const [error, setError] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
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
    try {
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublic }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      onChange(body.publicToken)
      if (body.publicToken) await copy(body.publicToken)
      else setNotice('Request is private. Previous link revoked.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <div ref={root} className="relative inline-block text-left" onKeyDown={event => {
    if (open && event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus()
    }
  }}>
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={panelId}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:bg-lps-tint"
      onClick={() => setOpen(value => !value)}><Share2 className="size-4" />Share</button>
    {open && <section id={panelId} aria-label="Request sharing" className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full z-[90] mt-2 w-80 max-w-[calc(100vw-2rem)] space-y-3 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg`}>
      <p className="font-semibold">{token ? 'Public request' : 'Private request'}</p>
      <p className="text-xs text-muted-foreground">{closed ? 'This request is closed and cannot be made public.' : token ? 'Anyone with this link can view and answer this request until it closes or is made private.' : 'Make this request public so anyone with the link can view and answer it.'}</p>
      {token && <>
        <input aria-label="Public request URL" readOnly className="w-full rounded border p-2 text-xs" value={`${typeof window === 'undefined' ? '' : window.location.origin}/public/availability/${token}`} onFocus={e => e.target.select()} />
        <button type="button" disabled={copyState === 'copying'}
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 disabled:opacity-60 ${copyState === 'copied' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : ''}`}
          onClick={() => void copy(token)}>
          {copyState === 'copied' ? <Check aria-hidden="true" className="size-4" /> : copyState === 'copying' ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Copy aria-hidden="true" className="size-4" />}
          {copyState === 'copied' ? 'Copied!' : copyState === 'copying' ? 'Copying…' : 'Copy public URL'}
        </button>
      </>}
      <button type="button" disabled={busy || (closed && !token)} className="min-h-11 rounded-lg border px-4 disabled:opacity-50"
        onClick={() => void publish(!token)}>{busy ? 'Saving…' : token ? 'Make private' : 'Make public'}</button>
      {notice && <p role="status" className="text-xs">{notice}</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </section>}
  </div>
}
