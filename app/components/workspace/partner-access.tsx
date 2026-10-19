'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, RefreshCw, Trash2 } from 'lucide-react'

/**
 * Portal access for a supplier — the one place an LPS Partner's logins are
 * made, rolled, handed over and removed. It fills the supplier page's
 * **Portal access** tab (`?tab=access`) and is the only surface for any of it.
 *
 * Accounts belong to the **company**, not to a farm: opened from any branch
 * page it shows and edits the head branch's accounts, and the URL it hands you
 * is that company's portal. A company may have several logins (an owner and a
 * yard manager), so this is a list with an add form rather than a single
 * button.
 *
 * Creating the first account also marks the supplier an LPS Partner — the flag
 * and the login are one decision, and a portal is useless without the flag
 * (`partnerSupplier()` refuses anyone whose flag is false).
 *
 * A generated password is shown **once**, right after it is made: Supabase
 * stores a hash and nothing can read it back. That is why the panel leads with
 * a copy button for the whole hand-over message rather than a tidy summary —
 * copy it now or reset it later.
 */

interface Account {
  id: string
  username: string
  createdAt: string
}

/** What the server just minted, held only until the next write or reload. */
interface Minted {
  username: string
  password: string
  url: string
}

const label = 'text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground'
const field =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-[13px] outline-none focus-visible:border-ring'

/** The message that goes to the supplier — everything they need, nothing else. */
function handoverText(m: Minted, supplierName: string): string {
  return [
    `${supplierName} — your Local Plant Supply partner portal`,
    '',
    `Sign in: ${m.url}`,
    `Username: ${m.username}`,
    `Password: ${m.password}`,
    '',
    'Availability requests from us arrive here; answer them and press Save.',
  ].join('\n')
}

function CopyButton({ text, children }: { text: string; children: React.ReactNode }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1600)
        } catch {
          // Clipboard denied (insecure origin, or the user said no). The text
          // is on screen and selectable, so there is nothing to recover from.
        }
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-[12px] font-semibold hover:bg-muted"
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
      {done ? 'Copied' : children}
    </button>
  )
}

/**
 * The panel: the account list with its per-account reset and delete, the add
 * form, and the credentials of whatever was last minted.
 */
export function PartnerAccessPanel({
  supplierId,
  supplierName,
  defaultUsername,
  onChanged,
}: {
  supplierId: number
  supplierName: string
  /** Prefill for the add form — the supplier's primary contact email. */
  defaultUsername?: string
  /** Fired after a write, so the page can pick up `is_lps_partner`. */
  onChanged: () => void
}) {
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [scopeId, setScopeId] = useState<number | null>(null)
  const [username, setUsername] = useState(defaultUsername ?? '')
  const [minted, setMinted] = useState<Minted | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const portalUrl = useCallback(
    (id: number | null) =>
      `${typeof window === 'undefined' ? '' : window.location.origin}/partner/${id ?? supplierId}`,
    [supplierId],
  )

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/partner-account`, { cache: 'no-store' })
      const body = (await res.json()) as {
        accounts?: Account[]
        scopeId?: number | null
        error?: string
      }
      if (!res.ok) throw new Error(body.error ?? `${res.status}`)
      setAccounts(body.accounts ?? [])
      setScopeId(body.scopeId ?? null)
    } catch (e) {
      setError((e as Error).message)
      setAccounts([])
    }
  }, [supplierId])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * One write, then re-read. `mints` says whether the reply carries a password
   * to show — create and reset do, delete does not, and showing a stale
   * credentials box after a delete would be worse than showing none.
   */
  const write = async (init: RequestInit, mints = true, optimistic?: () => void) => {
    setBusy(true)
    setError(null)
    // Optimistic where nothing has to come back first (a removal); a failed
    // write re-reads the accounts to undo it.
    optimistic?.()
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/partner-account`, {
        headers: { 'content-type': 'application/json' },
        ...init,
      })
      const body = (await res.json()) as {
        username?: string
        password?: string
        scopeId?: number | null
        error?: string
      }
      if (!res.ok) throw new Error(body.error ?? `${res.status}`)
      if (mints) {
        setMinted({
          username: body.username!,
          password: body.password!,
          url: portalUrl(body.scopeId ?? scopeId),
        })
        setUsername('')
      } else {
        setMinted(null)
      }
      await load()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
      if (optimistic) await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[14px] font-bold text-foreground">Portal access</span>
        <span className="text-[12px] text-muted-foreground">
          {supplierName} — sign-ins for the partner portal. One set of logins per company,
          shared across its farms.
        </span>
      </div>

      {/* The credentials, while they are still readable. */}
      {minted && (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/40 bg-accent/40 p-3">
          <span className="text-[12px] font-semibold text-foreground">
            Save these now — the password cannot be shown again.
          </span>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
            <dt className="text-muted-foreground">Portal</dt>
            <dd className="break-all font-medium">{minted.url}</dd>
            <dt className="text-muted-foreground">Username</dt>
            <dd className="break-all font-medium">{minted.username}</dd>
            <dt className="text-muted-foreground">Password</dt>
            <dd className="font-mono font-medium tracking-wide">{minted.password}</dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={handoverText(minted, supplierName)}>Copy message</CopyButton>
            <CopyButton text={minted.url}>Copy link</CopyButton>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-[12px] text-destructive">
          {error}
        </p>
      )}

      {/* Existing logins. */}
      <div className="flex flex-col gap-1.5">
        <span className={label}>Accounts</span>
        {accounts === null && <p className="text-[12px] text-muted-foreground">Loading…</p>}
        {accounts?.length === 0 && (
          <p className="text-[12px] text-muted-foreground">
            None yet. Adding the first one also marks this supplier an LPS Partner.
          </p>
        )}
        {accounts?.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5"
          >
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{a.username}</span>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void write({ method: 'PATCH', body: JSON.stringify({ accountId: a.id }) })
              }
              className="inline-flex h-8 flex-none items-center gap-1.5 rounded-md border border-border px-2.5 text-[12px] font-semibold hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw size={13} />
              Reset password
            </button>
            <button
              type="button"
              disabled={busy}
              aria-label={`Delete ${a.username}`}
              title="Delete this login"
              onClick={() => {
                // Irreversible and immediate — whoever holds this login is
                // signed out of the portal for good — so it asks first, and
                // names the account so nobody deletes the wrong row.
                if (!window.confirm(`Delete the login "${a.username}"? They lose portal access immediately. This cannot be undone.`)) return
                void write({ method: 'DELETE', body: JSON.stringify({ accountId: a.id }) }, false,
                  () => setAccounts((current) => current?.filter((account) => account.id !== a.id) ?? current))
              }}
              className="inline-flex size-8 flex-none items-center justify-center rounded-md border border-border text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* Add one. */}
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          void write({ method: 'POST', body: JSON.stringify({ username }) })
        }}
      >
        <label className="flex flex-col gap-0.5">
          <span className={label}>Add an account</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username or email"
            autoComplete="off"
            spellCheck={false}
            className={field}
          />
        </label>
        <span className="text-[11px] text-muted-foreground">
          What they type to sign in. An email is fine; it is never written to.
        </span>
        <div className="mt-1 flex justify-end gap-2">
          <button
            type="submit"
            disabled={busy || !username.trim()}
            className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Create login'}
          </button>
        </div>
      </form>
    </div>
  )
}
