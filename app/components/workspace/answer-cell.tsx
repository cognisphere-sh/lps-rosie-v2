'use client'

import { useRef, useState } from 'react'

import { useCoarsePointer, useLongPress } from '@/components/workspace/long-press'
import { cn } from '@/lib/utils'

// Its own module, apart from availability.tsx, so the public order page can
// price a line without bundling the whole availability table.

/** The portal drawing's one accent: what still needs a price. */
export const PORTAL_PURPLE = '#8F7CF6'

/** One answer field — a small input that saves on blur, or plain text. */
export function AnswerCell({
  value,
  editable,
  align = 'left',
  placeholder,
  display,
  onCommit,
  plain = false,
  attention = false,
  ariaLabel,
  touch = false,
  inputMode,
  multiline = false,
  wrap = false,
  clamp = false,
  format,
  className,
  tapToEdit = false,
}: {
  value: string
  editable: boolean
  align?: 'left' | 'center' | 'right'
  placeholder: string
  /** How the committed value reads when not editable (money, thousands). */
  display: string
  onCommit: (next: string) => void
  /** The portal drawing: no box — grey text on the row until focused. */
  plain?: boolean
  /** `plain` only: draw the accent box, for a cell that still needs filling. */
  attention?: boolean
  ariaLabel?: string
  /** Give a phone card's standalone input a full touch target. */
  touch?: boolean
  inputMode?: 'decimal' | 'numeric'
  multiline?: boolean
  /** A one-line value that wraps onto more lines instead of clipping; Enter still saves. */
  wrap?: boolean
  /** `multiline` only: show one line, clipped, until focused. */
  clamp?: boolean
  /** How an editable value reads while not focused, e.g. money; focus shows the raw value to type. */
  format?: (raw: string) => string
  /** Extra classes for the editable control. */
  className?: string
  /** Touch screens: a tap types straight away, skipping the press-and-hold. */
  tapToEdit?: boolean
}) {
  const [draft, setDraft] = useState(value)
  // The cell is uncontrolled while it is being typed in, but the committed
  // value can also change underneath it — the answer pop-up writes quantity,
  // price and notes at once, and the page re-fetches. Take the new value when
  // it arrives, or the row would keep showing what the cell was left holding.
  const [committed, setCommitted] = useState(value)
  if (committed !== value) {
    setCommitted(value)
    setDraft(value)
  }
  // Touch screens: a tap that begins a scroll must not open the field, so it
  // stays read-only until a press-and-hold arms it.
  const coarse = useCoarsePointer() && !tapToEdit
  const [armed, setArmed] = useState(false)
  const [focused, setFocused] = useState(false)
  const armedRef = useRef(false)
  const controlRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const hold = useLongPress(() => { armedRef.current = true; setArmed(true) }, coarse && editable)
  if (!editable) {
    return (
      <span
        className={cn(
          'min-w-0 px-1 tabular-nums',
          touch ? 'text-[14px]' : 'text-[13px]',
          clamp ? 'truncate' : touch || multiline || wrap ? 'whitespace-pre-wrap [overflow-wrap:anywhere]' : 'truncate',
          align === 'right' && 'text-right',
          align === 'center' && 'text-center',
          display ? 'text-foreground' : 'text-lps-dim',
        )}
        title={display || undefined}
      >
        {display || '—'}
      </span>
    )
  }
  const Control = multiline || wrap ? 'textarea' : 'input'
  return (
    <Control
      ref={controlRef as never}
      value={format && !focused ? format(draft) || draft : draft}
      readOnly={coarse && !armed}
      {...hold}
      onTouchEnd={() => {
        hold.onTouchEnd?.()
        const el = controlRef.current
        if (armedRef.current && el) { el.readOnly = false; el.focus() }
      }}
      onFocus={(e: { currentTarget: HTMLElement }) => {
        if (coarse && !armedRef.current) e.currentTarget.blur()
        else if (format) setFocused(true)
      }}
      aria-label={ariaLabel}
      placeholder={placeholder}
      inputMode={inputMode}
      rows={clamp || wrap ? 1 : multiline ? 3 : undefined}
      onChange={(e) => setDraft(e.target.value)}
      // A clipped input shows its full text on hover; one that fits shows none.
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.title = el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight ? draft : ''
      }}
      onBlur={() => {
        armedRef.current = false
        setArmed(false)
        setFocused(false)
        if (draft.trim() !== value.trim()) onCommit(draft)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !multiline) {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      className={cn(
        touch
          ? 'min-h-11 w-full min-w-0 rounded-lg px-3 py-2 text-base outline-none placeholder:text-lps-dim'
          : 'h-7 w-full min-w-0 rounded-md px-1.5 text-[13px] outline-none placeholder:text-lps-dim',
        multiline && !clamp && 'h-auto resize-y whitespace-pre-wrap [field-sizing:content] [overflow-wrap:anywhere]',
        wrap && 'h-auto resize-none whitespace-pre-wrap [field-sizing:content] [overflow-wrap:anywhere]',
        clamp && 'resize-none overflow-hidden text-ellipsis whitespace-nowrap focus:h-auto focus:resize-y focus:whitespace-pre-wrap focus:[field-sizing:content] focus:[overflow-wrap:anywhere]',
        (multiline || wrap) && !touch && 'min-h-7 py-1',
        plain
          ? 'border bg-transparent text-muted-foreground focus-visible:text-foreground'
          : 'border border-input bg-background focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50',
        plain && !attention && 'border-transparent hover:border-border focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
        align === 'right' && 'text-right tabular-nums',
        align === 'center' && 'text-center tabular-nums',
        className,
      )}
      style={plain && attention ? { borderColor: PORTAL_PURPLE, maxWidth: 72, marginLeft: 'auto' } : undefined}
    />
  )
}
