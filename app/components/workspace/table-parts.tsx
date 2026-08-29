'use client'

import { useEffect, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  CheckIcon, ChevronDown, CloseIcon, ColumnsIcon, FileIcon, PencilIcon,
  SortAsc, SortDesc, SortNone,
} from '@/components/workspace/icons'
import { websiteHref, type ColumnDef } from '@/lib/columns'
import { money, num } from '@/lib/format'
import type { CellValue } from '@/lib/rows'
import type { ColFilter, ColFilters, Sort } from '@/lib/table-config'
import { cn } from '@/lib/utils'

export const badgeFor = (category: string) =>
  category === 'Grower' ? 'secondary' : category === 'Wholesale Supplier' ? 'default' : 'outline'

/**
 * Close a popover when the pointer goes down outside it.
 *
 * Returns a ref to put on the popover's own container. "Outside" means outside
 * *that* node — a click inside a different popover counts, which is what makes
 * opening one close the others. The editors a popover holds are inside it, so
 * a mousedown into a textarea still doesn't close the thing containing it.
 */
export function useOutsideClose<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  close: () => void,
) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Unattached ref: a caller that hasn't adopted it yet keeps the old
      // "outside every popover" test rather than closing on its own clicks.
      const inside = ref.current
        ? ref.current.contains(target)
        : !!target.closest('[data-menu],[data-pop]')
      if (!inside) close()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, close])
  return ref
}

const checkRow = (on: boolean) =>
  cn(
    'flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2 py-1.5 text-left text-[12px] hover:bg-muted',
    on ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground',
  )

const checkBox = (on: boolean) =>
  cn(
    'inline-flex size-[15px] flex-none items-center justify-center rounded-[5px] border',
    on ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background',
  )

// ------------------------------------------------------------ column picker

export function ColumnPicker({
  title,
  cols,
  hidden,
  onToggle,
  align = 'left',
  size = 'md',
}: {
  title: string
  cols: ColumnDef[]
  hidden: string[]
  onToggle: (key: string) => void
  align?: 'left' | 'right'
  size?: 'sm' | 'md'
}) {
  const [open, setOpen] = useState(false)
  const pop = useOutsideClose(open, () => setOpen(false))

  return (
    <div ref={pop} data-menu className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`Show / hide ${title.toLowerCase()}`}
        aria-label={`Show or hide ${title.toLowerCase()}`}
        className={cn(
          'inline-flex cursor-pointer items-center justify-center rounded-[7px] border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
          size === 'sm' ? 'size-6' : 'size-[26px]',
        )}
      >
        <ColumnsIcon size={size === 'sm' ? 14 : 15} />
      </button>
      {open && (
        <div
          className={cn(
            'lps-pop absolute top-[calc(100%+4px)] z-[90] max-h-[300px] w-[212px] overflow-auto rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]',
            align === 'right' ? 'right-0' : 'left-1.5',
          )}
        >
          <div className="px-2 pb-1.5 pt-1 text-[10.5px] font-bold uppercase tracking-[.05em] text-lps-dim">
            {title}
          </div>
          {cols.map((c) => {
            const visible = !hidden.includes(c.key)
            return (
              <button key={c.key} type="button" onClick={() => onToggle(c.key)} className={checkRow(visible)}>
                <span className={checkBox(visible)}>{visible && <CheckIcon size={10} />}</span>
                <span className="truncate">{c.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------- standalone filters

/** Compact multiselect used by the Plant search supplier panel. */
export function MultiFilter({
  allLabel,
  options,
  selected,
  onChange,
  selectionLabel,
  buttonClassName,
  filterPlaceholder = 'Filter suppliers…',
  largeTargets = false,
}: {
  allLabel: string
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  selectionLabel?: string
  buttonClassName?: string
  filterPlaceholder?: string
  largeTargets?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [needle, setNeedle] = useState('')
  const pop = useOutsideClose(open, () => setOpen(false))

  const shown = needle
    ? options.filter((o) => o.toLowerCase().includes(needle.toLowerCase()))
    : options

  return (
    <div ref={pop} data-menu className="relative w-full">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-6 w-full cursor-pointer items-center justify-between gap-1 rounded-[7px] border bg-background px-[7px] text-[11px] font-medium',
          selected.length ? 'border-primary text-primary' : 'border-input text-foreground',
          buttonClassName,
        )}
      >
        <span className="truncate">
          {selected.length
            ? `${selectionLabel ? `${selectionLabel}: ` : ''}${selected.length} selected`
            : allLabel}
        </span>
        <ChevronDown size={10} className="flex-none opacity-50" />
      </button>
      {open && (
        <div className="lps-pop absolute left-0 top-[calc(100%+4px)] z-[96] max-h-[300px] w-[240px] overflow-auto rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]">
          <input
            value={needle}
            onChange={(e) => setNeedle(e.target.value)}
            placeholder={filterPlaceholder}
            aria-label={filterPlaceholder}
            className={cn('mb-1 w-full rounded-[7px] border border-input bg-background px-2 text-[11.5px] outline-none', largeTargets ? 'h-11' : 'h-7')}
          />
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className={cn('mb-1 w-full cursor-pointer rounded-lg border-none bg-transparent px-2 py-1 text-left text-[11.5px] font-semibold text-primary hover:bg-muted', largeTargets && 'min-h-11')}
            >
              Clear selection
            </button>
          )}
          {shown.length === 0 && (
            <div className="px-2 py-1.5 text-[11.5px] text-muted-foreground">No matches</div>
          )}
          {shown.map((o) => {
            const on = selected.includes(o)
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? selected.filter((x) => x !== o) : [...selected, o])}
                className={cn(checkRow(on), largeTargets && 'min-h-11')}
                title={o}
              >
                <span className={checkBox(on)}>{on && <CheckIcon size={10} />}</span>
                <span className="truncate">{o}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------ filter control

/** The filter widget for one column — used by the column head and, on mobile
 *  (where there are no column heads), by the plant search filter sheet. */
export function FilterControl({
  col,
  value,
  options,
  small,
  onFilter,
}: {
  col: ColumnDef
  value: ColFilter | undefined
  options: string[]
  small?: boolean
  onFilter: (value: ColFilter) => void
}) {
  const [multiOpen, setMultiOpen] = useState(false)
  const [needle, setNeedle] = useState('')
  const pop = useOutsideClose(multiOpen, () => setMultiOpen(false))

  const kind = col.filter ?? 'text'
  const selected = Array.isArray(value) ? value : []
  const range = value && typeof value === 'object' && !Array.isArray(value) ? value : {}

  if (kind === 'none') return <div className={small ? 'h-6' : 'h-[26px]'} />

  if (kind === 'text') {
    return (
      <input
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onFilter(e.target.value)}
        placeholder="Filter…"
        className={cn(
          'w-full rounded-[7px] border border-input bg-background px-2 font-normal text-foreground outline-none',
          small ? 'h-6 text-[11px]' : 'h-[26px] text-[11.5px]',
        )}
      />
    )
  }

  if (kind === 'range') {
    return (
      <div className="flex gap-1">
        {(['min', 'max'] as const).map((bound) => (
          <input
            key={bound}
            type="number"
            min="0"
            step="any"
            value={range[bound] ?? ''}
            onChange={(e) => onFilter({ ...range, [bound]: e.target.value })}
            placeholder={`${bound === 'min' ? 'Min' : 'Max'}${col.filterUnit ? ` ${col.filterUnit}` : ''}`}
            aria-label={`${col.label} ${bound === 'min' ? 'minimum' : 'maximum'}${col.filterUnit ? ` in ${col.filterUnit}` : ''}`}
            className={cn(
              'w-full min-w-0 rounded-[7px] border border-input bg-background px-1.5 font-normal text-foreground outline-none',
              small ? 'h-6 text-[11px]' : 'h-[26px] text-[11.5px]',
            )}
          />
        ))}
      </div>
    )
  }

  const shown = needle
    ? options.filter((o) => o.toLowerCase().includes(needle.toLowerCase()))
    : options

  return (
    <div ref={pop} data-menu className="relative">
      <button
        type="button"
        onClick={() => setMultiOpen((v) => !v)}
        className={cn(
          'flex w-full cursor-pointer items-center justify-between gap-1 rounded-[7px] border bg-background px-[7px] font-medium',
          small ? 'h-6 text-[11px]' : 'h-[26px] text-[11.5px]',
          selected.length ? 'border-primary text-primary' : 'border-input text-foreground',
        )}
      >
        <span className="truncate">{selected.length ? `${selected.length} selected` : 'All'}</span>
        <ChevronDown size={10} className="flex-none opacity-50" />
      </button>
      {multiOpen && (
        <div className="lps-pop absolute left-0 top-[calc(100%+5px)] z-[94] max-h-[250px] w-[196px] overflow-auto rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]">
          <input
            value={needle}
            onChange={(e) => setNeedle(e.target.value)}
            placeholder="Search…"
            aria-label={`Search ${col.label} values`}
            className="mb-1 h-7 w-full rounded-[7px] border border-input bg-background px-2 text-[11.5px] font-normal outline-none"
          />
          {shown.length === 0 && (
            <div className="px-2 py-1.5 text-[11.5px] text-muted-foreground">
              {options.length === 0 ? 'No values' : 'No matches'}
            </div>
          )}
          {shown.map((o) => {
            const on = selected.includes(o)
            return (
              <button
                key={o}
                type="button"
                onClick={() => onFilter(on ? selected.filter((x) => x !== o) : [...selected, o])}
                className={checkRow(on)}
              >
                <span className={checkBox(on)}>{on && <CheckIcon size={10} />}</span>
                <span className="truncate">{o}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------- column head

export function ColumnHead({
  col,
  width,
  sort,
  filters,
  options,
  small,
  onSort,
  onFilter,
  onResize,
  onMove,
}: {
  col: ColumnDef
  width: number
  sort: Sort
  /** Omit these three filter props on a table whose filters live elsewhere. */
  filters?: ColFilters
  options?: string[]
  small?: boolean
  onSort: () => void
  onFilter?: (value: ColFilter) => void
  onResize: (width: number) => void
  onMove: (fromKey: string) => void
}) {
  const [dragOver, setDragOver] = useState(false)

  const active = sort?.column === col.key

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    const move = (ev: MouseEvent) => onResize(startW + (ev.clientX - startX))
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  return (
    // The whole header cell is the drop target — putting it on the resize
    // handle instead would make reordering a 6px-wide game of darts.
    <div
      className={cn('flex flex-col gap-[7px]', dragOver && 'ring-2 ring-primary ring-inset rounded')}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (!dragOver) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const from = e.dataTransfer.getData('text/plain')
        if (from && from !== col.key) onMove(from)
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', col.key)
            e.dataTransfer.effectAllowed = 'move'
          }}
          title={`${col.label} — drag to reorder`}
          className="cursor-grab truncate text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground active:cursor-grabbing"
        >
          {col.label}
        </span>
        <button
          type="button"
          onClick={onSort}
          aria-label={`Sort by ${col.label}`}
          className={cn(
            'inline-flex size-5 flex-none cursor-pointer items-center justify-center rounded-[5px] border-none bg-transparent',
            active ? 'text-primary' : 'text-lps-dim',
          )}
        >
          {active ? (sort!.direction === 'asc' ? <SortAsc size={13} /> : <SortDesc size={13} />) : <SortNone size={13} />}
        </button>
      </div>

      {filters && onFilter && (
        <FilterControl
          col={col}
          value={filters[col.key]}
          options={options ?? []}
          small={small}
          onFilter={onFilter}
        />
      )}

      <div
        onMouseDown={startResize}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-lps-edge"
      />
    </div>
  )
}

// --------------------------------------------------------------------- cell

/** Source files open through /api/file, which signs them on click. */
export const fileHref = (path: string) => `/api/file?path=${encodeURIComponent(path)}`

/**
 * Marks an LPS Partner — they answer availability requests in the LPS supplier
 * portal (`suppliers.is_lps_partner`, migrations 0062/0074).
 */
export function LpsTag() {
  return (
    <span
      title="LPS Partner — answers availability requests in the LPS supplier portal"
      className="inline-flex flex-none items-center rounded-[5px] bg-primary px-1 py-px text-[9px] font-black tracking-wide text-primary-foreground"
    >
      LPS
    </span>
  )
}

export function Cell({
  col,
  value,
  rowId,
  small,
  links,
  href,
  tag,
  onOpen,
  onSave,
}: {
  col: ColumnDef
  value: CellValue
  rowId: string | number
  small?: boolean
  /** For kind="list": the source files behind the displayed names. */
  links?: { label: string; path: string }[]
  /** For kind="file": the raw file_path this cell links to. */
  href?: string | null
  /** For kind="link": a small marker drawn after the text (e.g. the LPS tag). */
  tag?: React.ReactNode
  onOpen?: () => void
  onSave?: (next: string) => Promise<void> | void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectRef = useRef<HTMLSelectElement>(null)

  const text = Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value)
  const display = col.money ? money(value) : col.num ? num(value) : text

  // Only one of the two is ever mounted, so the first non-null ref is the editor.
  useEffect(() => {
    if (editing) (inputRef.current ?? selectRef.current)?.focus()
  }, [editing])

  // A dropdown saves the value it was just given: `draft` is state, so it would
  // still hold the previous selection at this point in the event.
  const commit = async (next = draft) => {
    if (busy) return
    setBusy(true)
    try {
      await onSave?.(next)
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  const startEdit = () => {
    setDraft(text)
    setEditing(true)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-[3px] rounded-lg bg-background p-0.5 outline outline-2 -outline-offset-2 outline-primary">
        {col.kind === 'select' ? (
          <select
            ref={selectRef}
            value={draft}
            disabled={busy}
            aria-label={col.label}
            onChange={(e) => {
              setDraft(e.target.value)
              void commit(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false)
            }}
            className={cn(
              'min-w-0 flex-1 cursor-pointer border-none bg-transparent px-1 text-foreground outline-none',
              small ? 'h-[26px] text-[12px]' : 'h-7 text-[12.5px]',
            )}
          >
            {/* Blank clears the column back to null — "not established yet". */}
            <option value="">—</option>
            {(col.options ?? []).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : (
          <input
            ref={inputRef}
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commit()
              if (e.key === 'Escape') setEditing(false)
            }}
            className={cn(
              'min-w-0 flex-1 border-none bg-transparent px-1.5 text-foreground outline-none',
              small ? 'h-[26px] text-[12px]' : 'h-7 text-[12.5px]',
            )}
          />
        )}
        <button
          type="button"
          onClick={() => void commit()}
          aria-label="Save"
          className="inline-flex size-[22px] cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-primary hover:bg-secondary"
        >
          <CheckIcon size={12} />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label="Cancel"
          className="inline-flex size-[22px] cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted-foreground hover:bg-lps-warn-bg hover:text-[#C24C2E]"
        >
          <CloseIcon size={12} />
        </button>
      </div>
    )
  }

  if (col.kind === 'badge') {
    return text ? (
      <span className="px-1.5" title={text}>
        <Badge variant={badgeFor(text) as 'default' | 'secondary' | 'outline'}>{text}</Badge>
      </span>
    ) : (
      <span className="px-1.5 text-[12.5px] italic text-lps-dim">empty</span>
    )
  }

  if (col.kind === 'url') {
    // An editable URL keeps its link — clicking the text still opens the page,
    // so the editor hangs off a pencil rather than the cell itself.
    const editableUrl = !!col.edit && !!onSave
    if (!text) {
      return editableUrl ? (
        <div
          onClick={startEdit}
          className="flex min-h-7 cursor-text items-center justify-between gap-1 px-1.5 py-1"
        >
          <span className="text-[12.5px] italic text-lps-dim">empty</span>
          <span className="lps-pencil inline-flex flex-none text-lps-dim opacity-0 transition-opacity">
            <PencilIcon size={11} />
          </span>
        </div>
      ) : (
        <span className="px-1.5 text-[12.5px] italic text-lps-dim">empty</span>
      )
    }
    return (
      <div className="flex min-w-0 items-center gap-1 px-1.5">
        <a
          href={websiteHref(text)}
          target="_blank"
          rel="noreferrer"
          title={text}
          className="min-w-0 flex-1 truncate py-1 text-[12.5px] text-primary hover:underline"
        >
          {text}
        </a>
        {editableUrl && (
          <button
            type="button"
            onClick={startEdit}
            aria-label={`Edit ${col.label}`}
            title={`Edit ${col.label}`}
            className="lps-pencil inline-flex flex-none cursor-pointer border-none bg-transparent p-0 text-lps-dim opacity-0 transition-opacity hover:text-foreground"
          >
            <PencilIcon size={11} />
          </button>
        )}
      </div>
    )
  }

  if (col.kind === 'file') {
    if (!text) return <span className="px-1.5 text-[12px] italic text-lps-dim">no source</span>
    return (
      <a
        href={href ? fileHref(href) : undefined}
        target="_blank"
        rel="noreferrer"
        title={href ?? text}
        className="flex items-center gap-1.5 truncate px-1.5 py-1 text-[12px] text-primary hover:underline"
      >
        <FileIcon size={11} className="flex-none" />
        <span className="truncate">{text}</span>
      </a>
    )
  }

  if (col.kind === 'link') {
    return (
      <button
        type="button"
        onClick={onOpen}
        title={text}
        className="flex w-full cursor-pointer items-center gap-1.5 border-none bg-transparent px-1.5 py-1 text-left text-[13px] font-bold text-primary"
      >
        <span className="min-w-0 truncate">{text}</span>
        {tag}
      </button>
    )
  }

  if (col.kind === 'contacts') {
    // The non-primary people — the primary already has its own three columns.
    // Show the first, count the rest, and hand the whole cell to the tab that
    // can actually show them all.
    const items = Array.isArray(value) ? value.map(String) : value == null ? [] : [String(value)]
    if (!items.length) return <span className="px-1.5 text-[11.5px] italic text-lps-dim">none</span>
    const more = items.length - 1
    return (
      <a
        href={`/suppliers/${rowId}?tab=contacts`}
        title={items.join('\n')}
        className="flex h-7 min-w-0 items-center gap-1 px-1.5 text-[11.5px] font-semibold text-primary hover:underline"
      >
        <span className="truncate">{items[0]}</span>
        {more > 0 && (
          <span className="flex h-6 flex-none items-center rounded-full border border-border bg-muted px-2 text-[10.5px] font-semibold text-foreground">
            +{more}
          </span>
        )}
      </a>
    )
  }

  if (col.kind === 'list') {
    // Sources arrive newest-first. Keep the current file directly accessible,
    // then deep-link any additional history to the supplier's existing Files tab.
    const items = links ?? (Array.isArray(value) ? value.map((l) => ({ label: l, path: '' })) : [])
    const latest = items[0]
    const more = Math.max(0, items.length - 1)
    if (!latest) return <span className="px-1.5 text-[11.5px] italic text-lps-dim">none</span>
    const current = latest.path ? (
      <a
        href={fileHref(latest.path)}
        target="_blank"
        rel="noreferrer"
        title={`Open latest: ${latest.label}`}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-[11.5px] font-semibold text-primary hover:underline"
      >
        <FileIcon size={11} className="flex-none" />
        <span className="truncate">{latest.label}</span>
      </a>
    ) : (
      <span title={latest.label} className="flex min-w-0 flex-1 items-center gap-1.5 text-[11.5px] font-semibold text-primary">
        <FileIcon size={11} className="flex-none" />
        <span className="truncate">{latest.label}</span>
      </span>
    )
    return (
      <div className="flex h-7 min-w-0 items-center gap-1 px-1.5">
        {current}
        {more > 0 && (
          <a
            href={`/suppliers/${rowId}?tab=files`}
            title={`Open ${more} older ${more === 1 ? 'file' : 'files'}`}
            className="flex h-6 flex-none items-center rounded-full border border-border bg-muted px-2 text-[10.5px] font-semibold text-foreground hover:bg-secondary"
          >
            +{more}
          </a>
        )}
      </div>
    )
  }

  const editable = !!col.edit && !!onSave
  return (
    <div
      onClick={editable ? startEdit : undefined}
      title={text}
      className={cn(
        'flex items-center gap-1 rounded-[7px] px-1.5 py-1',
        col.align === 'right' ? 'justify-end' : 'justify-between',
        small ? 'min-h-7' : 'min-h-[30px]',
        editable ? 'cursor-text' : 'cursor-default',
      )}
      data-row={rowId}
    >
      <span
        className={cn(
          'truncate',
          small ? 'text-[12px]' : 'text-[12.5px]',
          col.money || col.num ? 'font-semibold tabular-nums' : 'font-normal',
          display === '' ? 'italic text-lps-dim' : 'text-foreground',
        )}
      >
        {display === '' ? (col.money ? 'Price unavailable' : 'empty') : display}
      </span>
      {editable && (
        <span className="lps-pencil inline-flex flex-none text-lps-dim opacity-0 transition-opacity">
          <PencilIcon size={11} />
        </span>
      )}
    </div>
  )
}
