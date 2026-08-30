/**
 * Create an internal (`role: 'admin'`) app account, or set its password.
 *
 *   cd app && set -a && source ../config && set +a \
 *     && node scripts/create-admin.mjs <username> '<password>'
 *
 * This is the only way an admin account comes into being, **and the only way
 * to change one's password**. The app deliberately has no bootstrap path —
 * nothing in `config` mints privilege, and `verifyCredentials()` refuses a
 * username with no `app_users` row — so an internal user is created here, out
 * of band, before they can sign in. Run it again on an existing admin and it
 * resets the password instead; that is the intended way to rotate one.
 * Supplier logins are not made this way: those come from the Portal access
 * panel on the supplier page, which has its own reset.
 *
 * Both halves of the identity are written, in the order that leaves no
 * wreckage if the second fails: the Supabase Auth user (which owns the
 * password) and the `app_users` row (which owns the handle and the role).
 *
 * The password is taken from argv so it never lands in a file, and nothing
 * here prints it. Shell history will hold it — prefix the command with a
 * space, or rotate afterwards, if that matters on this box.
 */
import { createClient } from '@supabase/supabase-js'

const [username, password] = process.argv.slice(2)
const { SUPABASE_URL, SUPABASE_SECRET_KEY, AUTH_EMAIL_DOMAIN } = process.env

if (!username || !password) {
  console.error("usage: node scripts/create-admin.mjs <username> '<password>'")
  process.exit(2)
}
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set — source ../config first')
  process.exit(2)
}

/** The same derivation `lib/auth.ts` uses; the two must not drift. */
const handle = username.trim().toLowerCase()
const email = handle.includes('@')
  ? handle
  : `${handle.replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')}@${AUTH_EMAIL_DOMAIN || 'app.invalid'}`

const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: existing, error: lookupErr } = await db
  .from('app_users')
  .select('id, role')
  .eq('username', handle)
  .maybeSingle()
if (lookupErr) throw new Error(`app_users: ${lookupErr.message}`)

// A partner's password is reset from the supplier page, against their own
// company. Rolling one from here would sidestep that scoping.
if (existing && existing.role !== 'admin') {
  console.error(`"${handle}" is a ${existing.role} account — reset it from the supplier page.`)
  process.exit(1)
}

let userId
let action
if (existing) {
  const { error } = await db.auth.admin.updateUserById(existing.id, { password })
  if (error) throw new Error(`auth.admin.updateUserById: ${error.message}`)
  userId = existing.id
  action = 'password-reset'
} else {
  // `email_confirm: true` so Supabase never tries to send anything — the
  // derived address is on an `.invalid` domain with no mailbox behind it.
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new Error(`auth.admin.createUser: ${error.message}`)

  const { error: insErr } = await db
    .from('app_users')
    .insert({ id: data.user.id, username: handle, role: 'admin', supplier_id: null })
  if (insErr) {
    // Don't strand an auth user with no app_users row: it would be invisible
    // to every lookup here and would hold the email hostage.
    await db.auth.admin.deleteUser(data.user.id)
    throw new Error(`app_users insert: ${insErr.message}`)
  }
  userId = data.user.id
  action = 'created'
}

// Prove the credential works through the very call the login route makes,
// rather than trusting that the write landed. On a client of its own: signing
// in on `db` would leave it holding a user JWT, and every later PostgREST call
// through it would run as `authenticated` instead of `service_role` (the bug
// `passwordMatches()` in lib/auth.ts exists to avoid). Nothing follows here,
// but the next person to add a step would be bitten.
const verifier = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data: signIn, error: signInErr } = await verifier.auth.signInWithPassword({ email, password })
const verified = !signInErr && signIn.user?.id === userId

console.log(
  JSON.stringify({ username: handle, authEmail: email, role: 'admin', userId, action, signInVerified: verified }, null, 2),
)
if (!verified) {
  console.error('WARNING: the account was created but the password did not verify.')
  process.exit(1)
}
