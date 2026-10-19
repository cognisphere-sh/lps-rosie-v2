'use client'

import { useState } from 'react'

/**
 * The one password-change form. It is drawn twice: on `/change-password`,
 * where an account still on a generated password is held until it completes,
 * and on the portal's Settings page, where it is an ordinary thing to do.
 *
 * Both post the same `/api/auth/password`, which verifies the current password
 * and re-mints the session cookie. It is deliberately unstyled beyond the
 * portal's own tokens and takes no layout of its own — the two callers frame
 * it differently.
 */

/** Matches `MIN_PASSWORD_LENGTH` in `lib/auth.ts`; the server is the real check. */
export const MIN_PASSWORD_LENGTH = 10

const label = 'text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground'
const field =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-[13px] outline-none focus-visible:border-ring'

export function ChangePasswordForm({
  submitLabel = 'Change password',
  onDone,
}: {
  submitLabel?: string
  /** Fired after the server accepted the change; gets the path it suggests. */
  onDone?: (next: string) => void
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  // Checked here only to say so before a round trip; the server checks it too,
  // and a mismatch is the one thing it cannot see.
  const mismatch = confirm.length > 0 && next !== confirm
  const ready = current.length > 0 && next.length >= MIN_PASSWORD_LENGTH && next === confirm

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const body = (await res.json().catch(() => ({}))) as { next?: string; error?: string }
      if (!res.ok) {
        setError(body.error ?? 'Could not change your password.')
        setBusy(false)
        return
      }
      setCurrent('')
      setNext('')
      setConfirm('')
      setDone(true)
      setBusy(false)
      onDone?.(body.next ?? '/')
    } catch {
      setError('Could not reach the server.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-0.5">
        <span className={label}>Current password</span>
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          className={field}
        />
      </label>

      <label className="flex flex-col gap-0.5">
        <span className={label}>New password</span>
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          className={field}
        />
        <span className="text-[11px] text-muted-foreground">
          At least {MIN_PASSWORD_LENGTH} characters. Pick something only you know.
        </span>
      </label>

      <label className="flex flex-col gap-0.5">
        <span className={label}>Confirm new password</span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          className={field}
        />
        {mismatch && (
          <span className="text-[11px] text-destructive">The two do not match.</span>
        )}
      </label>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-[12px] text-destructive">
          {error}
        </p>
      )}

      {done && !error && (
        <p className="rounded-md border border-primary/40 bg-accent/40 px-2.5 py-2 text-[12px] text-foreground">
          Password changed.
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy || !ready}
          className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
