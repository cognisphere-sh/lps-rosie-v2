import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  hasFocusedIntakeEvidence, jobInboxEventAction, jobInboxLayout, mergeJobInbox,
  orderJobInbox, parseJobSelection, patchJobInbox, type JobInboxRow,
} from './job-inbox.ts'

const row = (id: number, overrides: Partial<JobInboxRow> = {}): JobInboxRow => ({
  id, name: null, status: 'sourcing', customer: null,
  createdAt: '2026-08-29T10:00:00Z', updatedAt: null, thread: null, ...overrides,
})

test('jr selection accepts one canonical positive safe integer only', () => {
  assert.deepEqual(parseJobSelection([]), { kind: 'bare' })
  assert.deepEqual(parseJobSelection(['12']), { kind: 'valid', id: 12 })
  for (const value of ['', '0', '-1', '+1', '01', '1.0', '1x', '9007199254740992']) {
    assert.deepEqual(parseJobSelection([value]), { kind: 'invalid' }, value)
  }
  assert.deepEqual(parseJobSelection(['1', '2']), { kind: 'invalid' })
})

test('activity uses max timestamp, chat wins exact ties, then id desc', () => {
  const ordered = orderJobInbox([
    row(1, { updatedAt: '2026-08-29T12:00:00Z', thread: { lastId: 2, lastAt: '2026-08-29T11:00:00Z', lastText: 'old', webReadId: 0 } }),
    row(2, { updatedAt: '2026-08-29T12:00:00Z' }),
    row(3, { updatedAt: '2026-08-29T12:00:00Z', thread: { lastId: 1, lastAt: '2026-08-29T12:00:00Z', lastText: '', webReadId: 1 } }),
    row(4, { createdAt: null, updatedAt: 'not-a-date' }),
  ])
  assert.deepEqual(ordered.map((r) => r.id), [3, 2, 1, 4])
  assert.equal(ordered[0].preview, 'Attachment or empty web message')
  assert.equal(ordered[1].preview, 'No web conversation yet')
  assert.equal(ordered[2].preview, 'Job record updated')
  assert.equal(ordered[2].unread, true)
})

test('SSE patches exact listed Rosie JR rows monotonically and close removes', () => {
  const start = [row(8, { thread: { lastId: 5, lastAt: '2026-08-29T12:00:00Z', lastText: 'five', webReadId: 2 } })]
  const ignored = patchJobInbox(start, { agent: 'daisy', threadId: 'jr-8', lastId: 9, lastAt: Date.now(), lastText: 'x', webReadId: 0, closed: false })
  assert.equal(ignored, start)
  assert.equal(patchJobInbox(start, { agent: 'rosie', threadId: 'customer-8', lastId: 9, lastAt: Date.now(), lastText: 'x', webReadId: 0, closed: false }), start)
  const stale = patchJobInbox(start, { agent: 'rosie', threadId: 'jr-8', lastId: 4, lastAt: Date.now(), lastText: 'stale', webReadId: 1, closed: false })
  assert.equal(stale, start)
  const read = patchJobInbox(start, { agent: 'rosie', threadId: 'jr-8', lastId: 5, lastAt: Date.parse('2026-08-29T12:00:00Z'), lastText: 'five', webReadId: 5, closed: false })
  assert.equal(orderJobInbox(read)[0].unread, false)
  assert.deepEqual(patchJobInbox(read, { agent: 'rosie', threadId: 'jr-8', lastId: 5, lastAt: 0, lastText: '', webReadId: 5, closed: true }), [])
})

test('post-fetch SSE merge keeps message and read dimensions independently monotonic', () => {
  const current = [row(9, { thread: { lastId: 10, lastAt: '2026-08-29T13:00:00Z', lastText: 'ten', webReadId: 10 } })]
  const newerMessageOldRead = [row(9, { name: 'fresh record name', thread: { lastId: 11, lastAt: '2026-08-29T14:00:00Z', lastText: 'eleven', webReadId: 3 } })]
  const merged = mergeJobInbox(current, newerMessageOldRead, new Set([9]))
  assert.equal(merged[0].name, 'fresh record name')
  assert.equal(merged[0].thread?.lastId, 11)
  assert.equal(merged[0].thread?.lastText, 'eleven')
  assert.equal(merged[0].thread?.webReadId, 10)

  const newerReadOldMessage = [row(9, { thread: { lastId: 8, lastAt: '2026-08-29T12:00:00Z', lastText: 'eight', webReadId: 12 } })]
  const reverse = mergeJobInbox(current, newerReadOldMessage, new Set([9]))
  assert.equal(reverse[0].thread?.lastId, 10)
  assert.equal(reverse[0].thread?.lastText, 'ten')
  assert.equal(reverse[0].thread?.webReadId, 12)
})

test('authoritative polls clear null/closed rows while post-fetch close is a tombstone', () => {
  const withThread = row(9, { thread: { lastId: 10, lastAt: '2026-08-29T13:00:00Z', lastText: 'ten', webReadId: 3 } })
  assert.equal(mergeJobInbox([withThread], [row(9)])[0].thread, null)
  assert.deepEqual(mergeJobInbox([withThread], []), [])
  // A close observed after the request started removed current row 9; stale
  // incoming membership cannot resurrect it while revision 9 is marked changed.
  assert.deepEqual(mergeJobInbox([], [withThread], new Set([9])), [])
})

test('unknown canonical reopen-like SSE requires verified refresh and never patches', () => {
  const event = { agent: 'rosie', threadId: 'jr-9', lastId: 11, lastAt: Date.now(), lastText: 'back', webReadId: 3, closed: false }
  assert.equal(jobInboxEventAction([], event), 'verify-refresh')
  assert.equal(jobInboxEventAction([row(9)], event), 'patch')
  assert.equal(jobInboxEventAction([row(9)], { ...event, closed: true }), 'remove-and-refresh')
  assert.equal(jobInboxEventAction([], { ...event, closed: true }), 'ignore')
})

test('focused intake requires exact same-tab evidence, not active list membership', () => {
  assert.equal(hasFocusedIntakeEvidence(9, null), false)
  assert.equal(hasFocusedIntakeEvidence(9, { id: 8 }), false)
  assert.equal(hasFocusedIntakeEvidence(9, { id: 9 }), true)
})

test('responsive behavior changes at exactly 900px', () => {
  assert.equal(jobInboxLayout(899), 'mobile')
  assert.equal(jobInboxLayout(900), 'desktop')
  assert.equal(jobInboxLayout(1440), 'desktop')
})

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

test('API query is bounded, complete, batched, active-only and privacy-scoped', () => {
  const query = source('lib/job-inbox-queries.ts')
  assert.match(query, /JOB_INBOX_MAX_ROWS = 5000/)
  assert.match(query, /JOB_INBOX_MAX_ROWS \+ 1/)
  assert.match(query, /throw new JobInboxCapacityError/)
  assert.match(query, /\.eq\('is_active', true\)[\s\S]*\.in\('status', \[\.\.\.ACTIVE_JOB_STATUSES\]\)/)
  assert.match(query, /\.eq\('agent', 'rosie'\)[\s\S]*\.is\('closed_at', null\)[\s\S]*\.in\('thread_id', ids\)/)
  assert.doesNotMatch(query, /for \(const request of requests\)[\s\S]*await supabase/)
  const api = source('app/api/job-inbox/route.ts')
  assert.match(api, /JOB_INBOX_OVER_CAP/)
  assert.match(source('proxy.ts'), /pathname\.startsWith\('\/api'\)[\s\S]*status: 401/)
})

test('focused intake reuses one AgentChat/useChat/composer upload path and manual exit', () => {
  const shell = source('components/workspace/shell.tsx')
  const chat = source('components/workspace/chat.tsx')
  const kit = source('components/workspace/chat-kit.tsx')
  const jobs = source('app/jobs/page.tsx')
  assert.match(shell, /focusedIntake=\{focusedIntake\}/)
  assert.match(shell, /hideHeader=\{!!focusedIntake\}/)
  assert.doesNotMatch(jobs, /md:/)
  assert.doesNotMatch(chat.slice(chat.indexOf('if (focusedIntake)')), /md:/)
  assert.match(jobs, /min-\[900px\]:w-\[292px\]/)
  assert.match(chat, /min-\[900px\]:flex-row/)
  assert.match(shell, /focusedIntake \? 'flex-1 min-\[900px\]:w-0 min-\[900px\]:flex-none'/)
  assert.equal((shell.match(/fetch\('\/api\/requests\/reserve'/g) ?? []).length, 1)
  assert.match(shell, /savedId[\s\S]*router\.push\(`\/jobs\?jr=\$\{savedId\}&intake=1`/)
  assert.equal((chat.match(/const chat = useChat\(/g) ?? []).length, 1)
  assert.equal((chat.match(/const composer = useComposer\(/g) ?? []).length, 1)
  assert.match(chat, /`\/api\/chat\/\$\{agent\.id\}\/upload`/)
  assert.match(kit, /onDrop=\{onDrop\}/)
  assert.match(kit, /getData\('text\/plain'\)/)
  assert.match(kit, /composer\.upload\(files\)/)
  assert.match(jobs, /sessionStorage\.removeItem\(INTAKE\)/)
  assert.doesNotMatch(jobs, /itemCount\s*>?=\s*1[\s\S]*router\.replace/)
})
