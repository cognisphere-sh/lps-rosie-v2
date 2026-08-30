import 'server-only'

import { randomBytes } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'
import type { Role, SessionUser } from '@/lib/session'

/**
 * The Supabase-Auth half of sign-in — everything `lib/session.ts` deliberately
 * cannot do, because it has to run on the edge.
 *
 * Supabase Auth owns passwords (hashing, verification, rotation). This app
 * owns the session: on a good password we mint our own signed `app_sid`
 * cookie and never touch a Supabase session again. `public.app_users`
 * (migration 0081) is the app-side half of the identity — the login handle,
 * the role, and the one supplier a partner may see.
 *
 * Two populations sign in:
 *   - the internal team (`role: 'admin'`), created directly in Supabase;
 *   - LPS Partner suppliers, whose accounts are created from the supplier page.
 *
 * Nothing here creates an admin. An account exists before anyone signs in, or
 * the sign-in fails — there is no bootstrap path that mints privilege out of a
 * config value, and no config value to steal. Adding an internal user means
 * creating the Supabase Auth user and its `app_users` row by hand
 * (docs/app/README.md, *Auth*).
 *
 * Partner accounts belong to the **company**, never to one of its farms: they
 * hang off the head branch, and one login sees every branch's portal (see
 * `partnerScopeId` and `canAccessSupplier`). A company may have several — an
 * owner and a yard manager both answering — but a branch never has its own.
 *
 * Env (server-side only): `AUTH_EMAIL_DOMAIN`, written into `app/.env.local`
 * by the `scripts/app/secrets.sh` hook.
 */

/**
 * Supabase Auth identifies a user by email; this app identifies them by a
 * username someone typed. So the email is *derived* and never shown: a typed
 * address is used as-is, anything else becomes `<slug>@<AUTH_EMAIL_DOMAIN>`.
 *
 * The default domain is `.invalid` (RFC 2606) on purpose — these mailboxes do
 * not exist, and no Supabase mail must ever be sent to one. Accounts are
 * created `email_confirm: true` for the same reason.
 */
export function authEmail(username: string): string {
  const u = username.trim().toLowerCase()
  if (u.includes('@')) return u
  const domain = process.env.AUTH_EMAIL_DOMAIN || 'app.invalid'
  return `${u.replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')}@${domain}`
}

/** Usernames are compared and stored case-insensitively; this is the form. */
function normalize(username: string): string {
  return username.trim().toLowerCase()
}

/**
 * A generated password: 16 characters from an alphabet with no `0/o/1/l/i`,
 * grouped in fours so it survives being read down a phone. ~78 bits.
 */
export function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = randomBytes(16)
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length])
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join('')).join('-')
}

type AppUserRow = {
  id: string
  username: string
  role: Role
  supplier_id: number | null
  must_change_password: boolean
  created_at: string
}

const COLUMNS = 'id, username, role, supplier_id, must_change_password, created_at'

async function rowByUsername(username: string): Promise<AppUserRow | null> {
  // `eq`, not `ilike`: `_` and `%` are wildcards to LIKE, so `bob_smith` would
  // match `bobxsmith` — enough to make a legitimate login fail on the
  // two-rows-matched error, or a name look taken when it isn't. Rows are always
  // written through `normalize()`, so an exact match on the normalized form is
  // the same case-insensitive lookup the unique index enforces.
  const { data, error } = await supabase
    .from('app_users')
    .select(COLUMNS)
    .eq('username', normalize(username))
    .maybeSingle()
  if (error) throw new Error(`app_users: ${error.message}`)
  return (data as AppUserRow | null) ?? null
}

/**
 * The company a supplier id belongs to — its head branch, which for a
 * single-site supplier is itself. Null when the id is not an active supplier.
 *
 * `head_branch_id` is never null and never chains (docs/supabase-schema.md),
 * so one hop is the whole answer.
 */
export async function partnerScopeId(supplierId: number): Promise<number | null> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, head_branch_id')
    .eq('id', supplierId)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw new Error(`suppliers: ${error.message}`)
  const row = data as { id: number; head_branch_id: number | null } | null
  return row ? (row.head_branch_id ?? row.id) : null
}

/**
 * May this session read this supplier's portal?
 *
 * The admin may read every one. A partner may read their own company's — the
 * head branch their account hangs off, and any branch of it — and nothing
 * else. Every `/partner` page and `/api/partner` route asks this before it
 * reads a row: `proxy.ts` can only see the shape of the path, not which
 * company an id belongs to, so the real scoping has to live here.
 */
export async function canAccessSupplier(
  user: SessionUser,
  supplierId: number,
): Promise<boolean> {
  if (user.role === 'admin') return true
  if (user.supplierId === null) return false
  if (user.supplierId === supplierId) return true
  return (await partnerScopeId(supplierId)) === user.supplierId
}

function toSession(row: AppUserRow): SessionUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    supplierId: row.role === 'partner' ? row.supplier_id : null,
    mustChangePassword: row.must_change_password,
  }
}

/**
 * Check a password against Supabase Auth, on a client of its own.
 *
 * **Never sign in on the shared `supabase` client.** supabase-js keeps the
 * session in memory even under `persistSession: false`, and every subsequent
 * PostgREST call on that client then sends the signed-in user's JWT instead of
 * the secret key — so it runs as `authenticated` rather than `service_role`
 * and RLS refuses it. `supabase` is a module singleton, so one sign-in would
 * poison it for the whole process: the first symptom was portal account
 * creation failing with "new row violates row-level security policy for table
 * app_users" for whoever had signed in most recently (2026-08-30).
 *
 * A throwaway client per attempt has no such reach. It is discarded here.
 */
async function passwordMatches(email: string, password: string, userId: string): Promise<boolean> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set')

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || data.user?.id !== userId) return false
  // Drop the session rather than leaving a live refresh token behind; the
  // client is garbage after this either way.
  await client.auth.signOut().catch(() => {})
  return true
}

/**
 * Check a username and password. Returns the session to mint, or null.
 *
 * Note that every attempt reaches Supabase from this one server, so GoTrue's
 * per-IP rate limiting cannot tell two callers apart. The login route is the
 * place to add throttling if this ever faces the open internet with more than
 * a handful of accounts.
 */
export async function verifyCredentials(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  if (!username || !password) return null

  const row = await rowByUsername(username)
  if (!row) return null

  if (!(await passwordMatches(authEmail(row.username), password, row.id))) return null
  return toSession(row)
}

export interface PartnerAccount {
  id: string
  username: string
  createdAt: string
}

/**
 * Every portal account for a supplier's **company**, oldest first.
 *
 * Called with any branch id and answers for the whole company, because that is
 * where the accounts live — a farm page shows its company's logins rather than
 * pretending it has none (migrations 0082/0083).
 */
export async function partnerAccounts(supplierId: number): Promise<PartnerAccount[]> {
  const scopeId = await partnerScopeId(supplierId)
  if (scopeId === null) return []
  const { data, error } = await supabase
    .from('app_users')
    .select(COLUMNS)
    .eq('supplier_id', scopeId)
    .eq('role', 'partner')
    .order('created_at', { ascending: true })
  if (error) throw new Error(`app_users: ${error.message}`)
  return ((data ?? []) as AppUserRow[]).map((r) => ({
    id: r.id,
    username: r.username,
    createdAt: r.created_at,
  }))
}

/**
 * Give a supplier another portal account. Their first one also makes them an
 * LPS Partner — the flag follows the logins (migration 0084), so this is the
 * only way it turns on.
 *
 * Returns the generated password, which is the only time it is ever readable:
 * Supabase stores a hash, so a lost password is reset, not recovered.
 */
export async function createPartnerAccount(
  supplierId: number,
  username: string,
): Promise<{ username: string; password: string }> {
  const handle = normalize(username)
  if (!handle) throw new Error('a username is required')
  if (handle.length > 120) throw new Error('username is too long')

  // The account hangs off the company, wherever the button was pressed.
  const scopeId = await partnerScopeId(supplierId)
  if (scopeId === null) throw new Error('supplier not found')

  // Usernames are global, so the clash to catch is with any account at all,
  // not just this company's.
  if (await rowByUsername(handle)) {
    throw new Error(`the username "${handle}" is already taken`)
  }

  const password = generatePassword()
  const { data, error } = await supabase.auth.admin.createUser({
    email: authEmail(handle),
    password,
    email_confirm: true,
  })
  if (error || !data.user) {
    throw new Error(`auth.admin.createUser: ${error?.message ?? 'no user returned'}`)
  }

  const { error: insErr } = await supabase
    .from('app_users')
    .insert({
      id: data.user.id,
      username: handle,
      role: 'partner',
      supplier_id: scopeId,
      // Handed over on a password we generated, so the first thing they do
      // with it is replace it (migration 0087).
      must_change_password: true,
    })
  if (insErr) {
    await supabase.auth.admin.deleteUser(data.user.id)
    throw new Error(`app_users insert: ${insErr.message}`)
  }

  // `suppliers.is_lps_partner` is not set here: the
  // `app_users_sync_lps_partner` trigger (migration 0084) has already turned
  // it on for the head branch, and will turn it off again when the last login
  // goes. One writer, so the flag and the logins cannot disagree.
  return { username: handle, password }
}

/**
 * Remove one portal account for good.
 *
 * Deleting the Supabase Auth user is the whole of it: `app_users.id` is an FK
 * to it `ON DELETE CASCADE`, so the app-side row goes with it and the username
 * is free again. Scoped by company like the reset, so a caller holding one
 * supplier's page cannot delete another's login by id.
 *
 * Deleting the company's LAST login clears `suppliers.is_lps_partner`, via the
 * same trigger that set it: no login means nobody can open the portal, so the
 * company should not be offered one to send requests to (migration 0084).
 */
export async function deletePartnerAccount(
  supplierId: number,
  accountId: string,
): Promise<{ username: string }> {
  const scopeId = await partnerScopeId(supplierId)
  if (scopeId === null) throw new Error('supplier not found')

  const { data, error } = await supabase
    .from('app_users')
    .select(COLUMNS)
    .eq('id', accountId)
    .eq('supplier_id', scopeId)
    .eq('role', 'partner')
    .maybeSingle()
  if (error) throw new Error(`app_users: ${error.message}`)
  const row = data as AppUserRow | null
  if (!row) throw new Error('no such portal account for this supplier')

  const { error: delErr } = await supabase.auth.admin.deleteUser(row.id)
  if (delErr) throw new Error(`auth.admin.deleteUser: ${delErr.message}`)
  return { username: row.username }
}

/**
 * Roll one portal account's password. Returns the new one, once.
 *
 * The account is looked up by id *and* company, so a caller holding one
 * supplier's page can never reset another company's login by id alone.
 */
export async function resetPartnerPassword(
  supplierId: number,
  accountId: string,
): Promise<{ username: string; password: string }> {
  const scopeId = await partnerScopeId(supplierId)
  if (scopeId === null) throw new Error('supplier not found')
  const { data, error } = await supabase
    .from('app_users')
    .select(COLUMNS)
    .eq('id', accountId)
    .eq('supplier_id', scopeId)
    .eq('role', 'partner')
    .maybeSingle()
  if (error) throw new Error(`app_users: ${error.message}`)
  const row = data as AppUserRow | null
  if (!row) throw new Error('no such portal account for this supplier')

  const password = generatePassword()
  const { error: updErr } = await supabase.auth.admin.updateUserById(row.id, { password })
  if (updErr) throw new Error(`auth.admin.updateUserById: ${updErr.message}`)

  // A reset puts them back on a generated password, so it owes a change again
  // exactly as the first hand-over did. Their live cookie still says otherwise
  // until it is re-minted, which the next sign-in does — and the reset is why
  // they are signing in again.
  const { error: flagErr } = await supabase
    .from('app_users')
    .update({ must_change_password: true })
    .eq('id', row.id)
  if (flagErr) throw new Error(`app_users: ${flagErr.message}`)

  return { username: row.username, password }
}

/**
 * The minimum a password someone chooses for themselves must clear.
 *
 * Length only, and nothing about character classes: a generated password is
 * what we are getting them off, and composition rules push people towards
 * `Password1!` rather than towards something long.
 */
export const MIN_PASSWORD_LENGTH = 10

/**
 * Change the signed-in account's own password, having proved they know the
 * current one. Returns the session to re-mint — the same user with
 * `mustChangePassword` cleared, because the cookie is what the gate reads and
 * a stale one would keep sending them back to the form they just completed.
 *
 * This is the only self-service password write, and it works for either role:
 * it is scoped to the caller's own `id` from their session, so there is
 * nothing here that can reach another account.
 */
export async function changeOwnPassword(
  user: SessionUser,
  currentPassword: string,
  newPassword: string,
): Promise<SessionUser> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`the new password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  }
  if (newPassword === currentPassword) {
    throw new Error('the new password must be different from the current one')
  }

  const { data, error } = await supabase
    .from('app_users')
    .select(COLUMNS)
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw new Error(`app_users: ${error.message}`)
  const row = data as AppUserRow | null
  // The session is signed, so this is a deleted account rather than a forged
  // one — the cookie outlived the row it names.
  if (!row) throw new Error('this account no longer exists')

  if (!(await passwordMatches(authEmail(row.username), currentPassword, row.id))) {
    throw new Error('the current password is not right')
  }

  const { error: updErr } = await supabase.auth.admin.updateUserById(row.id, {
    password: newPassword,
  })
  if (updErr) throw new Error(`auth.admin.updateUserById: ${updErr.message}`)

  const { error: flagErr } = await supabase
    .from('app_users')
    .update({ must_change_password: false })
    .eq('id', row.id)
  if (flagErr) throw new Error(`app_users: ${flagErr.message}`)

  return { ...toSession(row), mustChangePassword: false }
}
