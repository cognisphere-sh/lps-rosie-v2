'use client'

import { Ellipsis } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

/**
 * One line of text, ellipsised when it doesn't fit. Only then does a small
 * "…" button follow it, opening the full text in a popover — a phone has no
 * hover, so `title` alone would hide the rest from it. The button is
 * `pointer-events-auto` so it still works inside a card whose content lets
 * clicks through to a stretched link underneath.
 */
export function TruncatedText({ text, label, className }: {
  text: string
  /** What the text is, for the button's name: "Show full {label}". */
  label: string
  className?: string
}) {
  const textRef = useRef<HTMLSpanElement>(null)
  const [clipped, setClipped] = useState(false)
  const [open, setOpen] = useState(false)
  const id = useId()

  useEffect(() => {
    const el = textRef.current
    if (!el) return
    const measure = () => setClipped(el.scrollWidth > el.clientWidth + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text])

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest(`[data-truncated-text="${id}"]`)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open, id])

  return (
    <span data-truncated-text={id} className={cn('relative flex min-w-0 items-center gap-1', className)}>
      <span ref={textRef} className="min-w-0 truncate" title={text}>{text}</span>
      {clipped && (
        <button
          type="button"
          aria-label={`Show full ${label}`}
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen((v) => !v) }}
          className="pointer-events-auto relative z-10 flex size-6 flex-none cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Ellipsis aria-hidden="true" className="size-4" />
        </button>
      )}
      {open && (
        <span
          id={id}
          role="status"
          className="pointer-events-auto absolute inset-x-0 top-full z-20 mt-1 whitespace-pre-wrap rounded-lg border border-border bg-popover px-3 py-2 text-[13px] font-normal leading-5 text-foreground shadow-[var(--lps-shadow)] [overflow-wrap:anywhere]"
        >
          {text}
        </span>
      )}
    </span>
  )
}
