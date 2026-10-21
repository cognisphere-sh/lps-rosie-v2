'use client'

// The pieces of an availability request that two apps draw: the supplier
// portal (where the lines are answered) and the admin supplier profile (where
// the answers are read). Nothing here knows which side it is on beyond the
// `editable` prop on the line table.

import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import {
  AR_RESPONSES,
  AR_RESPONSE_META,
  AR_ANSWER_OPTIONS,
  arAnswerOption,
  AR_STATUSES,
  arLineTotal,
  arResponseLabel,
  arShownStatus,
  arResponseTone,
  arStatusLabel,
  arStatusTone,
  arSubtotal,
  isUnpriced,
  type ARAlternative,
  type ARItem,
} from '@/lib/availability'
import { BodyModalPortal, firstModalFocusTarget, validModalFocusTarget } from '@/components/workspace/body-modal-portal'
import { EditableText, EditableTextarea } from '@/components/workspace/editable'
import { LineCard } from '@/components/workspace/line-card'
import { CheckIcon, ChevronDown } from '@/components/workspace/icons'
import { AnswerCell, PORTAL_PURPLE } from '@/components/workspace/answer-cell'
import { money, num } from '@/lib/format'
import { toneDot, toneStyle, toneTint, type Tone } from '@/lib/job-requests'
import { lineCardName } from '@/lib/line-card'
import { cn } from '@/lib/utils'
import { reorder } from '@/lib/table-config'

export { AnswerCell }

const AR_COLUMN_KEYS = ['need', 'avail', 'size', 'plant', 'status', 'note', 'unit_price', 'line_total'] as const
type ARColumnKey = (typeof AR_COLUMN_KEYS)[number]
const AR_COLUMN_LABELS: Record<ARColumnKey, string> = {
  need: 'Need', avail: 'Avail qty', size: 'Size', plant: 'Plant',
  status: 'Status', note: 'Note', unit_price: 'Unit price', line_total: 'Line total',
}
const AR_COLUMN_MIN: Record<ARColumnKey, number> = {
  need: 56, avail: 68, size: 72, plant: 88, status: 110, note: 160, unit_price: 90, line_total: 90,
}
const AR_LAYOUT_KEY = 'lps.ar.columns.v1'
type ARLayout = { order: ARColumnKey[]; widths: Partial<Record<ARColumnKey, number>> }
const defaultARLayout = (): ARLayout => ({ order: [...AR_COLUMN_KEYS], widths: {} })

function readARLayout(): ARLayout {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(AR_LAYOUT_KEY) ?? 'null')
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return defaultARLayout()
    const candidate = saved as Partial<ARLayout>
    const order = Array.isArray(candidate.order)
      ? candidate.order.filter((key): key is ARColumnKey => AR_COLUMN_KEYS.includes(key as ARColumnKey))
      : []
    const widths = Object.fromEntries(Object.entries(candidate.widths ?? {}).filter(([key, width]) =>
      AR_COLUMN_KEYS.includes(key as ARColumnKey) && typeof width === 'number' && Number.isFinite(width),
    )) as ARLayout['widths']
    return { order: [...new Set(order), ...AR_COLUMN_KEYS.filter((key) => !order.includes(key))], widths }
  } catch { return defaultARLayout() }
}

/** Measure the rendered plant text, including wide Unicode characters. */
function measurePlantWidth(items: ARItem[]): number {
  const probe = document.createElement('span')
  probe.className = 'text-[13px] font-semibold'
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none'
  document.body.append(probe)
  let width = 88
  for (const item of items) {
    probe.textContent = item.name
    const measured = probe.getBoundingClientRect().width
    // JSDOM has no text layout; the estimate also covers the first server render.
    const estimate = [...item.name].reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 14 : /[MW]/.test(char) ? 11 : 7.5), 0)
    width = Math.max(width, Math.ceil((measured || estimate) + 24))
  }
  probe.remove()
  return width
}

// A caller may put one column of its own in front of Need — the By-item view
// uses it for the job a line came from, because there a table holds lines from
// several requests at once. Everything after it stays exactly as it is here,
// so the two tables are the same table.
const LEAD_COLUMN = '210px'
/** The focused `/jobs` drawer opts into the portal drawing; other admin callers keep the default. */
type LineTableDesign = 'default' | 'portal'

function ARColumnHeader({ column, width, onMove, onResize, centerStatus = false }: {
  column: ARColumnKey
  width: number
  centerStatus?: boolean
  onMove: (from: ARColumnKey, to: ARColumnKey) => void
  onResize: (column: ARColumnKey, width: number) => void
}) {
  const label = AR_COLUMN_LABELS[column]
  const startResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startWidth = event.currentTarget.parentElement?.getBoundingClientRect().width || width
    const move = (next: MouseEvent) => onResize(column, startWidth + next.clientX - startX)
    const stop = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', stop)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', stop)
  }
  return (
    <div className={cn('relative min-w-0 px-1', (['need', 'avail'].includes(column) || (centerStatus && column === 'status')) && 'text-center', ['unit_price', 'line_total'].includes(column) && 'text-right')}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }}
      onDrop={(event) => {
        event.preventDefault()
        const from = event.dataTransfer.getData('text/plain') as ARColumnKey
        if (AR_COLUMN_KEYS.includes(from) && from !== column) onMove(from, column)
      }}
    >
      <span draggable onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', column)
        event.dataTransfer.effectAllowed = 'move'
      }} title={`${label} — drag to reorder`} className="block cursor-grab truncate active:cursor-grabbing">{label}</span>
      <div role="separator" aria-label={`Resize ${label}`} aria-orientation="vertical"
        onMouseDown={startResize}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-lps-edge" />
    </div>
  )
}


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
        'relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors duration-150 ease-lps',
        onChange && 'cursor-pointer',
        touch && 'min-h-11 min-[900px]:min-h-0',
      )}
      style={toneStyle(arStatusTone(status))}
    >
      <span className="size-1.5 rounded-full" style={{ background: toneDot(arStatusTone(status)) }} />
      {arStatusLabel(status)}
      {/* Drafts leave through Publish. Published requests can return to Draft. */}
      {onChange && status !== 'draft' && (
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
    const status = arShownStatus(item)
    if (status) counts[status] = (counts[status] ?? 0) + 1
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
      <div className="grid min-w-[900px] grid-cols-[repeat(7,minmax(92px,1fr))_minmax(92px,1fr)_minmax(118px,1.15fr)] divide-x divide-lps-hair">
        {states.map((state) => (
          <div key={state.label} className={cn('flex flex-col gap-0.5 px-3 py-2', state.count === 0 && 'opacity-45')}>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">
              <span className="size-1.5 flex-none rounded-full" style={{ background: toneDot(state.tone) }} />
              {state.label}
            </span>
            <span className="text-[13px] font-bold tabular-nums text-foreground">{state.count}</span>
          </div>
        ))}
        <div className="flex flex-col gap-0.5 px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">Lines</span>
          <span className="text-[13px] font-bold tabular-nums text-foreground">{items.length}</span>
        </div>
        <div className="flex flex-col gap-0.5 px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">Subtotal</span>
          <span className="text-[13px] font-bold tabular-nums text-foreground">
            {money(arSubtotal(items)) || '—'}
          </span>
        </div>
      </div>
    </div>
  )
}

/** Where a message actually happened — portal, email, text, or internal. */
/** The picker's answers followed by Pending (NULL). */
const RESPONSE_PICKER_OPTIONS = AR_ANSWER_OPTIONS

/**
 * The supplier portal's dark, compact replacement for a native opened select.
 * It is portalled out of the scrolling table so the choice surface cannot be
 * clipped, while retaining ordinary listbox keyboard and touch interaction.
 */
function PortalResponseSelect({
  value,
  shown = value,
  onChange,
  ariaLabel = 'Line status',
  touch = false,
  drawerModal = false,
  pill = false,
}: {
  value: string | null
  /** What the trigger reads as (Unavailable with a substitute reads Diff Sz/Sub). */
  shown?: string | null
  onChange: (next: string) => void
  ariaLabel?: string
  touch?: boolean
  /** The job line card's tinted status pill, on a 44px target. */
  pill?: boolean
  /** Mount the menu inside the drawer's modal host, which is not made inert. */
  drawerModal?: boolean
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const optionId = useId()
  const selectedIndex = Math.max(0, RESPONSE_PICKER_OPTIONS.findIndex((option) => option.value === (value ?? '')))
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(selectedIndex)
  const [position, setPosition] = useState({ left: 8, top: 8, width: 196, maxHeight: 228 })
  const [menuUp, setMenuUp] = useState(false)
  const typeahead = useRef('')
  const typeaheadAt = useRef(0)
  const typeaheadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const frames = useRef(new Set<number>())
  const tone = arResponseTone(shown)

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
    setMenuUp(preferredTop !== below)
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
    // Unavailable and Diff Sz/Sub reopen the substitute dialog, so a
    // substitute can be added or changed; Can Order/Arriving Soon, so the
    // other of the two can be picked.
    if ((next || null) !== value || next === 'unavailable' || next === 'diff_size_sub' || next === 'can_order') onChange(next)
    // Follow-up answers mount an autofocus dialog; do not steal focus back
    // from it. The direct actions return focus to the line trigger.
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
        aria-label={`${ariaLabel}, ${arResponseLabel(shown)}`}
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
          pill
            ? 'inline-flex min-h-11 max-w-full min-w-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring'
            : 'inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 font-medium text-muted-foreground outline-none transition-colors duration-150 ease-lps hover:bg-secondary focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          !pill && (touch ? 'min-h-11 w-full justify-between text-[14px]' : 'min-h-8 text-[12px]'),
        )}
        style={shown && !pill ? { color: toneDot(tone) } : undefined}
        title={arResponseLabel(shown)}
      >
        {pill ? <ARTonePill tone={tone} label={arResponseLabel(shown)} chevron /> : (
          <>
            {!shown && <span aria-hidden="true" className="text-[11px] tracking-[.1em] text-lps-dim">···</span>}
            <span className="min-w-0 truncate">{arResponseLabel(shown)}</span>
            <ChevronDown aria-hidden="true" className="size-3 shrink-0 opacity-70" />
          </>
        )}
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menu}
          id={`${optionId}-listbox`}
          role="listbox"
          aria-label={ariaLabel}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className={cn('lps-pop fixed z-[100] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-[var(--lps-shadow)]', menuUp ? 'lps-pop-up' : 'lps-pop-down')}
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
                  'flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-[12px] font-semibold outline-none transition-colors duration-150 hover:bg-secondary focus-visible:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/50',
                  touch && 'min-h-11 text-[14px]',
                  selected && 'bg-secondary',
                )}
              >
                <span aria-hidden="true" className="size-1.5 flex-none rounded-full" style={{ background: toneDot(optionTone) }} />
                <span>{option.label}</span>
                {selected && <span aria-hidden="true" className="ml-auto flex text-primary"><CheckIcon size={14} /></span>}
              </div>
            )
          })}
        </div>,
        (drawerModal && trigger.current?.closest<HTMLElement>('[data-ar-drawer-host]')) || document.body,
      )}
    </>
  )
}

/** The job line card's status pill, drawn for an AR line's answer. */
function ARTonePill({ tone, label, chevron }: { tone: Tone; label: string; chevron: boolean }) {
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold transition-colors duration-150 ease-lps" style={toneStyle(tone)}>
      <span className="size-[7px] flex-none rounded-full transition-colors duration-150 ease-lps" style={{ background: toneDot(tone) }} />
      <span className="min-w-0 truncate">{label}</span>
      {chevron && <ChevronDown size={10} className="flex-none" />}
    </span>
  )
}

/**
 * The supplier's per-line answer, as a pill-styled picker. Admin surfaces keep
 * their existing native control; only the portal uses the custom dark listbox.
 */
function ResponseSelect({
  value,
  shown = value,
  disabled,
  onChange,
  portal = false,
  ariaLabel = 'Line status',
  touch = false,
  drawerModal = false,
  pill = false,
}: {
  value: string | null
  shown?: string | null
  disabled: boolean
  onChange: (next: string) => void
  portal?: boolean
  ariaLabel?: string
  touch?: boolean
  drawerModal?: boolean
  pill?: boolean
}) {
  const tone = arResponseTone(shown)
  if (portal && !disabled) return <PortalResponseSelect value={value} shown={shown} onChange={onChange} ariaLabel={ariaLabel} touch={touch} drawerModal={drawerModal} pill={pill} />
  if (pill) {
    return (
      <span className="relative inline-flex min-h-11 max-w-full min-w-0 items-center justify-center">
        <ARTonePill tone={tone} label={arResponseLabel(shown)} chevron={!disabled} />
        {!disabled && (
          <select aria-label={ariaLabel} value={value ?? ''} onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0">
            {AR_ANSWER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </span>
    )
  }
  return (
    <span
      className={cn(
        'relative inline-flex max-w-full min-w-0 items-center gap-1.5 transition-colors duration-150 ease-lps',
        portal
          ? 'min-h-8 rounded-full border border-border bg-secondary/60 px-3 text-[12px] font-medium text-muted-foreground'
          : cn('rounded-full px-2.5 py-1 text-[11px] font-bold', touch && 'min-h-11'),
        !disabled && 'cursor-pointer',
      )}
      style={portal ? (shown ? { color: toneDot(tone) } : undefined) : toneStyle(tone)}
      title={portal ? arResponseLabel(shown) : undefined}
    >
      {portal ? (
        !shown && <span className="text-[11px] tracking-[.1em] text-lps-dim">···</span>
      ) : (
        <span className="size-1.5 rounded-full" style={{ background: toneDot(tone) }} />
      )}
      <span className={portal ? 'min-w-0 truncate' : undefined}>{arResponseLabel(shown)}</span>
      {portal && <ChevronDown className="size-3 shrink-0 opacity-70" />}
      {!disabled && (
        <select
          aria-label={ariaLabel}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {AR_ANSWER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </span>
  )
}

/**
 * What the pop-up collects for each answer, and the hint its notes carry.
 *
 * `available` is deliberately absent: it needs nothing asked, so picking it
 * writes straight through with the demand as the available quantity (see
 * `LineRow`), and neither does `unavailable`. Diff Sz/Sub collects only a
 * substitute — one of this line's other candidates (a radio) or "Something
 * else" typed, which is also its note; the substitute carries its own price and quantity. Price is
 * corrected in the table's own Price cell.
 */
const ANSWER_FIELDS: Record<
  string,
  {
    title: string
    /** Whether the answer needs a quantity of its own. */
    qty: boolean
    /** Offer a substitute instead (Diff Sz/Sub). */
    offer?: boolean
    /** Which field opens focused — the first thing this answer needs. */
    focus?: 'qty' | 'notes'
    notesLabel: string
    notesHint: string
  }
> = {
  can_order: {
    title: 'Can Order / Arriving Soon',
    qty: false,
    notesLabel: 'ETA / notes',
    notesHint: 'When can you have it? e.g. ready mid-Sep',
  },
  arriving_soon: {
    title: 'Can Order / Arriving Soon',
    qty: false,
    notesLabel: 'Notes',
    notesHint: 'When it lands, and how many — e.g. 40 due the week of Sep 8',
  },
  partial_qty: {
    title: 'Partial Qty',
    // The asked plant and size, just fewer of them: how many is the answer.
    qty: true,
    focus: 'qty',
    notesLabel: 'Notes (optional)',
    notesHint: 'e.g. rest ready in 3 weeks',
  },
  diff_size_sub: {
    title: 'Diff Sz / Sub',
    qty: false,
    offer: true,
    notesLabel: 'Note (optional)',
    notesHint: 'e.g. 5 G NA, 3 G only',
  },
}

/** Answers picked under one option; the dialog asks which (radios). */
const ANSWER_CHOICES: Record<string, { value: string; label: string }[]> = {
  can_order: [{ value: 'can_order', label: 'Can Order' }, { value: 'arriving_soon', label: 'Arriving Soon' }],
}
ANSWER_CHOICES.arriving_soon = ANSWER_CHOICES.can_order

/**
 * Collect notes and any supply quantity for a status answer. Diff Sz/Sub
 * asks for a substitute: pick one of the line's other candidates, or
 * "Something else" and type it (the text is the note; there is no separate
 * note field). The first option, **No Sub**, is a red button that saves plain
 * Unavailable at once; Submit is enabled once a substitute is chosen. On save the line
 * reads Diff Sz/Sub (the asked candidate is stored Unavailable) and the
 * substitute is its own Diff Sz/Sub candidate, whose answer the row then shows
 * (a typed one is created unpriced, for Rosie to enrich).
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
  // Can Order/Arriving Soon: which of the two, starting from the one picked.
  const [chosen, setChosen] = useState(status)
  const choices = ANSWER_CHOICES[status]
  const spec = ANSWER_FIELDS[chosen]
  // Demand is the prefill: a short quantity is the common shape of this answer,
  // and correcting a number beats typing one.
  const [qty, setQty] = useState(
    item.availableQuantity != null
      ? String(item.availableQuantity)
      : item.demandedQuantity != null
        ? String(item.demandedQuantity)
        : '',
  )
  const alternatives = item.alternatives ?? []
  const substituting = !!spec.offer
  // A typed substitute also has a candidate id (the one made for it); it is
  // re-sent as text so the database keeps that same candidate.
  const [offerId, setOfferId] = useState<number | null>(item.offerDescription ? null : item.offeredCandidateId ?? null)
  const [typing, setTyping] = useState(!!item.offerDescription)
  const [offerText, setOfferText] = useState(item.offerDescription ?? '')
  const [notes, setNotes] = useState(item.noteFromSupplier ?? '')
  const hasSubstitute = offerId != null || (typing && !!offerText.trim())
  const choiceName = useId()

  // One choice at a time. Diff Sz/Sub has no note field: a picked
  // candidate writes a customer-ready note, and "Something else" is the note.
  const pickTag = (alt: ARAlternative) => {
    setOfferId(alt.id)
    setTyping(false)
    const asked = item.size || item.name
    setNotes(`${asked} NA, ${alt.description} only`)
  }
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

  // Diff Sz/Sub's No Sub: plain Unavailable (the database zeroes the
  // quantity and keeps the price), dropping any earlier substitute.
  const noSub = () => onSave({ status: 'unavailable', offered_candidate_id: '', offer_description: '' })

  const save = () => {
    if (substituting && hasSubstitute) {
      // The database stores this line Unavailable and the substitute as its
      // own Diff Sz/Sub row, at its own price and the demanded quantity; the
      // note goes to the substitute.
      onSave(offerId != null
        ? { status: 'diff_size_sub', offered_candidate_id: String(offerId), note_from_supplier: notes.trim() }
        : { status: 'diff_size_sub', offered_candidate_id: '', offer_description: offerText.trim(), note_from_supplier: offerText.trim() })
      return
    }
    const changes: Record<string, string> = { status: chosen, note_from_supplier: notes.trim() }
    if (spec.qty) changes.available_quantity = qty.trim()
    onSave(changes)
  }

  const field = cn(
    'h-9 rounded-md border border-input bg-background px-2 text-[13px] outline-none focus-visible:border-ring',
    drawerModal && 'max-[899px]:h-11 max-[899px]:text-base',
  )
  const label = 'text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground'

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
      className="lps-scrim fixed inset-x-0 top-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
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
        className="lps-pop lps-pop-dialog flex max-h-full w-full max-w-[420px] flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-popover p-4 shadow-[var(--lps-shadow)]"
      >
        <div className="flex flex-col gap-0.5">
          <span id={drawerModal ? titleId : undefined} className="text-[14px] font-bold text-foreground">{spec.title}</span>
          <span className="text-[12px] text-muted-foreground [overflow-wrap:anywhere]">
            {num(item.demandedQuantity) || '—'} × {item.name}
            {item.size ? ` · ${item.size}` : ''}
          </span>
        </div>

        {choices && (
          <div role="radiogroup" aria-label={spec.title} className="flex flex-col gap-1">
            {choices.map((choice) => (
              <label
                key={choice.value}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-[13px] transition-colors duration-150 ease-lps',
                  chosen === choice.value ? 'border-primary bg-lps-tint' : 'border-border bg-card',
                  drawerModal && 'max-[899px]:min-h-11',
                )}
              >
                <input
                  type="radio"
                  name={choiceName}
                  checked={chosen === choice.value}
                  onChange={() => setChosen(choice.value)}
                  autoFocus={choice.value === status}
                  className="size-4 flex-none cursor-pointer accent-[var(--primary)]"
                />
                <span className="min-w-0 flex-1">{choice.label}</span>
              </label>
            ))}
          </div>
        )}
        {substituting && (
          <button
            type="button"
            onClick={noSub}
            autoFocus
            className={cn(
              // The tone red, not --destructive: the dark theme's destructive is a brown-orange.
              'cursor-pointer self-start rounded-full bg-[var(--lps-tone-red-dot)] px-4 py-1.5 text-[12px] font-bold text-white transition-[opacity,transform,scale] duration-100 ease-lps hover:opacity-90 active:scale-[.97]',
              drawerModal && 'max-[899px]:min-h-11',
            )}
          >
            No Sub
          </button>
        )}
        {substituting && (
          <div role="group" aria-label="Substitute" className="flex flex-col gap-1">
            <span className={label}>Can you offer a substitute?</span>
            {alternatives.map((alt) => (
              <label
                key={alt.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-[13px] transition-colors duration-150 ease-lps',
                  offerId === alt.id ? 'border-primary bg-lps-tint' : 'border-border bg-card',
                  drawerModal && 'max-[899px]:min-h-11',
                )}
              >
                <input type="radio" name={choiceName} checked={offerId === alt.id} onChange={() => pickTag(alt)} className="size-4 flex-none cursor-pointer accent-[var(--primary)]" />
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{alt.description}</span>
                {alt.unitPrice != null && <span className="flex-none tabular-nums text-muted-foreground">{money(alt.unitPrice)}</span>}
              </label>
            ))}
            <div
              className={cn(
                'flex flex-col gap-1 rounded-md border px-2.5 py-1.5 text-[13px] transition-colors duration-150 ease-lps',
                typing ? 'border-primary bg-lps-tint' : 'border-border bg-card',
              )}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name={choiceName}
                  aria-label="Something else"
                  checked={typing}
                  onChange={() => { setTyping(true); setOfferId(null) }}
                  className="size-4 flex-none cursor-pointer accent-[var(--primary)]"
                />
                <input
                  value={offerText}
                  aria-label="Something else"
                  aria-describedby={`${choiceName}-hint`}
                  onFocus={() => { setTyping(true); setOfferId(null) }}
                  onChange={(e) => { setOfferText(e.target.value); setTyping(true); setOfferId(null) }}
                  placeholder="Something else…"
                  className={cn(field, 'min-w-0 flex-1')}
                />
              </div>
              <span id={`${choiceName}-hint`} className="pl-6 text-[11px] text-muted-foreground">
                Plant and size you can supply, plus anything we should know — e.g. Muskogee Crape Myrtle 30 G, ready in 2 weeks
              </span>
            </div>
          </div>
        )}
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

        {!substituting && <label className="flex flex-col gap-0.5">
          <span className={label}>{spec.notesLabel}</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={spec.notesHint}
            rows={2}
            autoFocus={!substituting && !choices && (spec.focus === 'notes' || !spec.qty)}
            className={cn(
              'min-h-16 resize-none rounded-md border border-input bg-background px-2 py-1.5 text-[13px] outline-none placeholder:text-lps-dim focus-visible:border-ring',
              drawerModal && 'max-[899px]:text-base',
            )}
          />
        </label>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              'cursor-pointer rounded-full border border-border bg-card px-4 py-1.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted',
              drawerModal && 'max-[899px]:min-h-11',
            )}
          >
            Cancel
          </button>
          {/* Diff Sz/Sub: Submit once a substitute is chosen (No Sub saves on its own). */}
          <button
            type="button"
            onClick={save}
            disabled={substituting && !hasSubstitute}
            className={cn(
              'cursor-pointer rounded-full bg-primary px-4 py-1.5 text-[12px] font-bold text-primary-foreground transition-[opacity,transform,scale] duration-100 ease-lps enabled:active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50',
              drawerModal && 'max-[899px]:min-h-11',
            )}
          >
            {substituting ? 'Submit' : 'Save answer'}
          </button>
        </div>
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
  pill = false,
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
  /** Draw the trigger as the job line card's status pill. */
  pill?: boolean
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
      value={arAnswerOption(item)}
      shown={arShownStatus(item)}
      disabled={!editable}
      portal={portal}
      ariaLabel={ariaLabel}
      touch={touch}
      drawerModal={drawerModal}
      pill={pill}
      onChange={(next) => {
        if (!next) void onPatch?.(item.id, { status: '' })
        // The database sets an Available line's quantity to its demand.
        else if (next === 'available') void onPatch?.(item.id, { status: 'available' })
        else if (next === 'unavailable') {
          // The same substitute dialog Diff Sz/Sub opens (2026-10-07): its red
          // No Sub saves plain Unavailable, or a substitute can be offered.
          setAnswering('diff_size_sub')
        } else setAnswering(next === 'can_order' && item.status === 'arriving_soon' ? item.status : next)
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
  order,
  minWidth,
  leading,
  design = 'default',
  drawerModal = false,
  centerStatus = false,
}: {
  item: ARItem
  editable: boolean
  onPatch?: (itemId: number, changes: Record<string, string>) => Promise<void>
  onPatchDetails?: (itemId: number, changes: Record<string, string>) => Promise<void>
  displayText?: (text: string) => string
  columns: string
  order: ARColumnKey[]
  minWidth: number
  /** Rendered as the row's first cell when the table has a leading column. */
  leading?: ReactNode
  design?: LineTableDesign
  drawerModal?: boolean
  centerStatus?: boolean
}) {
  const portal = design === 'portal'
  const commit = (column: string) => (next: string) => {
    void onPatch?.(item.id, { [column]: next.trim() })
  }
  const editDetails = editable && onPatchDetails != null
  const detail = (column: string) => (next: string) => {
    void onPatchDetails?.(item.id, { [column]: next.trim() })
  }
  const availableQuantity = (
    <AnswerCell
      value={item.availableQuantity == null ? '' : String(item.availableQuantity)}
      editable={editable}
      align="center"
      placeholder={portal ? '—' : 'Qty'}
      display={num(item.availableQuantity)}
      onCommit={commit('available_quantity')}
      plain={portal}
      ariaLabel={`Line ${item.id} available quantity`}
    />
  )
  // Two notes: LPS's ask (admins edit it; suppliers read it) and the
  // supplier's reply (suppliers write it; admins may record one for them).
  const askNote = displayText?.(item.noteForSupplier ?? '') ?? item.noteForSupplier ?? ''
  const askNoteBlock = editDetails ? (
    <AnswerCell value={item.noteForSupplier ?? ''} editable placeholder="Note for supplier…" display={askNote}
      onCommit={detail('note_for_supplier')} plain={portal} ariaLabel={`Line ${item.id} note for supplier`} multiline
      className={portal ? 'text-[12px] leading-4' : undefined} />
  ) : askNote ? (
    <span className={cn('whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]', portal ? 'block text-[12px] font-normal leading-4' : 'px-1 text-[11px] italic')} title={askNote}>{askNote}</span>
  ) : null
  // The portal draws LPS's ask under the plant name it is about (2026-10-07),
  // smaller, leaving the notes column to the supplier's reply. The admin
  // table keeps both notes together in its notes column.
  const supplierNote = (
    <div className="flex min-w-0 flex-col gap-0.5">
      {!portal && askNoteBlock}
      <AnswerCell
        value={item.noteFromSupplier ?? ''}
        editable={editable}
        placeholder={portal ? 'Add note…' : 'Supplier reply: substitute, ETA…'}
        display={item.noteFromSupplier ?? ''}
        onCommit={commit('note_from_supplier')}
        plain={portal}
        ariaLabel={`Line ${item.id} supplier reply`}
        multiline
        clamp={portal}
      />
    </div>
  )
  // The admin line table's row treatment: the answer's tone as a left accent
  // bar and a tint over the whole row, so a scanned table reads by colour.
  // An unanswered line is grey — pending is a real state, not an absence.
  const tone = arResponseTone(arShownStatus(item))
  const unpriced = isUnpriced(item)
  const cells: Record<ARColumnKey, ReactNode> = {
    need: editDetails ? (
      <AnswerCell value={item.demandedQuantity == null ? '' : String(item.demandedQuantity)} editable align="center"
        placeholder="Qty" display={num(item.demandedQuantity)} onCommit={detail('demanded_quantity')}
        ariaLabel={`Line ${item.id} requested quantity`} inputMode="decimal"
        plain={portal} className={portal ? 'font-semibold text-foreground' : undefined} />
    ) : <span className="px-1 text-center text-[13px] font-semibold tabular-nums text-foreground">
      {num(item.demandedQuantity) || '—'}
    </span>,
    avail: availableQuantity,
    size: editDetails ? (
      <AnswerCell value={item.size ?? ''} editable placeholder="Size" display={item.size ?? ''}
        onCommit={detail('size')} ariaLabel={`Line ${item.id} requested size`} plain={portal} wrap={portal}
        className={portal ? 'text-[12px]' : undefined} />
    ) : <span className={cn('px-1 text-[12px] text-muted-foreground', portal ? '[overflow-wrap:anywhere]' : 'truncate')} title={item.size ?? undefined}>
      {item.size ?? '—'}
    </span>,
    plant: <span className="min-w-0 px-1" title={item.name}>
      {editDetails ? <span className="flex flex-col gap-1">
        <AnswerCell value={item.name} editable placeholder="Plant name" display={item.name}
          onCommit={detail('name')} ariaLabel={`Line ${item.id} plant name`}
          plain={portal} className={portal ? 'truncate text-[13px] font-semibold text-foreground' : undefined} />
      </span> : <span className={cn('block text-[13px] font-semibold text-foreground', portal ? 'truncate' : 'whitespace-normal [overflow-wrap:anywhere]')}>{item.name}</span>}
      {portal && askNoteBlock && <span className="mt-0.5 block">{askNoteBlock}</span>}
    </span>,
    status: <div className={cn('px-1', centerStatus && 'flex min-w-0 justify-center [&>button]:min-h-11')}>
      <LineStatusPicker item={item} editable={editable} onPatch={onPatch} portal={portal} drawerModal={drawerModal} />
    </div>,
    note: supplierNote,
    unit_price: <AnswerCell value={unpriced ? '' : String(item.unitPrice)} editable={editable}
      align="right" placeholder={portal ? '-' : '$/unit'} display={unpriced ? '' : money(item.unitPrice)}
      onCommit={commit('unit_price')} plain={portal} attention={portal && unpriced} format={money}
      ariaLabel={`Line ${item.id} price per unit`} />,
    line_total: <span className="px-1 text-right text-[13px] font-semibold tabular-nums text-foreground">{money(arLineTotal(item)) || '—'}</span>,
  }
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
              borderLeft: `3px solid ${toneDot(tone)}`,
              background: toneTint(tone),
              // The comp's accent divider under a line that still needs a price.
              ...(editable && unpriced ? { borderBottomColor: PORTAL_PURPLE } : {}),
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
      {order.map((key) => <Fragment key={key}>{cells[key]}</Fragment>)}
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
  centerStatus = false,
  inlineAnswers = false,
}: {
  items: T[]
  editable: boolean
  onPatch?: (itemId: number, changes: Record<string, string>) => Promise<void>
  /** Admin-only edits to the requested plant and LPS note. */
  onPatchDetails?: (itemId: number, changes: Record<string, string>) => Promise<void>
  /** Portal-only transform for LPS notes; admin callers leave it unset. */
  displayText?: (text: string) => string
  /** `portal`: compact columns and no subtotal footer. */
  design?: LineTableDesign
  /** Render only the stacked phone cards; false preserves the exact table DOM. */
  mobileCards?: boolean
  /** Isolate answer dialogs and restore focus to the line control. */
  drawerModal?: boolean
  /** Supplier shared detail only: center desktop Status; other callers keep their drawing. */
  centerStatus?: boolean
  /** Supplier shared detail only: phone cards draw Avail and Price as open inputs a tap types into. */
  inlineAnswers?: boolean
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
  const [layout, setLayout] = useState<ARLayout>(defaultARLayout)
  const [layoutLoaded, setLayoutLoaded] = useState(false)
  const [plantWidth, setPlantWidth] = useState(88)
  useEffect(() => { setLayout(readARLayout()); setLayoutLoaded(true) }, [])
  useEffect(() => {
    if (!layoutLoaded) return
    try { window.localStorage.setItem(AR_LAYOUT_KEY, JSON.stringify(layout)) } catch { /* Private mode. */ }
  }, [layout, layoutLoaded])
  useEffect(() => { setPlantWidth(measurePlantWidth(items)) }, [items])

  const defaultWidths: Record<ARColumnKey, number> = portal
    ? { need: 56, avail: 68, size: 82, plant: plantWidth, status: 140, note: 200, unit_price: 90, line_total: 100 }
    : { need: 56, avail: 90, size: 90, plant: plantWidth, status: 150, note: 200, unit_price: 100, line_total: 100 }
  const widthOf = (key: ARColumnKey) => Math.max(AR_COLUMN_MIN[key], layout.widths[key] ?? defaultWidths[key])
  const base = layout.order.map((key) => key === 'note' && layout.widths.note == null
    ? 'minmax(200px,1fr)' : `${widthOf(key)}px`).join(' ')
  const columns = lead ? `${LEAD_COLUMN} ${base}` : base
  const minWidth = layout.order.reduce((sum, key) => sum + widthOf(key), 0)
    + (layout.order.length - 1) * 8 + (portal ? 32 : 24) + (lead ? 218 : 0)
  const moveColumn = (from: ARColumnKey, to: ARColumnKey) =>
    setLayout((current) => ({ ...current, order: reorder(current.order, from, to) as ARColumnKey[] }))
  const resizeColumn = (key: ARColumnKey, width: number) =>
    setLayout((current) => ({ ...current, widths: { ...current.widths, [key]: Math.max(AR_COLUMN_MIN[key], Math.round(width)) } }))
  // The phone card is the job line card's (2026-10-07): plain values, long
  // press to edit on touch, the same header-over-value table. Qty, size, name
  // and the ask are ours — the supplier reads them; the answers are theirs.
  const cardText = cn(lineCardName, 'text-[16px] leading-6')
  const cardFigure = cn(cardText, 'whitespace-nowrap')
  const mobile = (
    <div className="min-w-0 space-y-4 min-[640px]:grid min-[640px]:grid-cols-2 min-[640px]:items-start min-[640px]:gap-3 min-[640px]:space-y-0" data-testid="availability-mobile-lines">
          {items.length === 0 && (
            <p className="m-0 rounded-xl border border-border bg-card px-3 py-4 text-[13px] text-muted-foreground min-[640px]:col-span-2">
              No lines on this request.
            </p>
          )}
          {items.map((item, index) => {
            const lineName = `Line ${index + 1}, ${item.name}`
            const editDetails = editable && onPatchDetails != null
            const tone = arResponseTone(arShownStatus(item))
            const askNote = displayText?.(item.noteForSupplier ?? '') ?? item.noteForSupplier ?? ''
            // Saves are not awaited, as the answer inputs never were: the line
            // shows the edit at once, the request reports a failed write, and a
            // field can be reopened while its last write is still in flight.
            /** One field, as the job card draws it: `EditableText` while it may be written, plain text otherwise. */
            const field = ({ column, value, canEdit, save, label, render = (v) => (v == null ? '' : String(v)), numeric = false, align = 'center', wrap = false, className }: {
              column: string
              value: string | number | null
              canEdit: boolean
              save?: (itemId: number, changes: Record<string, string>) => Promise<void>
              label: string
              render?: (v: string | number | null) => string
              numeric?: boolean
              align?: 'left' | 'center'
              wrap?: boolean
              className?: string
            }) => canEdit && save
              ? <EditableText table="availability_request_items" id={item.id} column={column} value={value} onSaved={() => {}}
                onCommit={async (next) => { void save(item.id, { [column]: next }) }} render={render} numeric={numeric} align={align}
                wrap={wrap} title={`${lineName} ${label}`} labelled touchTarget className={className} />
              : <span className={cn('block w-full min-w-0 border border-transparent px-1.5 py-0.5 text-[13px] tabular-nums text-foreground',
                align === 'center' && 'text-center', wrap ? 'whitespace-pre-wrap [overflow-wrap:anywhere]' : 'truncate', className)}>
                {render(value) || '—'}</span>
            /** A note reads as text and opens a textarea (line breaks kept, never resized) on a long press. */
            const note = (column: string, value: string | null, label: string, placeholder: string,
              save?: (itemId: number, changes: Record<string, string>) => Promise<void>) => (
              <EditableTextarea table="availability_request_items" id={item.id} column={column} value={value} onSaved={() => {}}
                onCommit={async (next) => { void save?.(item.id, { [column]: next.trim() }) }}
                placeholder={placeholder} editLabel={`${lineName} ${label}`} compact />
            )
            return (
              <LineCard
                as="article"
                key={item.id}
                ariaLabel={lineName}
                accent={toneDot(tone)}
                background={toneTint(tone)}
                qty={field({ column: 'demanded_quantity', value: item.demandedQuantity, canEdit: editDetails, save: onPatchDetails,
                  label: 'requested quantity', render: (v) => num(v), numeric: true, className: cardFigure })}
                size={field({ column: 'size', value: item.size, canEdit: editDetails, save: onPatchDetails,
                  label: 'requested size', className: cardText })}
                name={field({ column: 'name', value: item.name, canEdit: editDetails, save: onPatchDetails,
                  label: 'plant name', align: 'left', wrap: true, className: cardText })}
                note={<>
                  {lead && <div className="min-w-0 text-[12px] text-muted-foreground">{renderLeading(item)}</div>}
                  {/* The ask under the plant row, full width. */}
                  {editDetails ? note('note_for_supplier', item.noteForSupplier, 'note for supplier', 'Note for supplier…', onPatchDetails)
                    : askNote && <p className="m-0 w-full whitespace-pre-wrap px-1.5 text-[11px] italic text-muted-foreground">{askNote}</p>}
                </>}
                cells={[
                  { key: 'status', label: 'Status', node: (
                    <div className="relative flex justify-center">
                      <LineStatusPicker item={item} editable={editable} onPatch={onPatch} ariaLabel={`${lineName} status`}
                        touch portal={portal} drawerModal={drawerModal} pill />
                    </div>
                  ) },
                  { key: 'avail', label: 'Avail', node: (
                    <div className="px-0.5">{inlineAnswers && editable && onPatch
                      ? <AnswerCell value={item.availableQuantity == null ? '' : String(item.availableQuantity)} editable align="center"
                        placeholder="—" display={num(item.availableQuantity)} onCommit={(next) => void onPatch(item.id, { available_quantity: next.trim() })}
                        ariaLabel={`${lineName} available quantity`} inputMode="decimal" touch tapToEdit className="px-1" />
                      : field({ column: 'available_quantity', value: item.availableQuantity, canEdit: editable, save: onPatch,
                        label: 'available quantity', render: (v) => num(v), numeric: true })}</div>
                  ) },
                  { key: 'price', label: 'Price', node: (
                    <div className="px-0.5">{inlineAnswers && editable && onPatch
                      ? <AnswerCell value={isUnpriced(item) ? '' : String(item.unitPrice)} editable align="center"
                        placeholder="—" display={isUnpriced(item) ? '' : money(item.unitPrice)} onCommit={(next) => void onPatch(item.id, { unit_price: next.trim() })}
                        ariaLabel={`${lineName} price per unit`} inputMode="decimal" format={money} touch tapToEdit className="px-1" />
                      : field({ column: 'unit_price', value: isUnpriced(item) ? null : item.unitPrice, canEdit: editable, save: onPatch,
                        label: 'price per unit', render: (v) => money(v), numeric: true })}</div>
                  ) },
                  { key: 'total', label: 'Total', node: (
                    <span className="px-1 text-center text-[13px] font-semibold tabular-nums text-foreground">{money(arLineTotal(item)) || '—'}</span>
                  ) },
                ]}
              >
                {(editable || item.noteFromSupplier) && (
                  <div className="flex min-w-0 items-start gap-2 px-0.5">
                    <span className="flex-none pt-1 text-[11px] font-bold uppercase leading-4 tracking-[.05em] text-muted-foreground">Supplier reply</span>
                    {editable ? note('note_from_supplier', item.noteFromSupplier, 'supplier reply', 'Substitute, ETA, conditions…', onPatch)
                      : <p className="m-0 min-w-0 flex-1 whitespace-pre-wrap px-1.5 py-0.5 text-[11px] italic text-muted-foreground">{item.noteFromSupplier}</p>}
                  </div>
                )}
              </LineCard>
            )
          })}
          {items.length > 0 && !portal && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-lps-headrow px-3 py-2.5 text-[12px] min-[640px]:col-span-2">
              <span className="text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">Subtotal</span>
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
          // Match the row's 3px accent border so the column centers coincide.
          centerStatus && 'border-l-[3px] border-l-transparent',
        )}
        style={{ gridTemplateColumns: columns, minWidth, padding: portal ? '16px 16px 14px' : '8px 12px' }}
      >
        {lead && <span className="px-1">{leadingHeader}</span>}
        {layout.order.map((key) => <ARColumnHeader key={key} column={key} width={widthOf(key)}
          onMove={moveColumn} onResize={resizeColumn} centerStatus={centerStatus} />)}
      </div>
      {items.length === 0 && (
        <p className="px-3 py-4 text-[13px] text-muted-foreground">
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
          order={layout.order}
          minWidth={minWidth}
          leading={lead ? renderLeading(item) : undefined}
          design={design}
          drawerModal={drawerModal}
          centerStatus={centerStatus}
        />
      ))}
        {items.length > 0 && !portal && (
          <div className="flex items-center justify-end gap-3 border-t border-border bg-lps-headrow px-3 py-2"
            style={{ minWidth }}>
            <span className="text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">Subtotal</span>
            <span className="text-[13px] font-bold tabular-nums text-foreground">{money(subtotal) || '—'}</span>
          </div>
        )}
    </div>
  )
}
