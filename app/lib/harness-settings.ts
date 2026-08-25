/**
 * Types and the fetch helper for the harness-backed halves of `/settings`.
 *
 * The browser can't call the harness directly — it's on another origin with no
 * CORS headers — so everything here goes through `/api/harness/*`, an
 * allowlisted pass-through that forwards the user's `pi_sid` cookie (the same
 * cookie the harness console authenticates with; app users *are* harness
 * users). The one exception is Google sign-in, which `next.config.ts` rewrites
 * straight through so Google's redirect lands back on this origin.
 *
 * Shapes mirror the harness API — `src/api/models.ts`, `src/api/agents.ts`,
 * `src/api/gws-oauth.ts` and the scheduler plugin's `state/schedules.json`.
 */

/** The only provider this app authenticates. Others stay on the console. */
export const PROVIDER_ID = 'openai-codex'

/** Scheduler plugin state, relative to the agent dir. */
export const SCHEDULES_PATH = 'plugins/scheduler/state/schedules.json'

export const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const
export type ThinkingLevel = (typeof THINKING_LEVELS)[number]

export type ProviderInfo = {
  id: string
  displayName: string
  configured: boolean
  catalogModels: string[]
  enabledModels: string[]
  notes?: string
  oauth?: { supported: true; connected: boolean }
}

/** One step of the provider's OAuth flow, as the harness surfaces it. */
export type OAuthLoginState =
  | { state: 'idle' }
  | {
      state: 'pending'
      url?: string
      instructions?: string
      select?: { message: string; options: { id: string; label: string }[] }
      deviceCode?: { userCode: string; verificationUri: string }
      prompt?: { message: string; placeholder?: string }
    }
  | { state: 'success' }
  | { state: 'error'; message: string }

export type AgentJson = {
  name: string
  model?: { provider: string; id: string; thinkingLevel?: ThinkingLevel }
  [key: string]: unknown
}

export type GwsAgentStatus = {
  agentId: string
  name: string
  signedIn: boolean
  email: string | null
  scopes: string[]
}

export type GwsStatus = {
  client: { clientId: string; clientSecret: string }
  agents: GwsAgentStatus[]
}

export type HarnessInfo = { timezone: string; version?: string }

export type Schedule = {
  name: string
  cron: string
  text: string
  threadId: string
  channelId?: string
  paused?: boolean
  onetime?: boolean
}

/**
 * One call against the harness. Non-2xx bodies carry `{ error }`, so unwrap it
 * into the thrown message — every panel here renders `err.message` verbatim.
 */
export async function harnessFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: 'no-store', ...init })
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    // non-JSON error page (e.g. the app's own 401) — fall through to status
  }
  if (!res.ok) {
    const message = (body as { error?: string } | null)?.error
    throw new Error(message ?? `${res.status} ${res.statusText}`)
  }
  return body as T
}

/** Every model id offered for an agent: the catalog plus any custom enabled id. */
export function providerModels(provider: ProviderInfo | null): string[] {
  if (!provider) return []
  return [...new Set([...provider.catalogModels, ...provider.enabledModels])].sort()
}
