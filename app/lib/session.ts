/**
 * Who is signed in — the one place that answers it.
 *
 * `pi_sid` is a *signed* stateless session cookie minted by the harness, so its
 * presence proves nothing; only the harness can say whether it is valid. Both
 * the app-wide gate (`proxy.ts`) and the artifact routes (`lib/artifacts.ts`)
 * ask through here, so there is a single definition of a real session rather
 * than one per caller.
 */
const HARNESS_URL = process.env.HARNESS_URL ?? 'http://127.0.0.1:3142'

/** The signed-in username, or null. Fails closed on any error. */
export async function resolveUser(cookie: string): Promise<string | null> {
  if (!/(^|;\s*)pi_sid=/.test(cookie)) return null
  try {
    const res = await fetch(`${HARNESS_URL}/api/auth/me`, {
      headers: { cookie },
      cache: 'no-store',
    })
    if (!res.ok) return null
    // /me answers 200 with { user: null } when the session is bad — the status
    // alone is not the answer.
    const body = (await res.json()) as { user?: string | null }
    return body.user ?? null
  } catch {
    // Harness unreachable: fail closed. An outage must not open the database.
    return null
  }
}
