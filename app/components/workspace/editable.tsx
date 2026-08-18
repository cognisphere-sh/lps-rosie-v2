'use client'

// The click-to-edit primitives, shared by every page that writes a cell.
//
// They were the Job Requests page's until Customers needed the same three
// controls over the same endpoint; nothing here knows which table it is
// editing, because the server decides that from its whitelist.

import { useRef, useState } from 'react'

import { useToast } from '@/components/workspace/shell'
import { cn } from '@/lib/utils'

/**
 * One field write, through the same whitelisted endpoint every other table
 * edits through. The server decides what may be written — this only asks.
 */
export async function patchRow(table: string, id: number, column: string, value: string): Promise<void> {
  const res = await fetch('/api/rows', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ table, id, column, value }),
  })
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(body.error ?? 'Could not save')
}

/**
 * Add one stamped entry to an append-only note column.
 *
 * The other verb on the same endpoint. `internal_notes` is a log, so the app
 * may add to it but never replace it — the server enforces that, this only asks.
 */
export async function appendEntry(table: string, id: number, column: string, text: string): Promise<void> {
  const res = await fetch('/api/rows', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ table, id, column, text }),
  })
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(body.error ?? 'Could not save')
}

export interface EditProps {
  table: string
  id: number
  column: string
  /** Refetch after a write: generated totals and every count move with it. */
  onSaved: () => void
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
}: EditProps & {
  value: string | number | null
  /** How the committed value reads when not editing (money, thousands, …). */
  render?: (v: string | number | null) => string
  placeholder?: string
  numeric?: boolean
  align?: 'left' | 'right'
  title?: string
}) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const done = useRef(false)

  const commit = async () => {
    if (done.current) return
    done.current = true
    const next = draft.trim()
    const before = value == null ? '' : String(value)
    setEditing(false)
    if (next === before) return
    setBusy(true)
    try {
      await patchRow(table, id, column, next)
      onSaved()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        type={numeric ? 'number' : 'text'}
        step="any"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void commit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            done.current = true
            setEditing(false)
          }
        }}
        className={cn(
          'w-full min-w-0 rounded-md border border-primary bg-card px-1.5 py-0.5 text-[12.5px] text-foreground outline-none',
          align === 'right' && 'text-right tabular-nums',
        )}
      />
    )
  }

  const shown = render ? render(value) : value == null ? '' : String(value)
  return (
    <button
      type="button"
      title={title ?? 'Click to edit'}
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation()
        setDraft(value == null ? '' : String(value))
        done.current = false
        setEditing(true)
      }}
      className={cn(
        'w-full min-w-0 cursor-text truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-left text-[12.5px] text-foreground hover:border-border hover:bg-lps-tint',
        align === 'right' && 'text-right tabular-nums',
        busy && 'opacity-50',
      )}
    >
      {shown || <span className="text-lps-dim">{placeholder}</span>}
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
}: EditProps & { value: string | null; placeholder: string }) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const done = useRef(false)
  const current = value ?? ''

  const commit = async () => {
    if (done.current) return
    done.current = true
    setEditing(false)
    if (draft === current) return
    setBusy(true)
    try {
      await patchRow(table, id, column, draft)
      onSaved()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <textarea
        autoFocus
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            done.current = true
            setEditing(false)
          }
        }}
        className="w-full resize-y rounded-lg border border-primary bg-card p-2 text-[12.5px] text-foreground outline-none"
      />
    )
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation()
        setDraft(current)
        done.current = false
        setEditing(true)
      }}
      className={cn(
        'w-full cursor-text whitespace-pre-wrap rounded-lg border border-transparent bg-transparent p-2 text-left text-[12.5px] text-foreground hover:border-border hover:bg-lps-tint',
        busy && 'opacity-50',
      )}
    >
      {current || <span className="text-lps-dim">{placeholder}</span>}
    </button>
  )
}

/**
 * Write one new entry into an append-only log.
 *
 * Deliberately not an editor: `internal_notes` is the sourcing record, so the
 * only thing the app may do to it is add. The stamp is the server's — the
 * browser's clock is not the deployment's timezone.
 */
export function AppendNote({
  table,
  id,
  column,
  onSaved,
  placeholder,
}: EditProps & { placeholder: string }) {
  const toast = useToast()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const add = async () => {
    const text = draft.trim()
    if (!text) return
    setBusy(true)
    try {
      await appendEntry(table, id, column, text)
      setDraft('')
      onSaved()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        rows={2}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="w-full resize-y rounded-lg border border-border bg-card p-2 text-[12.5px] text-foreground outline-none focus:border-primary"
      />
      <button
        type="button"
        disabled={busy || !draft.trim()}
        onClick={(e) => {
          e.stopPropagation()
          void add()
        }}
        className="cursor-pointer self-start rounded-full border border-border bg-card px-3 py-1 text-[11.5px] font-semibold text-primary disabled:cursor-default disabled:opacity-40"
      >
        {busy ? 'Adding…' : 'Add entry'}
      </button>
    </div>
  )
}

