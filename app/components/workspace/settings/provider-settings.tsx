'use client'

import { Check, ExternalLink, Loader2, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  harnessFetch, providerModels, PROVIDER_ID,
  type OAuthLoginState, type ProviderInfo,
} from '@/lib/harness-settings'
import { cn } from '@/lib/utils'

import { btn, Field, inputClass, Panel, StatusPill } from './parts'

const OAUTH = `/api/harness/models/oauth/${PROVIDER_ID}`

/**
 * Harness-level LLM configuration: the OpenAI Codex subscription login and the
 * model allowlist every agent picks from.
 *
 * Codex is the only provider offered here — it authenticates by OAuth rather
 * than a pasted key, so it is the one provider that can be connected safely
 * from a browser. Anything else stays on the harness console.
 *
 * The login is server-driven: the harness starts pi's own flow and surfaces one
 * interaction at a time (a method chooser, an auth URL, a device code, a
 * question), which we poll for and render. When the harness and the browser are
 * on different machines the provider's localhost callback can't fire, so the
 * paste field below is the path that always works.
 */
export function ProviderSettings({
  provider,
  failed,
  reload,
}: {
  provider: ProviderInfo | null
  failed: boolean
  reload: () => void
}) {
  const [login, setLogin] = useState<OAuthLoginState>({ state: 'idle' })
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [draft, setDraft] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Until the first read lands we know nothing — don't claim "not connected".
  const loaded = provider != null
  const connected = provider?.oauth?.connected ?? false
  const models = providerModels(provider)
  const dirty =
    provider != null &&
    JSON.stringify([...draft].sort()) !== JSON.stringify([...provider.enabledModels].sort())

  useEffect(() => {
    if (provider) setDraft(provider.enabledModels)
  }, [provider])

  // Poll the flow while it is waiting on the operator or on the provider.
  useEffect(() => {
    if (login.state !== 'pending') return
    let live = true
    const timer = setInterval(async () => {
      try {
        const next = await harnessFetch<OAuthLoginState>(`${OAUTH}/status`)
        if (!live) return
        setLogin(next)
        if (next.state === 'success') reload()
      } catch {
        // transient — the next tick retries
      }
    }, 1500)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [login.state, reload])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const startLogin = () =>
    run(async () => {
      setAnswer('')
      setLogin(await harnessFetch<OAuthLoginState>(`${OAUTH}/login`, { method: 'POST' }))
    })

  const submit = (value: string, kind: 'text' | 'select') =>
    run(async () => {
      await harnessFetch(`${OAUTH}/input`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value, kind }),
      })
      setAnswer('')
      setLogin(await harnessFetch<OAuthLoginState>(`${OAUTH}/status`))
    })

  const cancel = () =>
    run(async () => {
      await harnessFetch(`${OAUTH}/cancel`, { method: 'POST' })
      setLogin({ state: 'idle' })
    })

  const signOut = () =>
    run(async () => {
      await harnessFetch(OAUTH, { method: 'DELETE' })
      setLogin({ state: 'idle' })
      reload()
    })

  const saveModels = () =>
    run(async () => {
      setSaving(true)
      try {
        await harnessFetch('/api/harness/models', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ providers: { [PROVIDER_ID]: { enabledModels: draft } } }),
        })
        reload()
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } finally {
        setSaving(false)
      }
    })

  const addCustom = () => {
    const id = custom.trim()
    if (!id || draft.includes(id)) return setCustom('')
    setDraft([...draft, id])
    setCustom('')
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="LLM provider"
        description="OpenAI Codex — a ChatGPT Plus/Pro subscription connected by OAuth, no API key. Every agent in this harness runs on it."
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-bold">OpenAI Codex</span>
          {loaded ? (
            <StatusPill ok={connected} okLabel="Connected" offLabel="Not connected" />
          ) : (
            <span className="text-[12px] text-muted-foreground">Loading…</span>
          )}
          <span className="ml-auto flex gap-2">
            {connected && (
              <button type="button" onClick={signOut} disabled={busy} className={btn('ghost')}>
                Sign out
              </button>
            )}
            <button
              type="button"
              onClick={startLogin}
              disabled={!loaded || busy || login.state === 'pending'}
              className={btn('primary')}
            >
              {connected ? 'Re-connect' : 'Connect'}
            </button>
          </span>
        </div>

        {login.state === 'pending' && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-3">
            <p className="flex items-center gap-2 text-[12px] font-semibold">
              <Loader2 className="size-3.5 animate-spin" />
              Waiting for sign-in…
            </p>
            {login.instructions && (
              <p className="whitespace-pre-wrap text-[12px] text-muted-foreground">{login.instructions}</p>
            )}

            {login.select && (
              <div className="flex flex-col gap-2">
                <p className="text-[12px]">{login.select.message}</p>
                <div className="flex flex-wrap gap-2">
                  {login.select.options.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      disabled={busy}
                      onClick={() => submit(o.id, 'select')}
                      className={btn('outline')}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {login.deviceCode && (
              <p className="text-[12px]">
                Enter code{' '}
                <span className="rounded bg-card px-1.5 py-0.5 font-mono text-[13px] font-bold">
                  {login.deviceCode.userCode}
                </span>{' '}
                at{' '}
                <a
                  href={login.deviceCode.verificationUri}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary underline"
                >
                  {login.deviceCode.verificationUri}
                </a>
              </p>
            )}

            {login.url && (
              <a
                href={login.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-1.5 text-[12px] font-semibold text-primary underline"
              >
                Open the OpenAI sign-in page <ExternalLink className="size-3.5" />
              </a>
            )}

            {!login.select && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="codex-login-answer" className="text-[12px] text-muted-foreground">
                  {login.prompt?.message ??
                    'After approving, paste the full redirect URL you land on (or the authorization code).'}
                </label>
                <div className="flex gap-2">
                  <input
                    id="codex-login-answer"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder={login.prompt?.placeholder ?? 'http://localhost:1455/auth/callback?code=…'}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    disabled={busy || !answer.trim()}
                    onClick={() => submit(answer.trim(), 'text')}
                    className={btn('primary')}
                  >
                    Submit
                  </button>
                </div>
              </div>
            )}

            <button type="button" onClick={cancel} disabled={busy} className={cn(btn('ghost'), 'w-fit')}>
              Cancel
            </button>
          </div>
        )}

        {login.state === 'success' && (
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-primary">
            <Check className="size-3.5" /> Signed in. Agents on this provider were restarted.
          </p>
        )}
        {login.state === 'error' && (
          <p role="alert" className="text-[12px] font-semibold text-destructive">{login.message}</p>
        )}
        {error && <p role="alert" className="text-[12px] font-semibold text-destructive">{error}</p>}
      </Panel>

      <Panel
        title="Enabled models"
        description="The allowlist agents choose from. Saving restarts every agent running on this provider."
      >
        {!provider ? (
          <p className="text-[12px] text-muted-foreground">{failed ? 'Couldn’t load models.' : 'Loading…'}</p>
        ) : (
          <>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {models.map((id) => {
                const on = draft.includes(id)
                return (
                  <label
                    key={id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors duration-150 ease-lps',
                      on ? 'border-primary bg-secondary/40' : 'border-border bg-card',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setDraft(on ? draft.filter((m) => m !== id) : [...draft, id])
                      }
                      className="size-3.5 accent-[var(--primary)]"
                    />
                    <span className="min-w-0 truncate font-mono text-[12px]">{id}</span>
                    {!provider.catalogModels.includes(id) && (
                      <span className="ml-auto flex-none rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        custom
                      </span>
                    )}
                  </label>
                )
              })}
            </div>

            <Field label="Add a model id not in the catalog">
              <div className="flex gap-2">
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCustom()
                    }
                  }}
                  placeholder="gpt-5.6-terra"
                  className={inputClass}
                />
                <button type="button" onClick={addCustom} className={btn('outline')}>
                  <Plus className="size-3.5" /> Add
                </button>
              </div>
            </Field>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={saveModels}
                disabled={!dirty || saving}
                className={btn('primary')}
              >
                {saving ? 'Saving…' : 'Save models'}
              </button>
              {saved && (
                <span className="lps-pop flex items-center gap-1 text-[12px] font-semibold text-primary">
                  <Check className="size-3.5" /> Saved
                </span>
              )}
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}
