'use client'

// The click-to-edit primitives, shared by every page that writes a cell.
//
// They were the Job Requests page's until Customers needed the same controls
// over the same endpoint; nothing here knows which table it is editing,
// because the server decides that from its whitelist.

import { useRef, useState, type ReactNode } from 'react'

import { CheckIcon, CloseIcon } from '@/components/workspace/icons'
import { useToast } from '@/components/workspace/shell'
import { cn } from '@/lib/utils'

/**
 * One field write, through the same whitelisted endpoint every other table
 * edits through. The server decides what may be written — this only asks.
 */
export async function patchRow(
  table: string,
  id: number,
  column: string,
  value: string,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/rows', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ table, id, column, value }),
    signal,
  })
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(body.error ?? 'Could not save')
}

export interface EditProps {
  table: string
  id: number
  column: string
  /** Refetch after a write: generated totals and every count move with it.
   *  `EditableText` also hands over what it wrote, for the callers that have
   *  somewhere else to carry the new value (a rename, into the chat panel). */
  onSaved: (value?: string) => void
  /** Opt-in 44px targets for focused/compact Job work only. */
  touchTarget?: boolean
}

/**
 * Click-to-edit text or number.
 *
 * Enter and blur commit, Esc abandons. An unchanged value is never written:
 * clicking into a field and straight back out should not appear in the
 * request's changelog as an edit.
 */
export function EditableText({
  table,
  id,
  column,
  onSaved,
  value,
  render,
  placeholder = '—',
  numeric = false,
  align = 'left',
  title,
  touchTarget = false,
  inlineControls = false,
  triggerContent,
  className,
}: EditProps & {
  value: string | number | null
  /** How the committed value reads when not editing (money, thousands, …). */
  render?: (v: string | number | null) => string
  placeholder?: string
  numeric?: boolean
  align?: 'left' | 'right'
  title?: string
  triggerContent?: ReactNode
  className?: string
  /** Keep the editor in its cell with explicit save/cancel actions. */
  inlineControls?: boolean
}) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const done = useRef(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const restoreTrigger = () => requestAnimationFrame(() => {
    const target = trigger.current
    if (target?.isConnected && !target.closest('[inert]')) target.focus({ preventScroll: true })
  })

  const commit = async (restoreFocus = false) => {
    if (done.current) return
    done.current = true
    const next = draft.trim()
    const before = value == null ? '' : String(value)
    setEditing(false)
    if (next === before) {
      if (restoreFocus) restoreTrigger()
      return
    }
    setBusy(true)
    try {
      await patchRow(table, id, column, next)
      onSaved(next)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
      if (restoreFocus) restoreTrigger()
    }
  }

  const cancel = (restoreFocus = true) => {
    done.current = true
    setEditing(false)
    if (restoreFocus) restoreTrigger()
  }

  if (editing) {
    const input = (
      <input
        autoFocus
        type={numeric ? 'number' : 'text'}
        aria-label={title}
        step="any"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={inlineControls ? undefined : () => void commit(false)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void commit(true)
          } else if (e.key === 'Tab') {
            // Preserve Tab navigation while saving before focus leaves the cell.
            void commit(false)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
          }
        }}
        className={cn(
          'w-full min-w-0 rounded-md border border-primary bg-card px-1.5 py-0.5 text-[12.5px] text-foreground outline-none',
          touchTarget && 'min-h-11',
          align === 'right' && 'text-right tabular-nums',
        )}
      />
    )
    if (!inlineControls) return input
    return (
      <span className="flex min-w-0 items-center gap-1" onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) void commit(false)
      }}>
        {input}
        <button type="button" aria-label={`Save ${title ?? 'edit'}`} title="Save" disabled={busy}
          onMouseDown={(event) => event.preventDefault()} onClick={() => void commit(true)}
          className="inline-flex size-6 flex-none items-center justify-center rounded text-primary hover:bg-primary/10 disabled:opacity-50"><CheckIcon size={14} /></button>
        <button type="button" aria-label={`Cancel ${title ?? 'edit'}`} title="Cancel" disabled={busy}
          onMouseDown={(event) => event.preventDefault()} onClick={() => cancel()}
          className="inline-flex size-6 flex-none items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-50"><CloseIcon size={14} /></button>
      </span>
    )
  }

  const shown = render ? render(value) : value == null ? '' : String(value)
  return (
    <button
      ref={trigger}
      type="button"
      data-cell-editor
      title={title ?? 'Click to edit'}
      aria-label={triggerContent ? title : undefined}
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation()
        setDraft(value == null ? '' : String(value))
        done.current = false
        setEditing(true)
      }}
      className={cn(
        'w-full min-w-0 cursor-text truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-left text-[12.5px] text-foreground hover:border-border hover:bg-lps-tint',
        touchTarget && 'min-h-11 outline-none focus-visible:ring-2 focus-visible:ring-ring',
        align === 'right' && 'text-right tabular-nums',
        busy && 'opacity-50',
        className,
      )}
    >
      {triggerContent ?? (shown || <span className="text-lps-dim">{placeholder}</span>)}
    </button>
  )
}

/** Multi-line click-to-edit, for the shared-note fields. */
export function EditableTextarea({
  table,
  id,
  column,
  onSaved,
  value,
  placeholder,
  touchTarget = false,
  renderPreview,
  editLabel = 'Edit note',
  inlineControls = false,
  compact = false,
}: EditProps & {
  value: string | null
  placeholder: string
  /** Formatted read view, kept outside the edit button so links remain usable. */
  renderPreview?: (value: string) => ReactNode
  editLabel?: string
  /** Keep the textarea in its table cell with explicit save/cancel actions. */
  inlineControls?: boolean
  /** A one-line, spreadsheet-style note editor. */
  compact?: boolean
}) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const done = useRef(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const current = value ?? ''
  const restoreTrigger = () => requestAnimationFrame(() => {
    const target = trigger.current
    if (target?.isConnected && !target.closest('[inert]')) target.focus({ preventScroll: true })
  })

  const commit = async (restoreFocus = false) => {
    if (done.current) return
    done.current = true
    setEditing(false)
    if (draft === current) {
      if (restoreFocus) restoreTrigger()
      return
    }
    setBusy(true)
    try {
      await patchRow(table, id, column, draft)
      onSaved()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
      if (restoreFocus) restoreTrigger()
    }
  }

  const cancel = () => {
    done.current = true
    setEditing(false)
    restoreTrigger()
  }

  if (editing) {
    const textarea = (
      <textarea
        autoFocus
        aria-label={renderPreview ? editLabel : undefined}
        rows={compact ? 1 : 3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={inlineControls ? undefined : () => void commit(false)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if ((inlineControls || e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault()
            void commit(true)
          } else if (inlineControls && e.key === 'Tab') {
            void commit(false)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
          }
        }}
        className={cn(
          'w-full resize-y rounded-lg border border-primary bg-card p-2 text-[12.5px] text-foreground outline-none',
          compact && 'resize-none rounded-md px-1.5 py-0.5',
          touchTarget && 'min-h-11',
        )}
      />
    )
    if (!inlineControls) return textarea
    return (
      <span className="flex min-w-0 items-center gap-1" onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) void commit(false)
      }}>
        {textarea}
        <button type="button" aria-label={`Save ${editLabel}`} title="Save" disabled={busy}
          onMouseDown={(event) => event.preventDefault()} onClick={() => void commit(true)}
          className="inline-flex size-6 flex-none items-center justify-center rounded text-primary hover:bg-primary/10 disabled:opacity-50"><CheckIcon size={14} /></button>
        <button type="button" aria-label={`Cancel ${editLabel}`} title="Cancel" disabled={busy}
          onMouseDown={(event) => event.preventDefault()} onClick={cancel}
          className="inline-flex size-6 flex-none items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-50"><CloseIcon size={14} /></button>
      </span>
    )
  }

  const editButton = (
    <button
      ref={trigger}
      type="button"
      disabled={busy}
      aria-label={renderPreview ? editLabel : undefined}
      onClick={(e) => {
        e.stopPropagation()
        setDraft(current)
        done.current = false
        setEditing(true)
      }}
      className={cn(
        'w-full cursor-text whitespace-pre-wrap rounded-lg border border-transparent bg-transparent p-2 text-left text-[12.5px] text-foreground hover:border-border hover:bg-lps-tint',
        touchTarget && 'min-h-11 outline-none focus-visible:ring-2 focus-visible:ring-ring',
        busy && 'opacity-50',
      )}
    >
      {renderPreview && current ? editLabel : current || <span className="text-lps-dim">{placeholder}</span>}
    </button>
  )

  if (!renderPreview || !current) return editButton
  return (
    <div className="min-w-0 text-[12.5px] text-foreground" onClick={(event) => event.stopPropagation()}>
      <div className="p-2">{renderPreview(current)}</div>
      {editButton}
    </div>
  )
}
