import 'server-only'

/**
 * The app's server-to-server client for the cognisphere harness.
 *
 * Until 2026-08-30 the app forwarded the browser's `pi_sid` cookie, because
 * app users *were* harness users. They no longer are — the app owns its
 * sign-in (Supabase Auth, `lib/auth.ts`) and nobody signing into it has a
 * harness session at all. So the app authenticates as itself, with the bearer
 * secret harness 0.12.0 introduced, and names the acting user in a header:
 *
 *   Authorization: Bearer $HARNESS_APP_SECRET   (harness/.secrets/app-secret)
 *   X-App-User:    <username>                   (trusted only with the bearer)
 *
 * The bearer carries **full operator access**. Nothing here may be exposed as
 * a general proxy — `app/api/harness/[...path]` allowlists the reachable
 * endpoints, and every caller is behind the `proxy.ts` gate.
 */
const HARNESS_URL = process.env.HARNESS_URL ?? 'http://127.0.0.1:3142'

/** The headers that authenticate this app to the harness, as `username`. */
export function harnessAuthHeaders(username: string): Record<string, string> {
  const secret = process.env.HARNESS_APP_SECRET
  if (!secret) {
    throw new Error(
      'HARNESS_APP_SECRET is not set (scripts/server.sh secrets writes it into app/.env.local)',
    )
  }
  return { authorization: `Bearer ${secret}`, 'x-app-user': username }
}

/** Call a harness path (`/api/…`, `/webhook/…`) as `username`. */
export function harnessFetch(
  path: string,
  username: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers)
  for (const [k, v] of Object.entries(harnessAuthHeaders(username))) headers.set(k, v)
  return fetch(`${HARNESS_URL}${path}`, { ...init, headers, cache: 'no-store' })
}
