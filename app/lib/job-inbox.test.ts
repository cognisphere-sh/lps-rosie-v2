import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'

import { JobIdentityLink } from '../components/workspace/shell.tsx'
import {
  FOCUSED_JOBS_RAIL_STORE, focusedJobsRailOpen, hasFocusedIntakeEvidence,
  jobInboxEventAction, jobInboxLayout, jobInboxMembership,
  jobInboxNavigationAction, jobInboxNewNavigationAction,
  jobInboxRowAriaLabel, mergeJobInbox, orderJobInbox, parseJobSelection, patchJobInbox,
  shouldRestoreJobInbox, type JobInboxRow,
} from './job-inbox.ts'

const row = (id: number, overrides: Partial<JobInboxRow> = {}): JobInboxRow => ({
  id, name: null, status: 'quoted', customer: null,
  customerCompany: null, customerContact: null,
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

test('focused switching and intake preserve one All jobs history entry', () => {
  assert.equal(jobInboxNavigationAction('valid'), 'replace')
  assert.equal(jobInboxNavigationAction('invalid'), 'replace')
  assert.equal(jobInboxNewNavigationAction(true), 'replace')
  assert.equal(jobInboxNewNavigationAction(false), 'push')

  const selected = ['/requests', '/jobs?jr=1']
  if (jobInboxNavigationAction('valid') === 'replace') selected[1] = '/jobs?jr=2'
  if (jobInboxNewNavigationAction(true) === 'replace') selected[1] = '/jobs?jr=3'
  selected.pop() // browser/device Back from focused mobile detail
  assert.deepEqual(selected, ['/requests'])

  const fromAllJobs = ['/requests']
  if (jobInboxNewNavigationAction(false) === 'push') fromAllJobs.push('/jobs?jr=22')
  fromAllJobs.pop()
  assert.deepEqual(fromAllJobs, ['/requests'])
})

test('All jobs identity navigation and browser Back return to the real list URL', async () => {
  const markup = renderToStaticMarkup(
    React.createElement(JobIdentityLink, { request: { id: 27, name: 'Courtyard' } }),
  )
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`, {
    url: 'http://localhost/requests',
  })
  try {
    const link = dom.window.document.querySelector('a')
    assert.ok(link)
    assert.equal(link.getAttribute('aria-label'), 'Open JR-27 — Courtyard')
    assert.equal(link.getAttribute('href'), '/jobs?jr=27')

    dom.window.history.pushState(null, '', link.href)
    assert.equal(dom.window.location.pathname + dom.window.location.search, '/jobs?jr=27')

    const back = new Promise<void>((resolve) => dom.window.addEventListener('popstate', () => resolve(), { once: true }))
    dom.window.history.back()
    await back
    assert.equal(dom.window.location.pathname + dom.window.location.search, '/requests')
  } finally {
    dom.window.close()
  }
})

test('list restoration is edge-triggered, not caused by polling or breakpoint changes', () => {
  assert.equal(shouldRestoreJobInbox('valid', 'bare', true, false), true)
  assert.equal(shouldRestoreJobInbox('valid', 'bare', false, true), true)
  assert.equal(shouldRestoreJobInbox('bare', 'bare', true, true), false) // row-count poll/SSE
  assert.equal(shouldRestoreJobInbox('valid', 'valid', true, true), false) // 899 ↔ 900 resize
  assert.equal(shouldRestoreJobInbox('bare', 'valid', true, true), false)
})

test('membership needs a successful list response before unavailable', () => {
  assert.equal(jobInboxMembership('valid', false, false, false, false), 'loading')
  assert.equal(jobInboxMembership('valid', false, true, false, false), 'error')
  assert.equal(jobInboxMembership('invalid', false, true, false, false), 'error')
  assert.equal(jobInboxMembership('valid', true, false, true, false), 'listed')
  assert.equal(jobInboxMembership('valid', true, false, false, true), 'pending')
  assert.equal(jobInboxMembership('valid', true, false, false, false), 'unavailable')
  assert.equal(jobInboxMembership('invalid', true, false, false, false), 'unavailable')
})

test('row accessible name states identity, compact Created/EDD dates and read state without chat prose', () => {
  const view = orderJobInbox([row(9, {
    name: 'Courtyard', status: 'quoted',
    createdAt: '2026-09-15T01:00:00Z', expectedInstallDate: '2026-10-03',
    thread: { lastId: 3, lastAt: '2026-08-29T13:00:00Z', lastText: 'Need more yaupon', webReadId: 2 },
  })])[0]
  assert.equal(
    jobInboxRowAriaLabel(view, 'Quote'),
    'JR-9 · Courtyard, Quote, Created Mon, 09/14, EDD Sat, 10/03, Unread web chat',
  )
  assert.equal(
    jobInboxRowAriaLabel({ ...view, createdAt: null, expectedInstallDate: undefined, unread: false }, 'Quote'),
    'JR-9 · Courtyard, Quote, Created —, EDD —, No unread web chat',
  )
  assert.doesNotMatch(jobInboxRowAriaLabel(view, 'Quote'), /Need more yaupon|Job record updated/)
})

test('responsive behavior changes at exactly 900px', () => {
  assert.equal(jobInboxLayout(899), 'mobile')
  assert.equal(jobInboxLayout(900), 'desktop')
  assert.equal(jobInboxLayout(1440), 'desktop')
})

test('focused Jobs rail preference is separate and defaults expanded', () => {
  assert.equal(FOCUSED_JOBS_RAIL_STORE, 'lps.jobs.rail.open.v1')
  assert.notEqual(FOCUSED_JOBS_RAIL_STORE, 'lps.nav.open')
  assert.equal(focusedJobsRailOpen(null), true)
  assert.equal(focusedJobsRailOpen('1'), true)
  assert.equal(focusedJobsRailOpen('bad'), true)
  assert.equal(focusedJobsRailOpen('0'), false)
})

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

test('API query is bounded, complete, batched, active-only and privacy-scoped', () => {
  const query = source('lib/job-inbox-queries.ts')
  assert.match(query, /JOB_INBOX_MAX_ROWS = 5000/)
  assert.match(query, /JOB_INBOX_MAX_ROWS \+ 1/)
  assert.match(query, /throw new JobInboxCapacityError/)
  assert.doesNotMatch(query, /shipping_(?:address|city|state|zip)/)
  assert.match(query, /\.select\('id, customer_id, name, status, expected_install_date, note_internal, note_for_customer, created_at, updated_at'\)/)
  assert.match(query, /customerCompany: customer\?\.company \?\? null/)
  assert.match(query, /customerContact: customer\?\.name \?\? null/)
  assert.doesNotMatch(query, /shipping:\s*\{/)
  assert.doesNotMatch(source('lib/job-inbox.ts'), /jobInboxIdentityLine[\s\S]{0,700}row\.customer(?:\W|$)/)
  assert.match(query, /\.eq\('is_active', true\)[\s\S]*\.in\('status', \[\.\.\.ACTIVE_JOB_STATUSES\]\)/)
  assert.match(query, /\.eq\('agent', 'rosie'\)[\s\S]*\.is\('closed_at', null\)[\s\S]*\.in\('thread_id', ids\)/)
  assert.doesNotMatch(query, /for \(const request of requests\)[\s\S]*await supabase/)
  const api = source('app/api/job-inbox/route.ts')
  assert.match(api, /JOB_INBOX_OVER_CAP/)
  assert.match(source('proxy.ts'), /pathname\.startsWith\('\/api'\)[\s\S]*status: 401/)
})

test('Jobs navigation has one All jobs list and independent job/open disclosure targets', () => {
  const shell = source('components/workspace/shell.tsx')
  const requests = source('app/requests/page.tsx')
  const requestCard = source('components/workspace/request-list-card.tsx')
  const jobs = source('app/jobs/page.tsx')

  assert.match(shell, /label: 'Jobs', href: '\/requests'/)
  assert.doesNotMatch(shell, /JobsViewSwitch|>Inbox<|aria-label="Jobs views"/)
  assert.doesNotMatch(requests, /JobsViewSwitch/)
  assert.match(requests, /<RequestCard/)
  assert.match(requestCard, /aria-expanded=\{expanded\}[\s\S]{0,120}aria-controls=\{`request-body-\$\{request\.id\}`\}/)
  assert.match(requestCard, /className="flex size-11[^"]*"[\s\S]{0,120}<Chevron/)
  assert.match(requestCard, /<JobIdentityLink request=\{request\} \/>/)
  assert.match(shell, /href=\{`\/jobs\?jr=\$\{request\.id\}`\}[\s\S]{0,180}aria-label=\{`Open/)
  assert.match(shell, /className="flex min-h-11[^"]*"/)
  assert.doesNotMatch(requestCard, /<div onClick=\{onToggle\}/)
  assert.match(jobs, /selection\.kind === 'bare'[\s\S]{0,80}router\.replace\('\/requests'\)/)
  assert.doesNotMatch(jobs, /ACTIVE_JOB_STATUSES/)
  assert.match(jobs, /if \(!response\.ok \|\| !body\.request\)[\s\S]*setDetail\(body\.request\)/)
})

test('focused desktop shell replaces only the nav rail and keeps global AgentChat', () => {
  const shell = source('components/workspace/shell.tsx')
  const frame = source('components/workspace/frame.tsx')
  const jobs = source('app/jobs/page.tsx')
  const rail = source('components/workspace/focused-jobs-rail.tsx')
  assert.doesNotMatch(jobs, /ordered\[0\][\s\S]{0,120}router\.replace/)
  assert.match(shell, /railHidden=\{desktopChatFull \|\| focusedJobsDesktop \|\| !!focusedIntake\}/)
  assert.match(shell, /rightColumn=\{\(\{ setNavOpen \}\) => \([\s\S]*<AgentChat/)
  assert.match(frame, /!isMobile && rightColumn\?\.\(state\)/)
  assert.match(jobs, /focusedJobsDesktop\n/)
  assert.match(jobs, /replaceNewJobEntry\n/)
  assert.match(jobs, /<FocusedJobsRailLayout[\s\S]*<main ref=\{workRef\}/)
  assert.match(rail, /<section[\s\S]*aria-label="Active job inbox"/)
  assert.match(jobs, /<JobsTopActions(?:\s|>)/)
  assert.match(rail, /<button type="button" aria-label="Back to All jobs"/)
  assert.doesNotMatch(rail, /title="Back to All jobs"/)
  assert.match(rail, /aria-label="Back to All jobs"[^>]*className="[^"]*size-11/)
  assert.match(rail, /<ArrowLeft size=\{18\}\/>/)
  assert.match(jobs, /tabIndex=\{-1\}/)
  assert.match(jobs, /ariaLabel=\{jobInboxRowAriaLabel/)
  assert.match(rail, /aria-current=\{selected \? 'page' : undefined\}/)
  assert.match(jobs, /response\.status === 404[\s\S]*setDetailError\(''\)[\s\S]*current\.filter\(\(row\) => row\.id !== id\)[\s\S]*refreshList\(\)[\s\S]*return/)
  assert.match(jobs, /membership === 'error'[\s\S]{0,300}loadDetail\(selection\.id\)/)
  assert.doesNotMatch(jobs, /<AgentChat|useChat\(/)
})

test('focused desktop rail has compact independent Back/collapse controls and mobile stays unchanged', () => {
  const jobs = source('app/jobs/page.tsx')
  const rail = source('components/workspace/focused-jobs-rail.tsx')
  assert.doesNotMatch(rail, />Back to All jobs</)
  const header = rail.slice(rail.indexOf('<div className="flex h-11'), rail.indexOf('{rail}'))
  assert.match(header, /aria-label="Back to All jobs"/)
  assert.match(header, /aria-label="Collapse active jobs"/)
  assert.equal(header.indexOf('Back to All jobs') < header.indexOf('Collapse active jobs'), true)
  assert.match(jobs, /mobile=\{breakpoint === true\}/)
  assert.match(rail, /\(mobile \|\| open !== true\) && 'hidden'/)
  assert.match(rail, /className="flex size-11[^\"]*focus-visible:ring-2/)
})

test('focused desktop rail collapse preserves mounted state, persistence and logical toggle focus', () => {
  const rail = source('components/workspace/focused-jobs-rail.tsx')
  assert.match(rail, /localStorage\.getItem\(FOCUSED_JOBS_RAIL_STORE\)/)
  assert.match(rail, /localStorage\.setItem\(FOCUSED_JOBS_RAIL_STORE, next \? '1' : '0'\)/)
  assert.match(rail, /focusedInRail = railRef\.current\?\.contains\(document\.activeElement\)/)
  assert.match(rail, /requestAnimationFrame\(\(\) => \(next \? collapseRef : expandRef\)\.current\?\.focus\(\{ preventScroll: true \}\)\)/)
  assert.match(rail, /desktop && open === false && \([\s\S]{0,700}aria-expanded=\{false\}/)
  assert.match(rail, /id=\{FOCUSED_JOBS_RAIL_ID\}[\s\S]{0,500}inert=\{mobile \|\| open !== true \? true : undefined\}/)
  assert.match(rail, /aria-label="Collapse active jobs"[\s\S]{0,120}aria-expanded=\{true\}/)
  assert.match(rail, /<aside className="w-11 flex-none border-r/)
  assert.doesNotMatch(rail, /router\.|setJobs\(|setDetail\(|refreshList|sessionStorage/)
})

test('focused route restores scroll/focus and uses push entry then replace switching', () => {
  const jobs = source('app/jobs/page.tsx')
  assert.match(jobs, /onScroll=\{saveListPosition\}/)
  assert.match(jobs, /target\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(jobs, /target\?\.scrollIntoView\(\{ block: 'nearest' \}\)/)
  assert.match(jobs, /shouldRestoreJobInbox\([\s\S]*pendingListRestore\.current[\s\S]*enteredFromLanding\.current/)
  assert.doesNotMatch(jobs, /\[breakpoint, ordered\.length, selection\.kind\]/)
  assert.match(jobs, /pendingWorkFocus\.current = id/)
  assert.match(jobs, /workRef\.current\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(jobs, /if \(action === 'push'\)[\s\S]*router\.push[\s\S]*history\.replaceState\(null, '', `\/jobs\?jr=\$\{id\}`\)/)
  assert.match(jobs, /newOrigin[\s\S]*LIST_ORIGIN_ID[\s\S]*selection\.id[\s\S]*sessionStorage\.setItem\(LIST_ORIGIN, String\(selection\.id\)\)/)
  assert.match(jobs, /backToList[\s\S]*router\.replace\('\/requests'/)
})

test('new jobs use the standard route and legacy focused intake reuses the same chat transport', () => {
  const shell = source('components/workspace/shell.tsx')
  const chat = source('components/workspace/chat.tsx')
  const kit = source('components/workspace/chat-kit.tsx')
  const jobs = source('app/jobs/page.tsx')
  assert.match(shell, /focusedIntake=\{focusedIntake\}/)
  assert.match(shell, /hideHeader=\{!!focusedIntake\}/)
  assert.match(jobs, /hideHeaderOnDesktop/)
  assert.doesNotMatch(jobs, /JobsViewSwitch|rightActions=\{rightActions\}/)
  assert.doesNotMatch(jobs, /md:/)
  assert.doesNotMatch(chat.slice(chat.indexOf('if (focusedIntake)')), /md:/)
  assert.match(source('components/workspace/focused-jobs-rail.tsx'), /min-\[900px\]:w-\[292px\]/)
  assert.match(chat, /min-\[900px\]:flex-row/)
  assert.match(shell, /focusedIntake \? 'flex-1 min-\[900px\]:w-0 min-\[900px\]:flex-none'/)
  assert.equal((shell.match(/fetch\('\/api\/requests\/reserve'/g) ?? []).length, 1)
  assert.match(shell, /savedId[\s\S]*navigate\(`\/jobs\?jr=\$\{savedId\}`\)/)
  assert.match(shell, /jobInboxNewNavigationAction\(fromSelectedEntry\)[\s\S]*router\.replace[\s\S]*router\.push/)
  assert.match(shell, /if \(!res\.ok \|\| !body\.id\) throw[\s\S]*setItem\('lps\.jobs\.origin\.v1', 'new'\)[\s\S]*setItem\('lps\.jobs\.origin-id\.v1', String\(body\.id\)\)[\s\S]*setItem\('lps\.jobs\.intake\.v1'/)
  assert.equal((chat.match(/const chat = useChat\(/g) ?? []).length, 1)
  assert.equal((chat.match(/const composer = useComposer\(/g) ?? []).length, 1)
  assert.match(chat, /`\/api\/chat\/\$\{agent\.id\}\/upload`/)
  assert.match(kit, /onDrop=\{onDrop\}/)
  assert.match(kit, /getData\('text\/plain'\)/)
  assert.match(kit, /composer\.upload\(files\)/)
  assert.match(jobs, /sessionStorage\.removeItem\(INTAKE\)/)
  assert.doesNotMatch(jobs, /itemCount\s*>?=\s*1[\s\S]*router\.replace/)
})
