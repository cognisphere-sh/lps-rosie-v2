/**
 * Helpers for the artifact routes under `app/a/[agent]/`.
 *
 * Adapted from the harness template at `app/artifacts-routes/` (refreshed on
 * every harness upgrade — diff against it when the upstream copy moves). Two
 * deliberate departures:
 *
 *   1. **The agent is a path segment, not `ARTIFACTS_AGENT`.** More than one
 *      agent here publishes, and the plugin builds its share links as
 *      `<appBaseUrl>/<public|private>/artifacts/<slug>` — so each agent gets
 *      its own `appBaseUrl` (`https://$DOMAIN/a/<agent>`) and one route tree
 *      serves them all. `ARTIFACTS_AGENTS` is the allowlist.
 *   2. **`signedIn()` verifies the session** instead of checking that a cookie
 *      exists — the same check `proxy.ts` makes, shared via `lib/session.ts`.
 *      A private artifact is internal, so it takes an admin: a supplier with a
 *      portal login is signed in to the app but has no business here.
 *
 * Env (server-side only — none of this reaches the browser):
 *   HARNESS_URL           http://127.0.0.1:<HARNESS_PORT>  (scripts/server.sh secrets)
 *   ARTIFACTS_AGENTS      comma-separated publishing agents (scripts/app/secrets.sh)
 *   ARTIFACTS_APP_SECRET  shared with every agent's plugin bucket (same script)
 */
import { resolveUser } from '@/lib/session'

const HARNESS = process.env.HARNESS_URL ?? 'http://127.0.0.1:3142'

export interface ArtifactInfo {
  slug: string
  visibility: 'public' | 'private'
  url: string
  privateUrl: string
  bytes: number
  modified: string
}

/**
 * Both `<agent>` and `<slug>` arrive from the URL and are interpolated into an
 * upstream path, so both are checked before any fetch: the agent against the
 * allowlist, the slug against the plugin's own charset. Anything else is a 404
 * that never leaves the app.
 */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/

export function isPublishingAgent(agent: string): boolean {
  return (process.env.ARTIFACTS_AGENTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(agent)
}

export function isSlug(slug: string): boolean {
  return SLUG_RE.test(slug)
}

/** The plugin endpoint behind one of the app's artifact paths. */
export function artifactUpstream(
  agent: string,
  scope: 'public' | 'private',
  slug: string,
): string {
  return `${HARNESS}/webhook/${agent}/artifacts/${scope}/${encodeURIComponent(slug)}`
}

function secretHeader(): Record<string, string> {
  return { 'x-artifacts-secret': process.env.ARTIFACTS_APP_SECRET ?? '' }
}

/**
 * The app's auth gate for the private artifact routes. `proxy.ts` has already
 * run for these paths; this is the fail-closed second layer that keeps them
 * shut even if the matcher ever changes.
 */
export async function signedIn(req: Request): Promise<boolean> {
  const user = await resolveUser(req.headers.get('cookie') ?? '')
  return user?.role === 'admin'
}

/** Current flag + links for one artifact; null when it doesn't exist. */
export async function artifactMeta(
  agent: string,
  slug: string,
): Promise<ArtifactInfo | null> {
  const r = await fetch(`${artifactUpstream(agent, 'private', slug)}/meta`, {
    headers: secretHeader(),
    cache: 'no-store',
  })
  return r.ok ? ((await r.json()) as ArtifactInfo) : null
}

/** Fetch an artifact's HTML with the secret attached (private view). */
export function fetchPrivateHtml(agent: string, slug: string): Promise<Response> {
  return fetch(artifactUpstream(agent, 'private', slug), {
    headers: secretHeader(),
    cache: 'no-store',
  })
}

/**
 * Relay the harness's HTML response verbatim. The security headers MUST survive
 * the hop: the CSP sandbox is what stops agent-authored HTML from touching this
 * app's cookies and storage.
 */
export async function passThroughHtml(upstream: Response): Promise<Response> {
  const keep = [
    'content-type',
    'content-security-policy',
    'referrer-policy',
    'x-content-type-options',
    'cache-control',
  ]
  const headers = new Headers()
  for (const h of keep) {
    const v = upstream.headers.get(h)
    if (v) headers.set(h, v)
  }
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers,
  })
}
