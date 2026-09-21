'use client'

import { Check, ChevronDown, Copy, LoaderCircle } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

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
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
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
    if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false) }
  }}>
    <button type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      title="Copy quote" onClick={() => setOpen((value) => !value)}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold hover:bg-lps-tint ${copied ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : ''}`}>
      {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
      {copied ? 'Copied!' : 'Copy quote'} <ChevronDown aria-hidden="true" className="size-3" />
    </button>
    {open && <div id={menuId} role="menu" aria-label="Copy quote template" className="absolute right-0 z-[90] mt-1 min-w-48 rounded-lg border border-border bg-popover p-1 shadow-lg">
      {TEMPLATES.map((template) => <button key={template.label} type="button" role="menuitem" disabled={copying != null}
        onClick={() => void copy(template)} className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-xs font-semibold hover:bg-lps-tint disabled:opacity-60">
        {copying === template.label && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
        {copying === template.label ? 'Copying…' : template.label}
      </button>)}
    </div>}
  </div>
}
