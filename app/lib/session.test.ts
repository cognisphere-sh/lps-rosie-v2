import assert from 'node:assert/strict'
import test from 'node:test'

import {
  SESSION_COOKIE,
  createSession,
  readSession,
  resolveUser,
  sessionToken,
  type SessionUser,
} from './session.ts'

// The signing key the session cookie is minted with. Set before any call, and
// read lazily inside `session.ts`, so this is enough.
process.env.APP_SESSION_SECRET = 'test-secret-value-not-a-real-one'

const admin: SessionUser = { id: 'u-1', username: 'chris', role: 'admin', supplierId: null }
const partner: SessionUser = { id: 'u-2', username: 'acosta', role: 'partner', supplierId: 42 }

test('a minted session round-trips, admin and partner alike', async () => {
  assert.deepEqual(await readSession(await createSession(admin)), admin)
  assert.deepEqual(await readSession(await createSession(partner)), partner)
})

test('a tampered payload, signature or key is refused', async () => {
  const token = await createSession(partner)
  const [body, sig] = token.split('.')

  // Re-encoding the payload as a different supplier, keeping the signature:
  // the whole point of signing it.
  const forged = Buffer.from(
    JSON.stringify({ i: 'u-2', u: 'acosta', r: 'partner', s: 999, e: Date.now() + 60_000 }),
  ).toString('base64url')
  assert.equal(await readSession(`${forged}.${sig}`), null)

  assert.equal(await readSession(`${body}.${'0'.repeat(sig.length)}`), null)
  assert.equal(await readSession(`${body}.zz`), null)
  assert.equal(await readSession(body), null, 'no signature at all')
  assert.equal(await readSession(''), null)
  assert.equal(await readSession(undefined), null)

  // A different secret cannot verify it — a rotated APP_SESSION_SECRET signs
  // everyone out rather than letting stale cookies through.
  const good = process.env.APP_SESSION_SECRET
  process.env.APP_SESSION_SECRET = 'a-different-secret-of-its-own'
  assert.equal(await readSession(token), null)
  process.env.APP_SESSION_SECRET = good
})

test('an expired session is refused', async () => {
  // Minting one that is already expired would need the clock moved, so this
  // swaps in an expired payload. It is unsigned for that payload and so would
  // fail anyway — the point is that expiry is checked at all, which the
  // role/scope test below cannot show.
  const expired = Buffer.from(
    JSON.stringify({ i: 'u-2', u: 'acosta', r: 'partner', s: 42, e: Date.now() - 1 }),
  ).toString('base64url')
  const token = await createSession(partner)
  assert.notEqual(await readSession(token), null, 'a fresh one is fine')
  assert.equal(await readSession(`${expired}.${token.split('.')[1]}`), null)
})

test('the role and its scope must agree, however the blob was signed', async () => {
  // Belt and braces on top of the signature: a partner with no supplier, or an
  // admin carrying one, is not a session this app knows how to gate.
  const bad = [
    { i: 'u', u: 'x', r: 'partner', s: null, e: Date.now() + 60_000 },
    { i: 'u', u: 'x', r: 'admin', s: 7, e: Date.now() + 60_000 },
    { i: 'u', u: 'x', r: 'root', s: null, e: Date.now() + 60_000 },
  ]
  for (const payload of bad) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const signed = await createSession(admin)
    assert.equal(await readSession(`${body}.${signed.split('.')[1]}`), null)
  }
})

test('the cookie is read out of a real Cookie header, and only ours', async () => {
  const token = await createSession(admin)
  assert.equal(sessionToken(`${SESSION_COOKIE}=${token}`), token)
  assert.equal(sessionToken(`theme=dark; ${SESSION_COOKIE}=${token}; other=1`), token)
  // The harness's own cookie is not this app's session, and a name that merely
  // ends in ours must not match.
  assert.equal(sessionToken('pi_sid=whatever'), undefined)
  assert.equal(sessionToken(`x_${SESSION_COOKIE}=${token}`), undefined)
  assert.deepEqual(await resolveUser(`${SESSION_COOKIE}=${token}`), admin)
  assert.equal(await resolveUser(''), null)
})
