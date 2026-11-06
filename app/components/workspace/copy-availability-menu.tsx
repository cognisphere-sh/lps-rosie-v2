'use client'

import { Check, ChevronDown, Copy, LoaderCircle } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CopyButton } from '@/components/workspace/copy-button'

import { availabilityShareContent } from '@/lib/availability-share'
import { availabilityRecordName, type ARDetail } from '@/lib/availability'
import { errorCopy } from '@/lib/error-copy'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/workspace/frame'

const FORMATS = [{ label: 'Copy HTML', kind: 'html' }, { label: 'Copy text', kind: 'text' }, { label: 'Copy link', kind: 'link' }] as const
const menuItem = 'flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-foreground outline-none hover:bg-muted focus-visible:bg-muted disabled:opacity-60'

/**
 * The AR card's Copy availability (2026-10-26), in place of its Share and
 * Print buttons: Public/Private sets the request's public link — the old
 * Share panel's Make public / Make private — and the copies link to whichever
 * is set; Copy link copies just that link. Print prints the AR's sheet.
 */
export function CopyAvailabilityMenu({ ar, onPublicToken, onPrint }: {
  ar: ARDetail; onPublicToken: (token: string | null) => void; onPrint: () => void
}) {
  const toast = useToast()
  const token = ar.publicToken ?? null
  const closed = ar.status === 'closed'
  const draft = ar.status === 'draft'
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
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
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function setPublic(isPublic: boolean) {
    if (isPublic === (token != null)) return
    setBusy(isPublic ? 'Public' : 'Private')
    try {
      const response = await fetch(`/api/availability-requests/${ar.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Could not update request sharing')
      onPublicToken(body.publicToken ?? null)
      toast(isPublic ? 'Request is public' : 'Request is private. Previous link revoked.')
    } catch (error) {
      toast(errorCopy(error, 'Could not update request sharing'), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function copy(format: (typeof FORMATS)[number]) {
    setBusy(format.label)
    try {
      const content = availabilityShareContent(ar, window.location.origin, token ? 'public' : 'private')
      if (format.kind === 'link') {
        await navigator.clipboard.writeText(content.url)
      } else if (format.kind === 'text') {
        await navigator.clipboard.writeText(content.text)
      } else if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([content.html], { type: 'text/html' }),
          'text/plain': new Blob([content.text], { type: 'text/plain' }),
        })])
      } else {
        await navigator.clipboard.writeText(content.html)
      }
      setCopied(true)
      setOpen(false)
      toast(format.kind === 'link' ? `${token ? 'Public' : 'Private'} link copied`
        : `${token ? 'Public' : 'Private'} availability copied${format.kind === 'text' ? ' as text' : ''}`)
    } catch (error) {
      toast(errorCopy(error, 'Could not copy availability'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const changingVisibility = busy === 'Public' || busy === 'Private'
  return <div ref={root} className="relative flex-none" onKeyDown={(event) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      root.current?.querySelector('button')?.focus()
    }
  }}>
    <CopyButton aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      title="Copy availability" aria-label={`Copy availability ${availabilityRecordName(ar)}`} onClick={() => setOpen((value) => !value)}
      className={`relative pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5 pointer-coarse:after:content-[''] h-6 gap-1 px-2 py-0 text-[12px] has-[>svg]:px-2 ${copied ? 'border-[var(--lps-tone-green-dot)] bg-[var(--lps-tone-green-bg)] text-[var(--lps-tone-green-fg)]' : ''}`}>
      {copied ? <Check aria-hidden="true" className="size-3" /> : <Copy aria-hidden="true" className="size-3" />}
      {copied ? 'Copied!' : 'Copy'} <ChevronDown aria-hidden="true" className="size-3" />
    </CopyButton>
    {open && createPortal(<div ref={menu} id={menuId} role="menu" aria-label="Copy availability" style={position ? { top: position.top, left: position.left, maxHeight: position.maxHeight } : { visibility: 'hidden' }} className={`lps-pop ${position?.upwards ? 'lps-pop-up' : 'lps-pop-down'} fixed z-[100] w-56 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-[var(--lps-shadow)]`}>
      <button type="button" role="switch" aria-label="Public request link" aria-checked={token != null}
        aria-describedby={`${menuId}-visibility`} aria-busy={changingVisibility}
        disabled={busy != null || draft || (closed && !token)} onClick={() => void setPublic(token == null)}
        className="flex min-h-9 w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2 text-[12px] font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:min-h-11">
        <span className={token ? 'text-muted-foreground' : 'text-foreground'}>Private</span>
        <span aria-hidden="true" className={cn('inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-150 ease-lps motion-reduce:transition-none',
          token ? 'bg-emerald-600' : 'bg-input')}>
          <span className={cn('flex size-4 items-center justify-center rounded-full bg-card shadow-sm transition-transform duration-150 ease-lps motion-reduce:transition-none',
            token ? 'translate-x-4 text-emerald-700' : 'translate-x-0 text-muted-foreground')}>
            {changingVisibility ? <LoaderCircle className="size-3 animate-spin" /> : token && <Check className="size-3" />}
          </span>
        </span>
        <span className={token ? 'text-foreground' : 'text-muted-foreground'}>Public</span>
      </button>
      <p id={`${menuId}-visibility`} className="m-0 px-2 pb-1 pt-1.5 text-[11px] leading-4 text-muted-foreground">
        {draft ? 'Publish this draft before sharing it.' : token ? 'Anyone with the link can view and answer.' : closed ? 'Closed requests cannot be made public.' : 'Links to the supplier portal.'}
      </p>
      {FORMATS.map((format) => <button key={format.label} type="button" role="menuitem" disabled={busy != null}
        onClick={() => void copy(format)} className={menuItem}>
        {busy === format.label && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
        {busy === format.label ? 'Copying…' : format.label}
      </button>)}
      <button type="button" role="menuitem" disabled={busy != null} onClick={() => { setOpen(false); onPrint() }}
        className={menuItem}>Print</button>
    </div>, document.body)}
  </div>
}
