/**
 * What a failed write says to the person who made it.
 *
 * Route handlers pass their error through as `{ error }`, and many of those are
 * already sentences written for people — a trigger's `RAISE EXCEPTION`, a
 * validation message. Those are kept. What is replaced is the plumbing that
 * leaks through the same channel: a dropped connection, a lock or statement
 * timeout, a raw Postgres constraint or a PostgREST code. Each becomes the
 * caller's own `fallback` ("Could not save Price") plus what to do about it.
 */

const NETWORK = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i
const BUSY = /lock timeout|lock_timeout|statement timeout|canceling statement|deadlock/i
const DUPLICATE = /duplicate key|already exists/i
const INVALID = /violates (?:check|not-null|foreign key) constraint|invalid input (?:syntax|value)|out of range|value too long/i
// `job_requests delete: …` — a query helper's own prefix on a database error.
const TABLE_PREFIX = /^[a-z]+_[a-z_]+\b[^:]{0,24}:/
const PLUMBING = /\bPGRST\d+|\bSQLSTATE\b|relation "|column "|permission denied|unexpected token|is not valid json|JSON\.parse|TypeError|ReferenceError|undefined|null value in column/i

export function errorCopy(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const message = raw.replace(/^Error:\s*/, '').trim()
  if (NETWORK.test(message)) return `${fallback} — couldn't reach the server. Check your connection and try again.`
  if (BUSY.test(message)) return `${fallback} — the record was busy. Try again in a moment.`
  if (DUPLICATE.test(message)) return `${fallback} — that already exists.`
  if (INVALID.test(message)) return `${fallback} — that value isn't allowed here.`
  if (!message || TABLE_PREFIX.test(message) || PLUMBING.test(message)) return `${fallback}. Try again; if it keeps failing, reload the page.`
  return message
}
