import { structuredJobIdentityLine } from '@/lib/job-identity'

export interface JobInboxRow {
  id: number
  name: string | null
  status: string
  /** Legacy compact display value; structured identity must not read this. */
  customer: string | null
  customerCompany: string | null
  customerContact: string | null
  createdAt: string | null
  updatedAt: string | null
  thread: null | {
    lastId: number
    lastAt: string | null
    lastText: string
    webReadId: number
  }
}

export interface JobInboxViewRow extends JobInboxRow {
  activityAt: number
  activityKind: 'chat' | 'record'
  preview: string
  unread: boolean
}

const CANONICAL_ID = /^[1-9]\d*$/

/** Accept exactly one canonical positive safe integer `jr`; null means the key is absent. */
export function parseJobSelection(values: string[]):
  | { kind: 'bare' }
  | { kind: 'invalid' }
  | { kind: 'valid'; id: number } {
  if (values.length === 0) return { kind: 'bare' }
  if (values.length !== 1 || !CANONICAL_ID.test(values[0])) return { kind: 'invalid' }
  const id = Number(values[0])
  return Number.isSafeInteger(id) ? { kind: 'valid', id } : { kind: 'invalid' }
}

export const canonicalJobThread = (id: number) => `jr-${id}`

function stamp(raw: string | null): number {
  if (!raw) return 0
  const value = Date.parse(raw)
  return Number.isFinite(value) ? value : 0
}

export function presentJobInboxRow(row: JobInboxRow): JobInboxViewRow {
  const chatAt = stamp(row.thread?.lastAt ?? null)
  const recordAt = Math.max(stamp(row.updatedAt), stamp(row.createdAt))
  const chatWins = Boolean(row.thread) && chatAt >= recordAt
  const text = row.thread?.lastText.trim() ?? ''
  return {
    ...row,
    activityAt: chatWins ? chatAt : recordAt,
    activityKind: chatWins ? 'chat' : 'record',
    preview: chatWins
      ? (text || 'Attachment or empty web message')
      : row.thread
        ? 'Job record updated'
        : 'No web conversation yet',
    unread: Boolean(row.thread && row.thread.lastId > row.thread.webReadId),
  }
}

export function orderJobInbox(rows: JobInboxRow[]): JobInboxViewRow[] {
  return rows.map(presentJobInboxRow).sort((a, b) =>
    b.activityAt - a.activityAt ||
    Number(b.activityKind === 'chat') - Number(a.activityKind === 'chat') ||
    b.id - a.id,
  )
}

export interface JobThreadPatch {
  agent: string
  threadId: string
  lastId: number
  lastAt: number
  lastText: string
  webReadId: number
  closed: boolean
}

/** Monotonic patch: stale fetch/SSE/read events cannot move a row backwards. */
export function patchJobInbox(rows: JobInboxRow[], event: JobThreadPatch): JobInboxRow[] {
  if (event.agent !== 'rosie') return rows
  const match = /^jr-([1-9]\d*)$/.exec(event.threadId)
  if (!match) return rows
  const id = Number(match[1])
  const index = rows.findIndex((row) => row.id === id && canonicalJobThread(row.id) === event.threadId)
  if (index < 0) return rows
  if (event.closed) return rows.filter((row) => row.id !== id)
  const current = rows[index].thread
  if (current && event.lastId < current.lastId) return rows
  const next = [...rows]
  next[index] = {
    ...rows[index],
    thread: {
      lastId: Math.max(current?.lastId ?? 0, event.lastId),
      lastAt: new Date(Math.max(stamp(current?.lastAt ?? null), event.lastAt)).toISOString(),
      lastText: event.lastId >= (current?.lastId ?? 0) ? event.lastText : current?.lastText ?? '',
      webReadId: Math.max(current?.webReadId ?? 0, event.webReadId),
    },
  }
  return next
}

/** Message preview and shared read cursor are independent monotonic dimensions. */
function mergeThread(
  current: NonNullable<JobInboxRow['thread']>,
  incoming: NonNullable<JobInboxRow['thread']>,
): NonNullable<JobInboxRow['thread']> {
  const message = incoming.lastId >= current.lastId ? incoming : current
  return {
    lastId: Math.max(current.lastId, incoming.lastId),
    lastAt: message.lastAt,
    lastText: message.lastText,
    webReadId: Math.max(current.webReadId, incoming.webReadId),
  }
}

/**
 * Reconcile an authoritative poll against mutations observed after it started.
 *
 * Rows not in `changedAfterFetch` take the poll verbatim, including `thread:null`
 * and omission (closed/inactive). A row changed by SSE after the request began
 * keeps that newer membership/thread evidence; message and read dimensions are
 * merged separately so neither can regress the other.
 */
export function mergeJobInbox(
  current: JobInboxRow[],
  incoming: JobInboxRow[],
  changedAfterFetch: ReadonlySet<number> = new Set(),
): JobInboxRow[] {
  const old = new Map(current.map((row) => [row.id, row]))
  const incomingIds = new Set(incoming.map((row) => row.id))
  const next = incoming.flatMap((row) => {
    if (!changedAfterFetch.has(row.id)) return [row]
    const prior = old.get(row.id)
    // A listed row closed after this fetch started: its absence is a tombstone.
    if (!prior) return []
    if (!prior.thread) return [{ ...row, thread: null }]
    if (!row.thread) return [prior]
    return [{ ...row, thread: mergeThread(prior.thread, row.thread) }]
  })
  for (const row of current) {
    if (changedAfterFetch.has(row.id) && !incomingIds.has(row.id)) next.push(row)
  }
  return next
}

export type JobInboxEventAction = 'ignore' | 'patch' | 'remove-and-refresh' | 'verify-refresh'

/** Unknown reopen-like events are verified by the API; they never mint a row client-side. */
export function jobInboxEventAction(rows: JobInboxRow[], event: JobThreadPatch): JobInboxEventAction {
  if (event.agent !== 'rosie') return 'ignore'
  const match = /^jr-([1-9]\d*)$/.exec(event.threadId)
  if (!match) return 'ignore'
  const id = Number(match[1])
  const listed = rows.some((row) => row.id === id && canonicalJobThread(row.id) === event.threadId)
  if (!listed) return event.closed ? 'ignore' : 'verify-refresh'
  return event.closed ? 'remove-and-refresh' : 'patch'
}

export const jobInboxLayout = (width: number): 'mobile' | 'desktop' => width < 900 ? 'mobile' : 'desktop'

export const FOCUSED_JOBS_RAIL_STORE = 'lps.jobs.rail.open.v1'

/** An unset or malformed preference keeps the discoverable first-visit default open. */
export const focusedJobsRailOpen = (stored: string | null): boolean => stored !== '0'

/** Focused-row switches replace; the redirecting bare parser state retains its legacy result. */
export const jobInboxNavigationAction = (selection: 'bare' | 'valid' | 'invalid'): 'push' | 'replace' =>
  selection === 'bare' ? 'push' : 'replace'

/** New replaces a selected/detail entry; starting from All jobs adds an entry. */
export const jobInboxNewNavigationAction = (fromSelectedEntry: boolean): 'push' | 'replace' =>
  fromSelectedEntry ? 'replace' : 'push'

/** Restore only on an intentional focused/detail → bare transition, never poll or resize. */
export function shouldRestoreJobInbox(
  previous: 'bare' | 'valid' | 'invalid',
  current: 'bare' | 'valid' | 'invalid',
  pendingExit: boolean,
  enteredFromLanding: boolean,
): boolean {
  return previous !== 'bare' && current === 'bare' && (pendingExit || enteredFromLanding)
}

export type JobInboxMembership = 'loading' | 'error' | 'listed' | 'pending' | 'unavailable'

/** Do not call an id unavailable until one successful active-list response established membership. */
export function jobInboxMembership(
  selection: 'bare' | 'valid' | 'invalid',
  ready: boolean,
  error: boolean,
  listed: boolean,
  pending: boolean,
): JobInboxMembership {
  if (selection === 'bare') return ready ? 'listed' : error ? 'error' : 'loading'
  if (!ready) return error ? 'error' : 'loading'
  if (selection === 'invalid') return 'unavailable'
  if (listed) return 'listed'
  return pending ? 'pending' : 'unavailable'
}

export function jobInboxIdentityLine(
  row: Pick<JobInboxRow, 'name' | 'customerCompany' | 'customerContact'>,
): string {
  return structuredJobIdentityLine({
    name: row.name,
    customer: row.customerCompany || row.customerContact
      ? { company: row.customerCompany, name: row.customerContact }
      : null,
  })
}

export const jobInboxRailPrimaryLine = (
  row: Pick<JobInboxRow, 'id' | 'name' | 'customerCompany' | 'customerContact'>,
): string => {
  const identity = jobInboxIdentityLine(row)
  return identity ? `JR-${row.id} · ${identity}` : `JR-${row.id}`
}

export function jobInboxRowAriaLabel(
  row: Pick<JobInboxViewRow, 'id' | 'name' | 'customerCompany' | 'customerContact' | 'status' | 'preview' | 'unread'>,
  statusLabel: string,
  activityLabel: string,
): string {
  const readState = row.unread ? 'Unread web chat' : 'No unread web chat'
  return `${jobInboxRailPrimaryLine(row)}, ${statusLabel}, ${row.preview}, ${activityLabel}, ${readState}`
}

export function hasFocusedIntakeEvidence(
  id: number,
  marker: { id?: number } | null,
): boolean {
  return Number.isSafeInteger(id) && id > 0 && marker?.id === id
}
