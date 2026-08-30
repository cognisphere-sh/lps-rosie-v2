/**
 * Who is signed in — the one place that answers it.
 *
 * The app owns its own sign-in as of 2026-08-30. A session is an `app_sid`
 * cookie this app mints and signs with `APP_SESSION_SECRET`; the harness's
 * `pi_sid` is gone from the app entirely (the harness console keeps its own,
 * on its own port, and the app now reaches the harness with the
 * `HARNESS_APP_SECRET` bearer instead — see `lib/harness.ts`).
 *
 * Everything here is Web Crypto and string maths, deliberately: `proxy.ts`
 * runs on the edge runtime, where `node:crypto` does not exist, and it needs
 * the same verification the route handlers use. Nothing in this file may
 * import `server-only` code — `lib/auth.ts` is where the Supabase half lives.
 */

/** The cookie the app mints. Deliberately not the harness's `pi_sid`. */
export const SESSION_COOKIE = 'app_sid'

/** Sessions last a working fortnight; a partner should not re-type monthly. */
const TTL_MS = 14 * 24 * 60 * 60 * 1000

export type Role = 'admin' | 'partner'

/** A verified session. `supplierId` is the portal a partner may see. */
export interface SessionUser {
  /** The Supabase Auth user id. */
  id: string
  username: string
  role: Role
  /** Non-null exactly when `role === 'partner'`. */
  supplierId: number | null
}

/** What actually rides in the cookie — short keys, since it is signed whole. */
type Payload = {
  i: string
  u: string
  r: Role
  s: number | null
  /** Expiry, epoch ms. */
  e: number
}

const enc = new TextEncoder()

function b64urlEncode(s: string): string {
  const bytes = enc.encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): string | null {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// One import per process. The secret is read lazily rather than at module
// scope so an unset env var fails the request that needed it, not the build.
let cachedKey: { secret: string; key: Promise<CryptoKey> } | null = null

function signingKey(): Promise<CryptoKey> {
  const secret = process.env.APP_SESSION_SECRET
  if (!secret) {
    throw new Error(
      'APP_SESSION_SECRET is not set (scripts/server.sh secrets writes it into app/.env.local)',
    )
  }
  if (cachedKey?.secret !== secret) {
    cachedKey = {
      secret,
      key: crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
        'sign',
        'verify',
      ]),
    }
  }
  return cachedKey.key
}

/** Mint a signed session token for `user`, good for {@link TTL_MS}. */
export async function createSession(user: SessionUser): Promise<string> {
  const payload: Payload = {
    i: user.id,
    u: user.username,
    r: user.role,
    s: user.supplierId,
    e: Date.now() + TTL_MS,
  }
  const body = b64urlEncode(JSON.stringify(payload))
  const sig = await crypto.subtle.sign('HMAC', await signingKey(), enc.encode(body))
  return `${body}.${hex(sig)}`
}

/** How long a freshly minted cookie should live, in seconds. */
export const SESSION_MAX_AGE = Math.floor(TTL_MS / 1000)

/**
 * Verify a token and return its session, or null.
 *
 * Fails closed on anything at all: bad shape, bad signature, expired, or a
 * missing secret. `crypto.subtle.verify` does the comparison, so a wrong
 * signature costs the same time as a right one.
 */
export async function readSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null
  const dot = token.indexOf('.')
  if (dot <= 0 || dot === token.length - 1) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!/^[0-9a-f]+$/.test(sig) || sig.length % 2 !== 0) return null

  const bytes = new Uint8Array(sig.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(sig.slice(i * 2, i * 2 + 2), 16)

  try {
    const ok = await crypto.subtle.verify('HMAC', await signingKey(), bytes, enc.encode(body))
    if (!ok) return null
  } catch {
    return null
  }

  const json = b64urlDecode(body)
  if (!json) return null
  let payload: Payload
  try {
    payload = JSON.parse(json) as Payload
  } catch {
    return null
  }
  if (typeof payload?.e !== 'number' || payload.e <= Date.now()) return null
  if (payload.r !== 'admin' && payload.r !== 'partner') return null
  if (typeof payload.i !== 'string' || typeof payload.u !== 'string') return null

  const supplierId = typeof payload.s === 'number' ? payload.s : null
  // The signature already proves we minted this, but the role/scope pairing is
  // load-bearing for the gate, so re-assert it rather than trust the blob.
  if (payload.r === 'partner' && supplierId === null) return null
  if (payload.r === 'admin' && supplierId !== null) return null

  return { id: payload.i, username: payload.u, role: payload.r, supplierId }
}

/** Pull `app_sid` out of a raw Cookie header. */
export function sessionToken(cookieHeader: string): string | undefined {
  const m = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`).exec(cookieHeader)
  return m ? decodeURIComponent(m[1]) : undefined
}

/** The signed-in user behind a request, or null. */
export async function resolveUser(cookieHeader: string): Promise<SessionUser | null> {
  return readSession(sessionToken(cookieHeader))
}
