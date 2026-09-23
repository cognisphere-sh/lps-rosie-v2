'use client'

import { Check, ChevronDown, Copy, LoaderCircle } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CopyButton } from '@/components/workspace/copy-button'

import { jobRequestToHtmlQuote, type QuoteTemplateOptions } from '@/lib/job-request-html-quote'
import type { JobRequestRow } from '@/lib/rows'
import { useToast } from '@/components/workspace/shell'

type Template = {
  label: string
  html: boolean
  options?: QuoteTemplateOptions
}

// Add future quote templates here; the menu and clipboard handling stay shared.
const TEMPLATES: readonly Template[] = [
  { label: 'Text Quote', html: false },
  { label: 'HTML Quote', html: true },
  { label: 'Text Availability', html: false, options: { includeAvailabilityStatus: true } },
  { label: 'HTML Availability', html: true, options: { includeAvailabilityStatus: true } },
]

export function CopyQuoteMenu({ request }: { request: JobRequestRow }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [copying, setCopying] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null)
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
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    menu.current?.querySelector('button')?.focus()
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

  async function copy(template: Template) {
    setCopying(template.label)
    try {
      const quote = jobRequestToHtmlQuote(request, template.options)
      if (template.html && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([quote.html], { type: 'text/html' }),
          'text/plain': new Blob([quote.text], { type: 'text/plain' }),
        })])
      } else {
        await navigator.clipboard.writeText(template.html ? quote.html : quote.text)
      }
      setCopied(template.label)
      setOpen(false)
      toast(`${template.label} copied`)
    } catch (error) {
      toast(error instanceof Error ? error.message : `Could not copy ${template.label}.`)
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
      title="Copy quote" onClick={() => setOpen((value) => !value)}
      className={`h-6 gap-1 px-2 py-0 text-[11px] has-[>svg]:px-2 ${copied ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : ''}`}>
      {copied ? <Check aria-hidden="true" className="size-3" /> : <Copy aria-hidden="true" className="size-3" />}
      {copied ? 'Copied!' : 'Copy quote'} <ChevronDown aria-hidden="true" className="size-3" />
    </CopyButton>
    {open && createPortal(<div ref={menu} id={menuId} role="menu" aria-label="Copy quote template" style={position ?? { visibility: 'hidden' }} className="lps-pop fixed z-[100] w-48 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-[var(--lps-shadow)]">
      {TEMPLATES.map((template) => <button key={template.label} type="button" role="menuitem" disabled={copying != null}
        onClick={() => void copy(template)} className="flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-foreground outline-none hover:bg-muted focus-visible:bg-muted disabled:opacity-60">
        {copying === template.label && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
        {copying === template.label ? 'Copying…' : template.label}
      </button>)}
    </div>, document.body)}
  </div>
}
