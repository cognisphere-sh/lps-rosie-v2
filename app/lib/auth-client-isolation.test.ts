import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

/**
 * The shared `supabase` client must never be signed in as a user.
 *
 * supabase-js keeps a session in memory even under `persistSession: false`,
 * and every later PostgREST call on that client then sends the user's JWT
 * instead of the secret key — running as `authenticated` rather than
 * `service_role`, which RLS refuses. `lib/supabase.ts` exports a module
 * singleton, so a single `signInWithPassword` on it poisons every query in the
 * process until it restarts.
 *
 * That is not a hypothetical: portal account creation failed with "new row
 * violates row-level security policy for table app_users" on 2026-08-30,
 * because `verifyCredentials` had signed in on the shared client moments
 * earlier. Password checks now run on a throwaway client (`passwordMatches`).
 *
 * There is no way to catch this in a unit test without a live Supabase, so
 * this reads the source instead — crude, but it fails loudly the moment
 * someone reaches for the convenient client again.
 */
const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

test('no sign-in happens on the shared supabase client', () => {
  for (const path of ['lib/auth.ts', 'lib/supabase.ts', 'lib/partner-auth.ts']) {
    const text = source(path)
    for (const call of ['signInWithPassword', 'signInWithOtp', 'setSession', 'signInWithOAuth']) {
      assert.equal(
        new RegExp(`\\bsupabase\\.auth\\.${call}\\b`).test(text),
        false,
        `${path} signs in on the shared client via supabase.auth.${call} — use a throwaway client`,
      )
    }
  }
})

test('the password check builds its own client and drops the session', () => {
  const text = source('lib/auth.ts')
  // The check exists, and it is the only place a sign-in happens.
  assert.match(text, /async function passwordMatches\(/)
  assert.match(text, /createClient\(url, key/, 'passwordMatches must build its own client')
  assert.match(text, /client\.auth\.signInWithPassword/)
  assert.match(text, /client\.auth\.signOut\(\)/, 'the throwaway session should be dropped')
  assert.equal(
    text.split('signInWithPassword').length - 1,
    1,
    'exactly one sign-in call in the file — a second one means a second place to get this wrong',
  )
})

test('admin accounts are not created from a config credential', () => {
  const text = source('lib/auth.ts')
  // Removed 2026-08-30: a config value that mints privilege on first use is a
  // bootstrap path. Internal accounts come from scripts/create-admin.mjs.
  for (const name of ['ADMIN_USER', 'ADMIN_PASS']) {
    assert.equal(text.includes(name), false, `lib/auth.ts must not read ${name}`)
  }
  assert.equal(/\bensureAdmin\b/.test(text), false)
})

test('is_lps_partner is derived, so nothing in the app writes it', () => {
  // The flag is true exactly while a company has a portal login, maintained by
  // the `app_users_sync_lps_partner` trigger (migration 0084). Two writers
  // would let the flag and the logins disagree — which is the state that let a
  // supplier be marked an LPS Partner with nobody able to sign in.
  const queries = source('lib/queries.ts')
  const writable = queries.slice(queries.indexOf('const WRITABLE'), queries.indexOf('inventory: ['))
  assert.equal(
    writable.includes("'is_lps_partner'"),
    false,
    'is_lps_partner must not be in WRITABLE.suppliers — it is derived',
  )

  assert.equal(
    /is_lps_partner:\s*(true|false)/.test(source('lib/auth.ts')),
    false,
    'lib/auth.ts must leave the flag to the trigger',
  )

  // Read-only on the profile grid: an entry with no `column` gets no editor.
  const page = source('app/(workspace)/suppliers/[id]/page.tsx')
  assert.match(page, /\{ key: 'is_lps_partner', label: 'LPS Partner' \}/)
})
