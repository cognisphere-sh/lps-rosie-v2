'use client'

// The pieces of an availability request that two apps draw: the supplier
// portal (where the lines are answered) and the admin supplier profile (where
// the answers are read). Nothing here knows which side it is on beyond the
// `editable` prop on the line table.

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import {
  AR_RESPONSES,
  AR_RESPONSE_META,
  AR_RESPONSE_OPTIONS,
  AR_STATUSES,
  arLineTotal,
  arResponseLabel,
  arResponseTone,
  arStatusLabel,
  arStatusTone,
  arSubtotal,
  type ARItem,
} from '@/lib/availability'
import { BodyModalPortal, firstModalFocusTarget, validModalFocusTarget } from '@/components/workspace/body-modal-portal'
import { ChevronDown } from '@/components/workspace/icons'
import { money, num } from '@/lib/format'
import { toneDot, toneStyle, toneTint, type Tone } from '@/lib/job-requests'
import { cn } from '@/lib/utils'

/** Need · Size · Plant · Status · Avail qty · Price · Line total · Notes. */
const LINE_COLUMNS =
  '56px 90px minmax(200px,1.5fr) 150px 90px 100px 100px minmax(200px,1fr)'
/** Track minima + gaps + row padding/left accent; below this the table scrolls. */
const GRID_MIN = 1070

// A caller may put one column of its own in front of Need — the By-item view
// uses it for the job a line came from, because there a table holds lines from
// several requests at once. Everything after it stays exactly as it is here,
// so the two tables are the same table.
/** The leading column's track, when one is asked for. */
const LEAD_COLUMN = 'minmax(210px,1.3fr)'
/** Its contribution to the scroll threshold: the track minimum plus its gap. */
const LEAD_MIN = 218

// The portal's request page (2026-08-30 design) draws the same table without
// the Line total column and without the tone bar/tint per row: Need · Size ·
// Plant · Status · Avail qty · Price · Note from supplier over plain hairlines.
/** The portal design's tracks — the default's, less Line total. */
const PORTAL_COLUMNS = '56px 90px minmax(220px,1.6fr) 150px 90px 100px minmax(200px,1fr)'
const PORTAL_GRID_MIN = 960
/** Which of the two drawings a table uses. */
type LineTableDesign = 'default' | 'portal'
/** The portal drawing's one accent: what still needs a price. */
const PORTAL_PURPLE = '#8F7CF6'


/**
 * The request's lifecycle pill — New / Processing / Completed / Closed. With `onChange` it
 * is also the picker for it, the same native-select-under-a-pill the line
 * answers use; without it, a read-only pill.
 */
export function ARStatusPill({
  status,
  onChange,
  touch = false,
}: {
  status: string
  onChange?: (next: string) => void
  touch?: boolean
}) {
  return (
    <span
      className={cn(
        'relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
        onChange && 'cursor-pointer',
        touch && 'min-h-11 min-[900px]:min-h-0',
      )}
      style={toneStyle(arStatusTone(status))}
    >
      <span className="size-1.5 rounded-full" style={{ background: toneDot(arStatusTone(status)) }} />
      {arStatusLabel(status)}
      {onChange && (
        <select
          aria-label="Request status"
          value={status}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {AR_STATUSES.map((s) => (
            <option key={s} value={s}>{arStatusLabel(s)}</option>
          ))}
        </select>
      )}
    </span>
  )
}

/**
 * The request's answer strip — the supplier-facing twin of the admin Job
 * Request card's DemandSummary: every answer with its count, then the line
 * count and the subtotal. Zeros are drawn and dimmed rather than dropped, so
 * "nothing is unavailable" and "nobody has looked yet" cannot render alike.
 */
export function ARResponseSummary({
  items,
  answeredCount,
}: {
  items: ARItem[]
  answeredCount: number
}) {
  const counts: Record<string, number> = {}
  for (const item of items) {
    if (item.status) counts[item.status] = (counts[item.status] ?? 0) + 1
  }
  const states = [
    { label: 'Pending', count: items.length - answeredCount, tone: 'grey' as Tone },
    ...AR_RESPONSES.map((status) => ({
      label: AR_RESPONSE_META[status].label,
      count: counts[status] ?? 0,
      tone: AR_RESPONSE_META[status].tone,
    })),
  ]
  return (
    <div className="overflow-x-auto rounded-lg border border-lps-hair bg-secondary/45">
      <div className="grid min-w-[800px] grid-cols-[repeat(6,minmax(92px,1fr))_minmax(92px,1fr)_minmax(118px,1.15fr)] divide-x divide-lps-hair">
        {states.map((state) => (
          <div key={state.label} className={cn('flex flex-col gap-0.5 px-3 py-2', state.count === 0 && 'opacity-45')}>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.04em] text-muted-foreground">
              <span className="size-1.5 flex-none rounded-full" style={{ background: toneDot(state.tone) }} />
              {state.label}
            </span>
            <span className="text-[13px] font-bold tabular-nums text-foreground">{state.count}</span>
          </div>
        ))}
        <div className="flex flex-col gap-0.5 px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-[.04em] text-muted-foreground">Lines</span>
          <span className="text-[13px] font-bold tabular-nums text-foreground">{items.length}</span>
        </div>
        <div className="flex flex-col gap-0.5 px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-[.04em] text-muted-foreground">Subtotal</span>
          <span className="text-[13px] font-bold tabular-nums text-foreground">
            {money(arSubtotal(items)) || '—'}
          </span>
        </div>
      </div>
    </div>
  )
}

/** Where a message actually happened — portal, email, text, or internal. */
/** Five saved answers followed by Pending (NULL), in canonical order. */
const RESPONSE_PICKER_OPTIONS = AR_RESPONSE_OPTIONS

/**
 * The supplier portal's dark, compact replacement for a native opened select.
 * It is portalled out of the scrolling table so the choice surface cannot be
 * clipped, while retaining ordinary listbox keyboard and touch interaction.
 */
function PortalResponseSelect({
  value,
  onChange,
  ariaLabel = 'Line status',
  touch = false,
}: {
  value: string | null
  onChange: (next: string) => void
  ariaLabel?: string
  touch?: boolean
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const optionId = useId()
  const selectedIndex = Math.max(0, RESPONSE_PICKER_OPTIONS.findIndex((option) => option.value === (value ?? '')))
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(selectedIndex)
  const [position, setPosition] = useState({ left: 8, top: 8, width: 196, maxHeight: 228 })
  const typeahead = useRef('')
  const typeaheadAt = useRef(0)
  const typeaheadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const frames = useRef(new Set<number>())
  const tone = arResponseTone(value)

  const cancelFrames = () => {
    for (const frame of frames.current) cancelAnimationFrame(frame)
    frames.current.clear()
  }

  const scheduleFrame = (callback: () => void) => {
    const frame = requestAnimationFrame(() => {
      frames.current.delete(frame)
      callback()
    })
    frames.current.add(frame)
  }

  const positionMenu = () => {
    const rect = trigger.current?.getBoundingClientRect()
    if (!rect) return
    const availableWidth = Math.max(0, window.innerWidth - 16)
    const availableHeight = Math.max(0, window.innerHeight - 16)
    const width = Math.min(Math.max(196, rect.width), availableWidth)
    const maxHeight = Math.min(RESPONSE_PICKER_OPTIONS.length * (touch ? 44 : 36) + 12, availableHeight)
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    const below = rect.bottom + 6
    const preferredTop = below + maxHeight <= window.innerHeight - 8
      ? below
      : rect.top - maxHeight - 6
    const top = Math.max(8, Math.min(preferredTop, window.innerHeight - maxHeight - 8))
    setPosition({ left, top, width, maxHeight })
  }

  const show = (nextActive = selectedIndex) => {
    cancelFrames()
    setActive(nextActive)
    positionMenu()
    setOpen(true)
  }

  const close = (restoreFocus = false) => {
    cancelFrames()
    setOpen(false)
    typeahead.current = ''
    typeaheadAt.current = 0
    if (typeaheadTimer.current) {
      clearTimeout(typeaheadTimer.current)
      typeaheadTimer.current = null
    }
    if (restoreFocus) scheduleFrame(() => trigger.current?.focus())
  }

  const choose = (next: string) => {
    if ((next || null) !== value) onChange(next)
    // Follow-up answers mount an autofocus dialog; do not steal focus back
    // from it. The two direct actions return focus to the line trigger.
    close(next === '' || next === 'available')
  }

  useEffect(() => {
    if (!open) return
    cancelFrames()
    positionMenu()
    scheduleFrame(() => {
      const option = menu.current?.querySelector<HTMLElement>(`[data-option-index="${active}"]`)
      option?.focus({ preventScroll: true })
      option?.scrollIntoView?.({ block: 'nearest' })
    })
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!trigger.current?.contains(target) && !menu.current?.contains(target)) close()
    }
    document.addEventListener('pointerdown', outside)
    const queuePosition = () => scheduleFrame(positionMenu)
    window.addEventListener('resize', queuePosition)
    window.addEventListener('scroll', queuePosition, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('resize', queuePosition)
      window.removeEventListener('scroll', queuePosition, true)
    }
  }, [open, active])

  useEffect(() => () => {
    cancelFrames()
    if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current)
  }, [])

  const focusTriggerNeighbor = (direction: -1 | 1) => {
    const current = trigger.current
    if (!current) return
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]',
    )).filter((element) => {
      const style = getComputedStyle(element)
      return element.tabIndex >= 0
        && !element.matches(':disabled')
        && !element.closest('[hidden], [inert], [aria-hidden="true"]')
        && !menu.current?.contains(element)
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && element.getClientRects().length > 0
    })
    const index = candidates.indexOf(current)
    for (let cursor = index + direction; cursor >= 0 && cursor < candidates.length; cursor += direction) {
      const candidate = candidates[cursor]
      candidate.focus()
      if (document.activeElement === candidate) return
    }
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  const moveByTypeahead = (key: string, index: number) => {
    const now = Date.now()
    const prior = now - typeaheadAt.current <= 500 ? typeahead.current : ''
    const repeated = prior.length > 0 && [...prior].every((char) => char === key)
    const query = repeated ? key : `${prior}${key}`
    const start = repeated ? index + 1 : 0
    const ordered = [...RESPONSE_PICKER_OPTIONS.keys()].map((offset) => (start + offset) % RESPONSE_PICKER_OPTIONS.length)
    const match = ordered.find((optionIndex) => RESPONSE_PICKER_OPTIONS[optionIndex].label.toLowerCase().startsWith(query))
    typeahead.current = query
    typeaheadAt.current = now
    if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current)
    typeaheadTimer.current = setTimeout(() => {
      typeahead.current = ''
      typeaheadAt.current = 0
      typeaheadTimer.current = null
    }, 500)
    if (match != null) setActive(match)
  }

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      if (event.key === 'ArrowDown') show((selectedIndex + 1) % RESPONSE_PICKER_OPTIONS.length)
      else if (event.key === 'ArrowUp') show((selectedIndex - 1 + RESPONSE_PICKER_OPTIONS.length) % RESPONSE_PICKER_OPTIONS.length)
      else show(event.key === 'Home' ? 0 : RESPONSE_PICKER_OPTIONS.length - 1)
    }
  }

  const onOptionKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    let next = index
    if (event.key === 'ArrowDown') next = (index + 1) % RESPONSE_PICKER_OPTIONS.length
    else if (event.key === 'ArrowUp') next = (index - 1 + RESPONSE_PICKER_OPTIONS.length) % RESPONSE_PICKER_OPTIONS.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = RESPONSE_PICKER_OPTIONS.length - 1
    else if (event.key === 'Escape') {
      event.preventDefault()
      close(true)
      return
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(RESPONSE_PICKER_OPTIONS[index].value)
      return
    } else if (event.key === 'Tab') {
      event.preventDefault()
      close()
      scheduleFrame(() => focusTriggerNeighbor(event.shiftKey ? -1 : 1))
      return
    } else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      moveByTypeahead(event.key.toLowerCase(), index)
      return
    } else return
    event.preventDefault()
    setActive(next)
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={`${ariaLabel}, ${arResponseLabel(value)}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${optionId}-listbox`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          if (open) close()
          else show()
        }}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          'inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 font-medium text-muted-foreground outline-none hover:bg-secondary focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          touch ? 'min-h-11 w-full justify-between text-[14px]' : 'min-h-8 text-[12px]',
        )}
        style={value ? { color: toneDot(tone) } : undefined}
      >
        {!value && <span aria-hidden="true" className="text-[10px] tracking-[.1em] text-lps-dim">···</span>}
        <span>{arResponseLabel(value)}</span>
        <ChevronDown aria-hidden="true" className="size-3 opacity-70" />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menu}
          id={`${optionId}-listbox`}
          role="listbox"
          aria-label={ariaLabel}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className="fixed z-[100] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-[var(--lps-shadow)]"
          style={position}
        >
          {RESPONSE_PICKER_OPTIONS.map((option, index) => {
            const selected = option.value === (value ?? '')
            const optionTone = arResponseTone(option.value || null)
            return (
              <div
                key={option.value || 'unanswered'}
                id={`${optionId}-${index}`}
                role="option"
                aria-selected={selected}
                tabIndex={index === active ? 0 : -1}
                data-option-index={index}
                onFocus={() => setActive(index)}
                onClick={() => choose(option.value)}
                onKeyDown={(event) => onOptionKeyDown(event, index)}
                className={cn(
                  'flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-[12px] font-semibold outline-none hover:bg-secondary focus-visible:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/50',
                  touch && 'min-h-11 text-[14px]',
                  selected && 'bg-secondary',
                )}
              >
                <span aria-hidden="true" className="size-1.5 flex-none rounded-full" style={{ background: toneDot(optionTone) }} />
                <span>{option.label}</span>
                {selected && <span aria-hidden="true" className="ml-auto text-primary">✓</span>}
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}

/**
 * The supplier's per-line answer, as a pill-styled picker. Admin surfaces keep
 * their existing native control; only the portal uses the custom dark listbox.
 */
function ResponseSelect({
  value,
  disabled,
  onChange,
  portal = false,
  ariaLabel = 'Line status',
  touch = false,
}: {
  value: string | null
  disabled: boolean
  onChange: (next: string) => void
  portal?: boolean
  ariaLabel?: string
  touch?: boolean
}) {
  const tone = arResponseTone(value)
  if (portal && !disabled) return <PortalResponseSelect value={value} onChange={onChange} ariaLabel={ariaLabel} touch={touch} />
  return (
    <span
      className={cn(
        'relative inline-flex items-center gap-1.5',
        portal
          ? 'min-h-8 rounded-full border border-border bg-secondary/60 px-3 text-[12px] font-medium text-muted-foreground'
          : cn('rounded-full px-2.5 py-1 text-[11px] font-bold', touch && 'min-h-11'),
        !disabled && 'cursor-pointer',
      )}
      style={portal ? (value ? { color: toneDot(tone) } : undefined) : toneStyle(tone)}
    >
      {portal ? (
        !value && <span className="text-[10px] tracking-[.1em] text-lps-dim">···</span>
      ) : (
        <span className="size-1.5 rounded-full" style={{ background: toneDot(tone) }} />
      )}
      {arResponseLabel(value)}
      {portal && <ChevronDown className="size-3 opacity-70" />}
      {!disabled && (
        <select
          aria-label={ariaLabel}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {AR_RESPONSE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </span>
  )
}

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
}: {
  value: string
  editable: boolean
  align?: 'left' | 'right'
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
  if (!editable) {
    return (
      <span
        className={cn(
          'min-w-0 px-1 tabular-nums',
          touch ? 'text-[14px]' : 'text-[12.5px]',
          touch || multiline ? 'whitespace-pre-wrap [overflow-wrap:anywhere]' : 'truncate',
          align === 'right' && 'text-right',
          display ? 'text-foreground' : 'text-lps-dim',
        )}
        title={display || undefined}
      >
        {display || '—'}
      </span>
    )
  }
  const Control = multiline ? 'textarea' : 'input'
  return (
    <Control
      value={draft}
      aria-label={ariaLabel}
      placeholder={placeholder}
      inputMode={inputMode}
      rows={multiline ? 3 : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft.trim() !== value.trim()) onCommit(draft)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !multiline) e.currentTarget.blur()
      }}
      className={cn(
        touch
          ? 'min-h-11 w-full min-w-0 rounded-lg px-3 py-2 text-base outline-none placeholder:text-lps-dim'
          : 'h-7 w-full min-w-0 rounded-md px-1.5 text-[12.5px] outline-none placeholder:text-lps-dim',
        multiline && 'h-auto resize-y whitespace-pre-wrap [field-sizing:content] [overflow-wrap:anywhere]',
        multiline && !touch && 'min-h-7 py-1',
        plain
          ? 'border bg-transparent text-muted-foreground focus-visible:text-foreground'
          : 'border border-input bg-background focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50',
        plain && !attention && 'border-transparent hover:border-border focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
        align === 'right' && 'text-right tabular-nums',
      )}
      style={plain && attention ? { borderColor: PORTAL_PURPLE, maxWidth: 72, marginLeft: 'auto' } : undefined}
    />
  )
}

/**
 * What the pop-up collects for each answer, and the hint its notes carry.
 *
 * `available` is deliberately absent: it needs nothing asked, so picking it
 * writes straight through with the demand as the available quantity (see
 * `LineRow`). Price is not collected here at all — it arrives prefilled from
 * our own catalogue and is corrected in the table's own Price cell.
 */
const ANSWER_FIELDS: Record<
  string,
  {
    title: string
    /** Whether the answer needs a quantity of its own. */
    qty: boolean
    /** Wipe a quantity a previous answer left behind — nothing is available. */
    clearQty?: boolean
    /** Which field opens focused — the first thing this answer needs. */
    focus?: 'qty' | 'notes'
    notesLabel: string
    notesHint: string
  }
> = {
  can_order: {
    title: 'Can Order',
    qty: false,
    notesLabel: 'ETA / notes',
    notesHint: 'When can you have it? e.g. ready mid-Sep',
  },
  arriving_soon: {
    title: 'Arriving Soon',
    qty: false,
    notesLabel: 'Notes',
    notesHint: 'When it lands, and how many — e.g. 40 due the week of Sep 8',
  },
  diff_size_qty_sub: {
    title: 'Diff Sz/Qnty/Sub',
    // The answer covers a different size, a short quantity or another plant,
    // so it is the one that still needs a number: what you can actually supply.
    qty: true,
    // Naming what you have comes first; the quantity follows it.
    focus: 'notes',
    notesLabel: 'What instead',
    notesHint: 'Size, quantity or substitute — e.g. Muskogee Crape Myrtle, 30 G',
  },
  unavailable: {
    title: 'Unavailable',
    qty: false,
    clearQty: true,
    notesLabel: 'Notes (optional)',
    notesHint: 'Substitutes welcome — Name, Size @ price $/unit',
  },
}

/**
 * Collect notes and any supply quantity for a status answer. Unavailable first
 * asks whether the supplier wants to recommend a substitute; only Yes opens
 * the notes step. Prices are edited in the line's own Price cell.
 */
function StatusAnswerDialog({
  item,
  status,
  onCancel,
  onSave,
  drawerModal = false,
}: {
  item: ARItem
  status: string
  onCancel: () => void
  onSave: (changes: Record<string, string>) => void
  /** LPS Ops drawer only: isolate as a nested body modal with phone controls. */
  drawerModal?: boolean
}) {
  const spec = ANSWER_FIELDS[status]
  // Demand is the prefill: a short quantity is the common shape of this answer,
  // and correcting a number beats typing one.
  const [qty, setQty] = useState(
    item.availableQuantity != null
      ? String(item.availableQuantity)
      : item.demandedQuantity != null
        ? String(item.demandedQuantity)
        : '',
  )
  const [askingSubstitute, setAskingSubstitute] = useState(status === 'unavailable')
  const [notes, setNotes] = useState(item.noteFromSupplier ?? '')
  const [viewport, setViewport] = useState<{ top: number; height: number } | null>(null)
  const titleId = useId()
  const dialog = useRef<HTMLDivElement>(null)

  // Android/iOS keyboards resize and sometimes pan the visual viewport without
  // changing the layout viewport used by `position: fixed`. Pin the dialog to
  // the visible rectangle so its notes and actions stay reachable while typing.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setViewport({ top: vv.offsetTop, height: vv.height })
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  const save = () => {
    const changes: Record<string, string> = { status, note_from_supplier: notes.trim() }
    // An empty quantity clears the column, which is what `clearQty` wants and
    // what an emptied box on a Diff Sz/Qnty/Sub answer means too.
    if (spec.qty) changes.available_quantity = qty.trim()
    else if (spec.clearQty) changes.available_quantity = ''
    onSave(changes)
  }

  const field = cn(
    'h-9 rounded-md border border-input bg-background px-2 text-[13px] outline-none focus-visible:border-ring',
    drawerModal && 'max-[899px]:h-11 max-[899px]:text-base',
  )
  const label = 'text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground'

  const keepFocusInside = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!drawerModal) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onCancel()
      return
    }
    if (event.key !== 'Tab') return
    const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter(validModalFocusTarget)
    if (controls.length === 0) return
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) {
      event.preventDefault()
      first.focus()
    }
  }

  const surface = (
    <div
      className="fixed inset-x-0 top-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      style={{ top: viewport?.top ?? 0, height: viewport?.height ?? '100dvh' }}
      onClick={onCancel}
    >
      <div
        ref={dialog}
        role={drawerModal ? 'dialog' : undefined}
        aria-modal={drawerModal ? true : undefined}
        aria-labelledby={drawerModal ? titleId : undefined}
        onKeyDown={drawerModal ? keepFocusInside : undefined}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-[420px] flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-popover p-4 shadow-[var(--lps-shadow)]"
      >
        <div className="flex flex-col gap-0.5">
          <span id={drawerModal ? titleId : undefined} className="text-[14px] font-bold text-foreground">{spec.title}</span>
          <span className="text-[12px] text-muted-foreground [overflow-wrap:anywhere]">
            {num(item.demandedQuantity) || '—'} × {item.name}
            {item.size ? ` · ${item.size}` : ''}
          </span>
        </div>

        {askingSubstitute ? (
          <>
            <p className="text-[13px] text-foreground">Would you like to recommend a substitute?</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onSave({ status, available_quantity: '' })}
                className={cn(
                  'cursor-pointer rounded-full border border-border bg-card px-4 py-1.5 text-[12px] font-semibold text-foreground',
                  drawerModal && 'max-[899px]:min-h-11',
                )}
              >
                No
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => setAskingSubstitute(false)}
                className={cn(
                  'cursor-pointer rounded-full bg-primary px-4 py-1.5 text-[12px] font-bold text-primary-foreground',
                  drawerModal && 'max-[899px]:min-h-11',
                )}
              >
                Yes
              </button>
            </div>
          </>
        ) : (
          <>
            {spec.qty && (
              <label className="flex flex-col gap-0.5">
                <span className={label}>Quantity you can supply</span>
                <input
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  inputMode="decimal"
                  placeholder="Qty"
                  autoFocus={spec.focus !== 'notes'}
                  className={cn(field, 'text-right tabular-nums')}
                />
              </label>
            )}

            <label className="flex flex-col gap-0.5">
              <span className={label}>{spec.notesLabel}</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={spec.notesHint}
                rows={2}
                autoFocus={spec.focus === 'notes' || !spec.qty}
                className={cn(
                  'min-h-16 resize-none rounded-md border border-input bg-background px-2 py-1.5 text-[13px] outline-none placeholder:text-lps-dim focus-visible:border-ring',
                  drawerModal && 'max-[899px]:text-base',
                )}
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className={cn(
                  'cursor-pointer rounded-full border border-border bg-card px-4 py-1.5 text-[12px] font-semibold text-foreground',
                  drawerModal && 'max-[899px]:min-h-11',
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                className={cn(
                  'cursor-pointer rounded-full bg-primary px-4 py-1.5 text-[12px] font-bold text-primary-foreground',
                  drawerModal && 'max-[899px]:min-h-11',
                )}
              >
                Save answer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )

  return drawerModal ? (
    <BodyModalPortal hostAttribute="data-ar-answer-dialog-host">{surface}</BodyModalPortal>
  ) : surface
}

/**
 * A line's status picker with its answer pop-up — how a status is set anywhere
 * a line is answered (the request page, the By-item view). Picking a status
 * opens the pop-up rather than saving bare. Two answers write straight through
 * instead: clearing back to "Pending", and Available — "all of it, as
 * asked" needs nothing typed, so the demand becomes the available quantity.
 */
export function LineStatusPicker({
  item,
  editable,
  onPatch,
  portal = false,
  ariaLabel,
  touch = false,
  drawerModal = false,
}: {
  item: ARItem
  editable: boolean
  onPatch?: (itemId: number, changes: Record<string, string>) => Promise<void>
  /** Use the portal's themed listbox rather than the admin native select. */
  portal?: boolean
  ariaLabel?: string
  touch?: boolean
  /** Isolate the answer dialog and restore focus to its line control. */
  drawerModal?: boolean
}) {
  /** Which status the pop-up is collecting details for; null = closed. */
  const [answering, setAnswering] = useState<string | null>(null)
  const triggerHost = useRef<HTMLSpanElement>(null)
  const restoreFrame = useRef<number | null>(null)

  useEffect(() => () => {
    if (restoreFrame.current != null) cancelAnimationFrame(restoreFrame.current)
  }, [])

  const closeDrawerAnswer = () => {
    setAnswering(null)
    if (restoreFrame.current != null) cancelAnimationFrame(restoreFrame.current)
    restoreFrame.current = requestAnimationFrame(() => {
      restoreFrame.current = null
      const trigger = triggerHost.current?.querySelector<HTMLElement>('button, select')
      if (validModalFocusTarget(trigger)) trigger.focus()
      else {
        const parent = document.querySelector<HTMLElement>('[data-ar-drawer-host]')
        firstModalFocusTarget(parent ?? document.body)?.focus()
      }
    })
  }

  const response = (
    <ResponseSelect
      value={item.status}
      disabled={!editable}
      portal={portal}
      ariaLabel={ariaLabel}
      touch={touch}
      onChange={(next) => {
        if (!next) void onPatch?.(item.id, { status: '' })
        else if (next === 'available') {
          void onPatch?.(item.id, {
            status: 'available',
            available_quantity: item.demandedQuantity == null ? '' : String(item.demandedQuantity),
          })
        } else setAnswering(next)
      }}
    />
  )

  return (
    <>
      {drawerModal ? <span ref={triggerHost} className="contents">{response}</span> : response}
      {answering && (
        <StatusAnswerDialog
          item={item}
          status={answering}
          drawerModal={drawerModal}
          onCancel={drawerModal ? closeDrawerAnswer : () => setAnswering(null)}
          onSave={(changes) => {
            if (drawerModal) closeDrawerAnswer()
            else setAnswering(null)
            void onPatch?.(item.id, changes)
          }}
        />
      )}
    </>
  )
}

function LineRow({
  item,
  editable,
  onPatch,
  onPatchDetails,
  displayText = (text) => text,
  columns,
  minWidth,
  leading,
  design = 'default',
  drawerModal = false,
}: {
  item: ARItem
  editable: boolean
  onPatch?: (itemId: number, changes: Record<string, string>) => Promise<void>
  onPatchDetails?: (itemId: number, changes: Record<string, string>) => Promise<void>
  displayText?: (text: string) => string
  columns: string
  minWidth: number
  /** Rendered as the row's first cell when the table has a leading column. */
  leading?: ReactNode
  design?: LineTableDesign
  drawerModal?: boolean
}) {
  const portal = design === 'portal'
  const commit = (column: string) => (next: string) => {
    void onPatch?.(item.id, { [column]: next.trim() })
  }
  const editDetails = editable && onPatchDetails != null
  const detail = (column: string) => (next: string) => {
    void onPatchDetails?.(item.id, { [column]: next.trim() })
  }
  // The admin line table's row treatment: the answer's tone as a left accent
  // bar and a tint over the whole row, so a scanned table reads by colour.
  // An unanswered line is grey — pending is a real state, not an absence.
  const tone = arResponseTone(item.status)
  return (
    <div
      className="grid items-center gap-x-2 border-b border-lps-hair last:border-b-0"
      style={
        portal
          ? {
              gridTemplateColumns: columns,
              minWidth,
              minHeight: 72,
              padding: '14px 16px',
              // The comp's accent divider under a line that still needs a price.
              ...(editable && item.unitPrice == null ? { borderBottomColor: PORTAL_PURPLE } : {}),
            }
          : {
              gridTemplateColumns: columns,
              minWidth,
              minHeight: 56,
              padding: '7px 12px',
              borderLeft: `3px solid ${toneDot(tone)}`,
              background: toneTint(tone),
            }
      }
    >
      {leading}
      {editDetails ? (
        <AnswerCell value={item.demandedQuantity == null ? '' : String(item.demandedQuantity)} editable
          placeholder="Qty" display={num(item.demandedQuantity)} onCommit={detail('demanded_quantity')}
          ariaLabel={`Line ${item.id} requested quantity`} inputMode="decimal" />
      ) : <span className="px-1 text-[12.5px] font-semibold tabular-nums text-foreground">
        {num(item.demandedQuantity) || '—'}
      </span>}
      {editDetails ? (
        <AnswerCell value={item.size ?? ''} editable placeholder="Size" display={item.size ?? ''}
          onCommit={detail('size')} ariaLabel={`Line ${item.id} requested size`} />
      ) : <span className="truncate px-1 text-[12px] text-muted-foreground" title={item.size ?? undefined}>
        {item.size ?? '—'}
      </span>}
      <span className="min-w-0 px-1" title={item.name}>
        {editDetails ? <span className="flex flex-col gap-1">
          <AnswerCell value={item.name} editable placeholder="Plant name" display={item.name}
            onCommit={detail('name')} ariaLabel={`Line ${item.id} plant name`} />
          <AnswerCell value={item.noteForSupplier ?? ''} editable placeholder="Note to supplier…" display={item.noteForSupplier ?? ''}
            onCommit={detail('note_for_supplier')} ariaLabel={`Line ${item.id} note to supplier`} multiline plain />
        </span> : <span className="block truncate text-[13px] font-semibold text-foreground">{item.name}</span>}
        {/* LPS context stays below the plant; supplier details have their own column. */}
        {!editDetails && item.noteForSupplier && (
          <span
            className="block whitespace-pre-wrap text-[10.5px] text-muted-foreground [overflow-wrap:anywhere]"
            title={displayText(item.noteForSupplier)}
          >
            {displayText(item.noteForSupplier)}
          </span>
        )}
      </span>
      <div className="px-1">
        <LineStatusPicker
          item={item}
          editable={editable}
          onPatch={onPatch}
          portal={portal}
          drawerModal={drawerModal}
        />
      </div>
      <AnswerCell
        value={item.availableQuantity == null ? '' : String(item.availableQuantity)}
        editable={editable}
        align="right"
        placeholder={portal ? '—' : 'Qty'}
        display={num(item.availableQuantity)}
        onCommit={commit('available_quantity')}
        plain={portal}
      />
      <AnswerCell
        value={item.unitPrice == null ? '' : String(item.unitPrice)}
        editable={editable}
        align="right"
        placeholder={portal ? '-' : '$/unit'}
        display={money(item.unitPrice)}
        onCommit={commit('unit_price')}
        plain={portal}
        attention={portal && item.unitPrice == null}
      />
      {/* Quantity × price, never typed — an em dash until the answer carries
          both, so a half-answered line doesn't read as costing nothing. The
          portal drawing leaves it to the subtotal strip. */}
      {!portal && (
        <span className="truncate px-1 text-right text-[12.5px] font-semibold tabular-nums text-foreground">
          {money(arLineTotal(item)) || <span className="font-normal text-lps-dim">—</span>}
        </span>
      )}
      <AnswerCell
        value={item.noteFromSupplier ?? ''}
        editable={editable}
        placeholder={portal ? 'Add note…' : 'Substitute, ETA, conditions…'}
        display={item.noteFromSupplier ?? ''}
        onCommit={commit('note_from_supplier')}
        plain={portal}
        ariaLabel={`Line ${item.id} supplier notes`}
        multiline
      />
    </div>
  )
}

/**
 * The shared lines and their answers.
 *
 * `onPatch` writes supplier answers. The admin drawer also passes
 * `onPatchDetails` to correct the requested plant; suppliers see a read-only ask.
 * Callers own writing and refreshing through their respective routes.
 */
export function ARLineTable<T extends ARItem>({
  items,
  editable,
  onPatch,
  onPatchDetails,
  displayText,
  leadingHeader,
  renderLeading,
  design = 'default',
  mobileCards = false,
  drawerModal = false,
}: {
  items: T[]
  editable: boolean
  onPatch?: (itemId: number, changes: Record<string, string>) => Promise<void>
  /** Admin-only edits to the requested plant and LPS note. */
  onPatchDetails?: (itemId: number, changes: Record<string, string>) => Promise<void>
  /** Portal-only transform for LPS notes; admin callers leave it unset. */
  displayText?: (text: string) => string
  /** `portal`: no Line total column, no tone bars, no subtotal footer. */
  design?: LineTableDesign
  /** Render only the stacked phone cards; false preserves the exact table DOM. */
  mobileCards?: boolean
  /** Isolate answer dialogs and restore focus to the line control. */
  drawerModal?: boolean
  /**
   * One extra column in front of Need. Both parts go together — the header
   * names it, the renderer fills it per row. The By-item view uses it for the
   * job a line came from; a table of one request's lines has no need of it.
   */
  leadingHeader?: string
  renderLeading?: (item: T) => ReactNode
}) {
  const subtotal = arSubtotal(items)
  const portal = design === 'portal'
  const lead = leadingHeader != null && renderLeading != null
  const base = portal ? PORTAL_COLUMNS : LINE_COLUMNS
  const columns = lead ? `${LEAD_COLUMN} ${base}` : base
  const minWidth = (portal ? PORTAL_GRID_MIN : GRID_MIN) + (lead ? LEAD_MIN : 0)
  const mobile = (
    <div className="min-w-0 space-y-3" data-testid="availability-mobile-lines">
          {items.length === 0 && (
            <p className="m-0 rounded-xl border border-border bg-card px-3 py-4 text-[12.5px] text-muted-foreground">
              No lines on this request.
            </p>
          )}
          {items.map((item, index) => {
            const commit = (column: string) => (next: string) => {
              void onPatch?.(item.id, { [column]: next.trim() })
            }
            const lineName = `Line ${index + 1}, ${item.name}`
            const editDetails = editable && onPatchDetails != null
            const detail = (column: string) => (next: string) => {
              void onPatchDetails?.(item.id, { [column]: next.trim() })
            }
            const tone = arResponseTone(item.status)
            return (
              <article
                key={item.id}
                aria-label={lineName}
                className="min-w-0 overflow-hidden rounded-xl border border-border bg-card [overflow-wrap:anywhere]"
                style={portal ? undefined : { borderLeft: `3px solid ${toneDot(tone)}` }}
              >
                <div className="min-w-0 border-b border-lps-hair px-3 py-3" style={{ background: portal ? undefined : toneTint(tone) }}>
                  {lead && <div className="mb-2 min-w-0 text-[12px] text-muted-foreground">{renderLeading(item)}</div>}
                  {editDetails ? <div className="grid min-w-0 grid-cols-2 gap-3">
                    <label className="col-span-2 flex min-w-0 flex-col gap-1">
                      <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">Plant name</span>
                      <AnswerCell value={item.name} editable placeholder="Plant name" display={item.name}
                        onCommit={detail('name')} ariaLabel={`${lineName} plant name`} touch />
                    </label>
                    <label className="col-span-2 flex min-w-0 flex-col gap-1">
                      <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">Note to supplier</span>
                      <AnswerCell value={item.noteForSupplier ?? ''} editable placeholder="Note to supplier…" display={item.noteForSupplier ?? ''}
                        onCommit={detail('note_for_supplier')} ariaLabel={`${lineName} note to supplier`} multiline plain touch />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1">
                      <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">Requested size</span>
                      <AnswerCell value={item.size ?? ''} editable placeholder="Size" display={item.size ?? ''}
                        onCommit={detail('size')} ariaLabel={`${lineName} requested size`} touch />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1">
                      <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">Requested qty</span>
                      <AnswerCell value={item.demandedQuantity == null ? '' : String(item.demandedQuantity)} editable
                        placeholder="Qty" display={num(item.demandedQuantity)} onCommit={detail('demanded_quantity')}
                        ariaLabel={`${lineName} requested quantity`} inputMode="decimal" touch />
                    </label>
                  </div> : <>
                    <p className="m-0 break-words text-[15px] font-bold leading-5 text-foreground">{item.name}</p>
                    {item.noteForSupplier && (
                      <p className="m-0 mt-2 break-words text-[12px] leading-5 text-muted-foreground">
                        <span className="mr-1 font-bold text-foreground">LPS note:</span>
                        {displayText?.(item.noteForSupplier) ?? item.noteForSupplier}
                      </p>
                    )}
                    <p className="m-0 mt-0.5 break-words text-[12px] text-muted-foreground">
                      Need {num(item.demandedQuantity) || '—'}{item.size ? ` · ${item.size}` : ''}
                    </p>
                  </>}
                </div>
                <div className="grid min-w-0 grid-cols-2 gap-3 p-3">
                  <label className="col-span-2 flex min-w-0 flex-col gap-1">
                    <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">Status</span>
                    <span className="relative flex min-h-11 items-center">
                      <LineStatusPicker
                        item={item}
                        editable={editable}
                        onPatch={onPatch}
                        ariaLabel={`${lineName} status`}
                        touch
                        portal={portal}
                        drawerModal={drawerModal}
                      />
                    </span>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">Available qty</span>
                    <AnswerCell
                      value={item.availableQuantity == null ? '' : String(item.availableQuantity)}
                      editable={editable}
                      align="right"
                      placeholder="Qty"
                      display={num(item.availableQuantity)}
                      onCommit={commit('available_quantity')}
                      ariaLabel={`${lineName} available quantity`}
                      inputMode="decimal"
                      touch
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">Price</span>
                    <AnswerCell
                      value={item.unitPrice == null ? '' : String(item.unitPrice)}
                      editable={editable}
                      align="right"
                      placeholder="$/unit"
                      display={money(item.unitPrice)}
                      onCommit={commit('unit_price')}
                      ariaLabel={`${lineName} price per unit`}
                      inputMode="decimal"
                      touch
                    />
                  </label>
                  <label className="col-span-2 flex min-w-0 flex-col gap-1">
                    <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">Note from supplier</span>
                    <AnswerCell
                      value={item.noteFromSupplier ?? ''}
                      editable={editable}
                      placeholder="Substitute, ETA, conditions…"
                      display={item.noteFromSupplier ?? ''}
                      onCommit={commit('note_from_supplier')}
                      ariaLabel={`${lineName} supplier notes`}
                      multiline
                      touch
                    />
                  </label>
                  {!portal && <div className="col-span-2 flex items-center justify-between gap-3 border-t border-lps-hair pt-2 text-[12px]">
                    <span className="font-bold uppercase tracking-[.04em] text-muted-foreground">Line total</span>
                    <span className="font-bold tabular-nums text-foreground">{money(arLineTotal(item)) || '—'}</span>
                  </div>}
                </div>
              </article>
            )
          })}
          {items.length > 0 && !portal && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-lps-headrow px-3 py-2.5 text-[12px]">
              <span className="font-bold uppercase tracking-[.04em] text-muted-foreground">Subtotal</span>
              <span className="font-bold tabular-nums text-foreground">{money(subtotal) || '—'}</span>
            </div>
        )}
      </div>
  )
  if (mobileCards) return mobile

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-auto rounded-xl border border-border bg-card">
      <div
        className={cn(
          'grid items-center gap-x-2 border-b border-border text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground',
          !portal && 'bg-lps-headrow',
        )}
        style={{ gridTemplateColumns: columns, minWidth, padding: portal ? '16px 16px 14px' : '8px 12px' }}
      >
        {lead && <span className="px-1">{leadingHeader}</span>}
        <span className="px-1">Need</span>
        <span className="px-1">Size</span>
        <span className="px-1">Plant</span>
        <span className="px-1">Status</span>
        <span className="px-1 text-right">Avail qty</span>
        <span className="px-1 text-right">Price</span>
        {!portal && <span className="px-1 text-right">Line total</span>}
        <span className="px-1">Note from supplier</span>
      </div>
      {items.length === 0 && (
        <p className="px-3 py-4 text-[12.5px] text-muted-foreground">
          No lines on this request.
        </p>
      )}
      {items.map((item) => (
        <LineRow
          key={item.id}
          item={item}
          editable={editable}
          onPatch={onPatch}
          onPatchDetails={onPatchDetails}
          displayText={displayText}
          columns={columns}
          minWidth={minWidth}
          leading={lead ? renderLeading(item) : undefined}
          design={design}
          drawerModal={drawerModal}
        />
      ))}
        {items.length > 0 && !portal && (
          <div
            className="grid items-center gap-x-2 border-t border-border bg-lps-headrow"
            style={{ gridTemplateColumns: columns, minWidth, padding: '8px 12px' }}
          >
            {/* The label spans everything up to Line total, so it still sits
                directly under Price whether or not there is a leading column. */}
            <span
              className="px-1 text-right text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground"
              style={{ gridColumn: lead ? '1 / 8' : '1 / 7' }}
            >
              Subtotal
            </span>
            <span className="px-1 text-right text-[13px] font-bold tabular-nums text-foreground">
              {money(subtotal) || '—'}
            </span>
          </div>
        )}
    </div>
  )
}
