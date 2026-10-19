'use client'

import Image from 'next/image'
import { Cron } from 'croner'
import { Check, ExternalLink, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { chatBlockedReason, type Agent } from '@/lib/agents'
import {
  harnessFetch, providerModels, SCHEDULES_PATH, THINKING_LEVELS,
  type AgentJson, type GwsStatus, type HarnessInfo, type ProviderInfo, type Schedule,
  type ThinkingLevel,
} from '@/lib/harness-settings'
import { cn } from '@/lib/utils'

import { AgentAppearance } from './agent-appearance'
import { btn, Field, inputClass, Panel, StatusPill } from './parts'

type AgentInfo = {
  id: string
  agentJson: AgentJson
  installedPlugins: string[]
  state: string
  error?: string | null
}

/**
 * One agent's harness configuration: which model it runs on, its Google
 * account, and the cron schedules its scheduler plugin will fire.
 *
 * Everything here writes through to the harness, which hot-reloads the agent —
 * there is no separate "apply" step and no server bounce.
 */
export function AgentSettings({
  agent,
  provider,
  banner,
}: {
  agent: Agent
  provider: ProviderInfo | null
  /** `?gws=…` feedback from Google's redirect back into this tab. */
  banner: { kind: 'ok' | 'error'; message: string } | null
}) {
  const [info, setInfo] = useState<AgentInfo | null>(null)
  const [gws, setGws] = useState<GwsStatus | null>(null)
  const [schedules, setSchedules] = useState<Schedule[] | null>(null)
  const [timezone, setTimezone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const next = await harnessFetch<AgentInfo>(`/api/harness/agents/${agent.id}`)
      setInfo(next)
      if (next.installedPlugins.includes('gws')) {
        setGws(await harnessFetch<GwsStatus>('/api/harness/gws/oauth'))
      } else {
        setGws(null)
      }
      if (next.installedPlugins.includes('scheduler')) {
        setSchedules(await readSchedules(agent.id))
        // Cron fires in the harness timezone, not the viewer's — the next-run
        // column is meaningless without it.
        setTimezone((await harnessFetch<HarnessInfo>('/api/harness/harness')).timezone)
      } else {
        setSchedules(null)
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }, [agent.id])

  useEffect(() => {
    setInfo(null)
    setGws(null)
    setSchedules(null)
    setTimezone(null)
    void load()
  }, [load])

  const gwsAgent = gws?.agents.find((a) => a.agentId === agent.id) ?? null

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

  const signIn = () =>
    run(async () => {
      const { url } = await harnessFetch<{ url: string }>(`/api/harness/gws/oauth/${agent.id}/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          redirectUri: `${window.location.origin}/api/gws/oauth/callback`,
          returnTo: `/settings?tab=${agent.id}`,
        }),
      })
      window.location.href = url
    })

  const signOut = () =>
    run(async () => {
      await harnessFetch(`/api/harness/gws/oauth/${agent.id}`, { method: 'DELETE' })
      await load()
    })

  /** Rewrite `schedules.json` from a fresh read. The agent writes this file
   *  too and the plugin reloads on any change to it, so never write back the
   *  list this page last rendered. */
  const editSchedules = (edit: (current: Schedule[]) => Schedule[]) =>
    run(async () => {
      const next = edit(await readSchedules(agent.id))
      await harnessFetch(fsUrl(agent.id), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: JSON.stringify({ schedules: next }, null, 2) + '\n' }),
      })
      setSchedules(next)
    })

  const togglePause = (name: string) =>
    editSchedules((current) =>
      current.map((s) => (s.name === name ? { ...s, paused: !s.paused } : s)),
    )

  const removeSchedule = (name: string) => {
    if (!window.confirm(`Delete the schedule “${name}”? The agent set this up itself.`)) return
    editSchedules((current) => current.filter((s) => s.name !== name))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Image src={agent.avatar} alt="" width={36} height={36} className="size-9 rounded-full" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-bold">{agent.name}</h2>
          <p className="truncate text-[12px] text-muted-foreground">{agent.role}</p>
        </div>
        {info && (
          <StatusPill ok={info.state === 'running'} okLabel="Running" offLabel={info.state} />
        )}
        <button type="button" onClick={() => void load()} className={btn('outline')} title="Reload">
          <RefreshCw className="size-3.5" />
        </button>
      </div>

      {banner && (
        <p
          className={cn(
            'rounded-xl px-3 py-2 text-[12px] font-semibold',
            banner.kind === 'ok'
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-lps-warn-bg text-lps-warn-fg',
          )}
        >
          {banner.message}
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-lps-warn-bg px-3 py-2 text-[12px] font-semibold text-lps-warn-fg">
          {error}
        </p>
      )}
      {info?.error && (
        <p className="rounded-xl bg-lps-warn-bg px-3 py-2 text-[12px] font-semibold text-lps-warn-fg">
          {info.error}
        </p>
      )}

      {/* Chat theme and wallpaper style this agent's panel conversation —
          nothing to style for an agent reached on another channel. */}
      {!chatBlockedReason(agent) && <AgentAppearance agent={agent} />}

      <ModelPanel agent={agent} info={info} provider={provider} onSaved={load} />

      <GooglePanel
        installed={info ? info.installedPlugins.includes('gws') : true}
        clientConfigured={!!gws?.client.clientId}
        status={gwsAgent}
        busy={busy}
        onSignIn={signIn}
        onSignOut={signOut}
      />

      <SchedulePanel
        installed={info ? info.installedPlugins.includes('scheduler') : true}
        schedules={schedules}
        timezone={timezone}
        busy={busy}
        onToggle={togglePause}
        onDelete={removeSchedule}
      />
    </div>
  )
}

// ── model ────────────────────────────────────────────────────────────

function ModelPanel({
  agent,
  info,
  provider,
  onSaved,
}: {
  agent: Agent
  info: AgentInfo | null
  provider: ProviderInfo | null
  onSaved: () => Promise<void>
}) {
  const [model, setModel] = useState('')
  const [thinking, setThinking] = useState<ThinkingLevel>('medium')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!info) return
    setModel(info.agentJson.model?.id ?? '')
    setThinking(info.agentJson.model?.thinkingLevel ?? 'medium')
  }, [info])

  // The agent's current id may predate the allowlist — keep it selectable.
  const options = [...new Set([...providerModels(provider), model].filter(Boolean))].sort()
  const current = info?.agentJson.model
  const dirty = !!info && (model !== (current?.id ?? '') || thinking !== (current?.thinkingLevel ?? 'medium'))

  const save = async () => {
    if (!info) return
    setSaving(true)
    setError(null)
    try {
      // Write agent.json back whole: it also holds the agent's description,
      // thread strategy, slots and secrets schema, none of which are ours.
      const config: AgentJson = {
        ...info.agentJson,
        model: { provider: info.agentJson.model?.provider ?? 'openai-codex', id: model, thinkingLevel: thinking },
      }
      await harnessFetch(`/api/harness/agents/${agent.id}/config`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      await onSaved()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel
      title="Model"
      description="The model this agent runs on. Saving rewrites agent.json and reloads the agent; in-flight work finishes on the old one."
    >
      {!info ? (
        <p className="text-[12px] text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Model">
              <select value={model} onChange={(e) => setModel(e.target.value)} className={inputClass}>
                {options.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Thinking level">
              <select
                value={thinking}
                onChange={(e) => setThinking(e.target.value as ThinkingLevel)}
                className={inputClass}
              >
                {THINKING_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Provider <span className="font-mono">{current?.provider ?? 'openai-codex'}</span> — set once
            for the whole harness on the Global tab.
          </p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={save} disabled={!dirty || saving} className={btn('primary')}>
              {saving ? 'Saving…' : 'Save model'}
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-[12px] font-semibold text-primary">
                <Check className="size-3.5" /> Saved
              </span>
            )}
            {error && <span className="text-[12px] font-semibold text-lps-warn-fg">{error}</span>}
          </div>
        </>
      )}
    </Panel>
  )
}

// ── google ───────────────────────────────────────────────────────────

function GooglePanel({
  installed,
  clientConfigured,
  status,
  busy,
  onSignIn,
  onSignOut,
}: {
  installed: boolean
  clientConfigured: boolean
  status: { signedIn: boolean; email: string | null; scopes: string[] } | null
  busy: boolean
  onSignIn: () => void
  onSignOut: () => void
}) {
  if (!installed) {
    return (
      <Panel title="Google account" description="This agent has no gws plugin, so it has no Google access.">
        <p className="text-[12px] text-muted-foreground">Nothing to configure.</p>
      </Panel>
    )
  }
  return (
    <Panel
      title="Google account"
      description="The Google Workspace account this agent reads and sends mail as. Gmail read/write is always requested; extra services come from the plugin's oauthScopes."
      action={status ? <StatusPill ok={status.signedIn} okLabel="Signed in" offLabel="Signed out" /> : undefined}
    >
      {!status ? (
        <p className="text-[12px] text-muted-foreground">Loading…</p>
      ) : (
        <>
          {status.signedIn && (
            <p className="text-[13px] font-semibold">{status.email ?? 'Signed in'}</p>
          )}
          {status.scopes.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {status.scopes.map((scope) => (
                <li
                  key={scope}
                  className="truncate rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                >
                  {scope.replace('https://www.googleapis.com/auth/', '')}
                </li>
              ))}
            </ul>
          )}
          {!clientConfigured && (
            <p className="rounded-lg bg-lps-warn-bg px-3 py-2 text-[12px] font-semibold text-lps-warn-fg">
              No Google OAuth client saved yet — add one on the harness console&rsquo;s Settings page first.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSignIn}
              disabled={busy || !clientConfigured}
              className={btn('primary')}
            >
              {status.signedIn ? 'Re-connect' : 'Sign in with Google'} <ExternalLink className="size-3.5" />
            </button>
            {status.signedIn && (
              <button type="button" onClick={onSignOut} disabled={busy} className={btn('ghost')}>
                Sign out
              </button>
            )}
          </div>
        </>
      )}
    </Panel>
  )
}

// ── scheduler ────────────────────────────────────────────────────────

function SchedulePanel({
  installed,
  schedules,
  timezone,
  busy,
  onToggle,
  onDelete,
}: {
  installed: boolean
  schedules: Schedule[] | null
  timezone: string | null
  busy: boolean
  onToggle: (name: string) => void
  onDelete: (name: string) => void
}) {
  if (!installed) {
    return (
      <Panel title="Scheduled tasks" description="This agent has no scheduler plugin.">
        <p className="text-[12px] text-muted-foreground">Nothing to configure.</p>
      </Panel>
    )
  }
  return (
    <Panel
      title="Scheduled tasks"
      description={`Cron timers the agent fires against its own threads${
        timezone ? `, in ${timezone}` : ', in the harness timezone'
      }. Pause or delete here; the agent creates and edits them itself.`}
    >
      {!schedules ? (
        <p className="text-[12px] text-muted-foreground">Loading…</p>
      ) : schedules.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">No schedules.</p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-lps-hair text-[11px] font-bold uppercase tracking-[.06em] text-lps-dim">
                <th className="py-2 pr-3 font-bold">On</th>
                <th className="py-2 pr-3 font-bold">Name</th>
                <th className="py-2 pr-3 font-bold">Cron</th>
                <th className="py-2 pr-3 font-bold">Next run</th>
                <th className="py-2 pr-3 font-bold">Thread</th>
                <th className="py-2 font-bold">Message</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.name} className="border-b border-lps-hair align-top last:border-0">
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!s.paused}
                        aria-label={`${s.paused ? 'Resume' : 'Pause'} ${s.name}`}
                        disabled={busy}
                        onClick={() => onToggle(s.name)}
                        className={cn(
                          'inline-flex h-5 w-9 flex-none items-center rounded-full p-0.5 transition-colors disabled:opacity-50',
                          s.paused ? 'bg-muted' : 'bg-primary',
                        )}
                      >
                        <span
                          className={cn(
                            'size-4 rounded-full bg-card shadow-sm transition-transform',
                            s.paused ? 'translate-x-0' : 'translate-x-4',
                          )}
                        />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${s.name}`}
                        title="Delete"
                        disabled={busy}
                        onClick={() => onDelete(s.name)}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-lps-warn-bg hover:text-lps-warn-fg disabled:opacity-50"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="block break-words text-[12px] font-semibold">{s.name}</span>
                    {s.onetime && (
                      <span className="mt-1 inline-block rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        one-time
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 font-mono text-[12px]">{s.cron}</td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-[12px] text-muted-foreground">
                    {nextRun(s, timezone)}
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-[12px] text-muted-foreground">{s.threadId}</td>
                  <td className="py-2.5">
                    <p className="max-w-[400px] whitespace-pre-wrap text-[12px] leading-relaxed text-muted-foreground">
                      {s.text}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

/**
 * When this schedule fires next, in the harness's timezone — computed with the
 * same `croner` the scheduler plugin registers its timers with, so the answer
 * matches what will actually happen rather than approximating it.
 *
 * A paused schedule has no timer at all; a one-time schedule that already fired
 * is paused by the plugin, so both read as "—".
 */
function nextRun(s: Schedule, timezone: string | null): string {
  if (s.paused) return '—'
  if (!timezone) return '…'
  try {
    const at = new Cron(s.cron, { timezone }).nextRun()
    if (!at) return 'never'
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(at)
  } catch {
    return 'invalid cron'
  }
}

const fsUrl = (agentId: string) =>
  `/api/harness/agents/${agentId}/fs/file?path=${encodeURIComponent(SCHEDULES_PATH)}`

async function readSchedules(agentId: string): Promise<Schedule[]> {
  const { content } = await harnessFetch<{ content: string }>(fsUrl(agentId))
  const parsed = JSON.parse(content) as { schedules?: Schedule[] }
  return parsed.schedules ?? []
}
