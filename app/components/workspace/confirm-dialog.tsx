'use client'

import { useEffect, useId, useRef } from 'react'
import { createRoot } from 'react-dom/client'

import { cn } from '@/lib/utils'

export interface ConfirmOptions {
  title: string
  /** What happens if they go ahead, in a sentence or two. */
  body?: string
  /** The confirm button: names the action ("Delete", "Reopen and add"). */
  action: string
  /** Red confirm button, and Cancel takes the first focus. */
  destructive?: boolean
}

/**
 * The app's replacement for `window.confirm`: the same one-line call
 * (`if (!(await confirmDialog({…}))) return`), drawn as the workspace's own
 * modal instead of the browser's. A native `<dialog>` supplies the focus trap,
 * Escape and the inert page; focus returns to whatever was focused before.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const settle = (ok: boolean) => {
      root.unmount()
      host.remove()
      returnFocus?.focus()
      resolve(ok)
    }
    root.render(<ConfirmDialog {...options} onSettle={settle} />)
  })
}

function ConfirmDialog({ title, body, action, destructive, onSettle }: ConfirmOptions & { onSettle: (ok: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const bodyId = useId()

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={body ? bodyId : undefined}
      onCancel={(event) => {
        event.preventDefault()
        onSettle(false)
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onSettle(false)
      }}
      className="lps-pop lps-pop-dialog m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-border bg-popover p-5 text-foreground shadow-[var(--lps-shadow)] backdrop:bg-black/45"
    >
      <h2 id={titleId} className="text-[18px] font-bold text-foreground">{title}</h2>
      {body && (
        <p id={bodyId} className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          autoFocus={destructive}
          onClick={() => onSettle(false)}
          className="min-h-11 cursor-pointer rounded-full border border-border bg-card px-5 text-[13px] font-semibold text-foreground transition-colors duration-150 ease-lps hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          autoFocus={!destructive}
          onClick={() => onSettle(true)}
          className={cn(
            'min-h-11 cursor-pointer rounded-full px-5 text-[13px] font-semibold transition-[opacity,scale] duration-100 ease-lps hover:opacity-90 active:scale-[.97]',
            destructive ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground',
          )}
        >
          {action}
        </button>
      </div>
    </dialog>
  )
}
