import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { afterEach, beforeEach } from 'node:test'
import React, { useEffect, useRef, useState } from 'react'
import { renderToString } from 'react-dom/server'
import { NextRequest } from 'next/server'
import { JSDOM } from 'jsdom'
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import proxy from '../proxy.ts'
import { DeleteRequestDialog, deleteRequestFromApi } from '../components/workspace/request-delete.tsx'
import { RequestCard } from '../components/workspace/request-list-card.tsx'
import {
  RequestFilters,
  RequestsToolbar,
  requestFilterActiveCount,
  useResolvedRequestsMobile,
} from '../components/workspace/requests-toolbar.tsx'
import type { Chip } from '../components/workspace/toolbar.tsx'
import { REQUEST_STATUS_OPTIONS, ITEM_STATUS_OPTIONS } from './job-requests.ts'
import {
  buildRequestFilterQuery,
  buildRequestListUrl,
  normalizeStoredRequestStatusLabels,
} from './request-list-state.ts'
import type { JobRequestRow } from './rows.ts'
import { createSession, SESSION_COOKIE } from './session.ts'

let dom: JSDOM
let viewportWidth = 390
const mediaQueries = new Set<MockMediaQueryList>()

class MockMediaQueryList {
  readonly media: string
  matches: boolean
  private listeners = new Set<(event: MediaQueryListEvent) => void>()

  constructor(media: string) {
    this.media = media
    this.matches = this.compute()
    mediaQueries.add(this)
  }

  private compute() {
    if (this.media.includes('max-width: 899px')) return viewportWidth <= 899
    if (this.media.includes('min-width: 900px')) return viewportWidth >= 900
    return false
  }

  addEventListener(_type: string, listener: (event: MediaQueryListEvent) => void) {
    this.listeners.add(listener)
  }

  removeEventListener(_type: string, listener: (event: MediaQueryListEvent) => void) {
    this.listeners.delete(listener)
  }

  sync() {
    const next = this.compute()
    if (next === this.matches) return
    this.matches = next
    const event = { matches: next, media: this.media } as MediaQueryListEvent
    for (const listener of this.listeners) listener(event)
  }
}

const setViewport = async (width: number) => {
  viewportWidth = width
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  await act(async () => {
    for (const query of mediaQueries) query.sync()
  })
}

const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

beforeEach(() => {
  viewportWidth = 390
  mediaQueries.clear()
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/requests' })
  const win = dom.window
  for (const [key, value] of Object.entries({
    window: win,
    self: win,
    document: win.document,
    navigator: win.navigator,
    HTMLElement: win.HTMLElement,
    Node: win.Node,
    MouseEvent: win.MouseEvent,
    PointerEvent: win.PointerEvent ?? win.MouseEvent,
    KeyboardEvent: win.KeyboardEvent,
    CustomEvent: win.CustomEvent,
    getComputedStyle: win.getComputedStyle,
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    matchMedia: (query: string) => new MockMediaQueryList(query),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  Object.defineProperty(win, 'matchMedia', {
    configurable: true,
    value: (query: string) => new MockMediaQueryList(query),
  })
  Object.defineProperty(win.HTMLElement.prototype, 'attachEvent', { configurable: true, value() {} })
  Object.defineProperty(win.HTMLElement.prototype, 'detachEvent', { configurable: true, value() {} })
})

afterEach(() => {
  cleanup()
  dom.window.close()
})

const BASELINE = ['Sourcing', 'Quote Delivered', 'Closed won', 'Closed lost']

function useRequestChips() {
  const [status, setStatus] = useState(BASELINE)
  const [itemStatus, setItemStatus] = useState<string[]>([])
  const [customer, setCustomer] = useState<string[]>([])
  const [created, setCreated] = useState<string[]>([])
  const [updated, setUpdated] = useState<string[]>([])
  return [
    { label: 'Status', values: status, options: [...BASELINE, 'Archived'], onChange: setStatus, allLabel: 'All statuses' },
    { label: 'Item status', values: itemStatus, options: ['Pending', 'Available'], onChange: setItemStatus, allLabel: 'All item statuses' },
    { label: 'Customer', values: customer, options: ['Oak Hill'], onChange: setCustomer, allLabel: 'All customers' },
    { label: 'Created', values: created, options: ['Today', 'Last 7 days'], onChange: setCreated, allLabel: 'All time', single: true },
    { label: 'Updated', values: updated, options: ['Today', 'Last 7 days'], onChange: setUpdated, allLabel: 'All time', single: true },
  ] satisfies Chip[]
}

function FiltersHarness({ onClear = () => {} }: { onClear?: () => void }) {
  return <RequestFilters chips={useRequestChips()} statusBaseline={BASELINE} onClear={onClear} />
}

test('mobile Filters portals one real modal, isolates/restores exact background state and supports all dismissal/focus paths', async () => {
  const user = userEvent.setup({ document })
  const prior = document.createElement('aside')
  prior.inert = true
  prior.setAttribute('inert', '')
  prior.setAttribute('aria-hidden', 'false')
  document.body.appendChild(prior)
  const view = render(<FiltersHarness />)
  const root = view.container
  const trigger = view.getByRole('button', { name: 'Filters' })
  assert.match(trigger.className, /size-11/)

  await user.click(trigger)
  await waitFor(() => assert.ok(document.body.querySelector('[data-request-filter-portal]')))
  const portal = document.body.querySelector('[data-request-filter-portal]') as HTMLElement
  const dialog = within(portal).getByRole('dialog', { name: 'Filters' })
  assert.equal(document.querySelectorAll('#request-filter-surface').length, 1)
  assert.equal(root.inert, true)
  assert.equal(root.getAttribute('aria-hidden'), 'true')
  assert.equal(prior.inert, true)
  assert.equal(prior.getAttribute('aria-hidden'), 'true')
  assert.equal(document.body.style.overflow, 'hidden')
  for (const group of ['Status', 'Item status', 'Customer', 'Created', 'Updated']) {
    assert.ok(within(dialog).getByText(group, { selector: 'legend' }))
  }
  for (const status of BASELINE) {
    assert.equal((within(dialog).getByRole('checkbox', { name: status }) as HTMLInputElement).checked, true)
  }
  assert.equal((within(dialog).getByRole('checkbox', { name: 'Archived' }) as HTMLInputElement).checked, false)
  const close = within(dialog).getByRole('button', { name: 'Close filters' })
  const clear = within(dialog).getByRole('button', { name: 'Clear all filters' })
  assert.equal(document.activeElement, close)
  close.focus()
  await user.tab({ shift: true })
  assert.equal(document.activeElement, clear)

  let escapedOutside = 0
  document.body.addEventListener('keydown', () => { escapedOutside += 1 }, { once: true })
  await user.keyboard('{Escape}')
  await settle()
  assert.equal(escapedOutside, 0)
  assert.equal(document.body.querySelector('[data-request-filter-portal]'), null)
  assert.equal(root.hasAttribute('inert'), false)
  assert.equal(root.getAttribute('aria-hidden'), null)
  assert.equal(prior.inert, true)
  assert.equal(prior.hasAttribute('inert'), true)
  assert.equal(prior.getAttribute('aria-hidden'), 'false')
  assert.equal(document.body.style.overflow, '')
  assert.equal(document.activeElement, trigger)

  await user.click(trigger)
  await waitFor(() => assert.ok(document.body.querySelector('[data-request-filter-backdrop]')))
  fireEvent.pointerDown(document.body.querySelector('[data-request-filter-backdrop]')!)
  await settle()
  assert.equal(document.body.querySelector('[data-request-filter-portal]'), null)
  assert.equal(document.activeElement, trigger)

  await user.click(trigger)
  await waitFor(() => assert.ok(document.body.querySelector('[data-request-filter-portal]')))
  view.unmount()
  assert.equal(document.body.querySelector('[data-request-filter-portal]'), null)
  assert.equal(prior.inert, true)
  assert.equal(prior.getAttribute('aria-hidden'), 'false')
})

test('baseline status is zero active groups while real deviations and other groups count once each', async () => {
  const user = userEvent.setup({ document })
  const view = render(<FiltersHarness />)
  const trigger = view.getByRole('button', { name: 'Filters' })
  assert.equal(view.queryByRole('button', { name: /4 active/ }), null)
  await user.click(trigger)
  await waitFor(() => assert.ok(document.body.querySelector('[data-request-filter-portal]')))
  const portal = document.body.querySelector('[data-request-filter-portal]') as HTMLElement
  await user.click(within(portal).getByRole('checkbox', { name: 'Archived' }))
  assert.equal(trigger.getAttribute('aria-label'), 'Filters, 1 active')
  await user.click(within(portal).getByRole('checkbox', { name: 'Pending' }))
  assert.equal(trigger.getAttribute('aria-label'), 'Filters, 2 active')
  assert.equal(requestFilterActiveCount([
    { label: 'Status', values: [...BASELINE].reverse(), options: [], onChange: () => {}, allLabel: '' },
  ], BASELINE), 0)
})

let actionMounts = 0
let actionUnmounts = 0
function DesktopAction() {
  useEffect(() => {
    actionMounts += 1
    return () => { actionUnmounts += 1 }
  }, [])
  return <button id="jobs-new-trigger" type="button">New job</button>
}

function ToolbarHarness({ resolved }: { resolved: boolean | null }) {
  const chips = useRequestChips()
  return (
    <RequestsToolbar
      resolvedMobile={resolved}
      placeholder="Search plants, customers, JR-…"
      query="oak"
      onQuery={() => {}}
      chips={chips}
      statusBaseline={BASELINE}
      controls={<button type="button">Expand all</button>}
      rightActions={<DesktopAction />}
      hasFilters={false}
      onClear={() => {}}
      summary="12 requests"
    />
  )
}

test('legacy persisted Quoted filter restores and saves canonically without losing quoted jobs or creating a false deviation', () => {
  const storageKey = 'lps.requests.visit.v1'
  window.sessionStorage.setItem(storageKey, JSON.stringify({
    status: ['Sourcing', 'Quoted', 'Closed won', 'Closed lost'],
  }))
  const stored = JSON.parse(window.sessionStorage.getItem(storageKey) ?? 'null') as { status: unknown }
  const legacy = normalizeStoredRequestStatusLabels(
    stored.status,
    REQUEST_STATUS_OPTIONS,
    BASELINE,
  )
  assert.deepEqual(legacy, BASELINE)
  assert.equal(legacy.includes('Quoted'), false)
  assert.equal(legacy.includes('Quote Delivered'), true)
  assert.equal(requestFilterActiveCount([
    { label: 'Status', values: legacy, options: REQUEST_STATUS_OPTIONS.map((option) => option.label), onChange: () => {}, allLabel: '' },
  ], BASELINE), 0)
  const query = buildRequestFilterQuery({
    status: legacy,
    itemStatus: [],
    customer: [],
    created: [],
    updated: [],
    customerIds: new Map(),
    requestStatusOptions: REQUEST_STATUS_OPTIONS,
    itemStatusOptions: ITEM_STATUS_OPTIONS,
  })
  assert.equal(new URLSearchParams(query).get('status'), 'sourcing,quoted,closed_won,closed_lost')
  window.sessionStorage.setItem(storageKey, JSON.stringify({ ...stored, status: legacy }))
  assert.deepEqual(JSON.parse(window.sessionStorage.getItem(storageKey) ?? 'null').status, BASELINE)

  assert.deepEqual(
    normalizeStoredRequestStatusLabels(
      ['Quoted', 'Quote Delivered', 'Bogus', 7, null, 'Sourcing'],
      REQUEST_STATUS_OPTIONS,
      BASELINE,
    ),
    ['Quote Delivered', 'Sourcing'],
  )
  assert.deepEqual(
    normalizeStoredRequestStatusLabels({ status: ['Quoted'] }, REQUEST_STATUS_OPTIONS, BASELINE),
    BASELINE,
  )
  assert.deepEqual(
    normalizeStoredRequestStatusLabels([' quoted ', '', false], REQUEST_STATUS_OPTIONS, BASELINE),
    [],
  )
  window.sessionStorage.setItem(storageKey, '{malformed')
  assert.throws(() => JSON.parse(window.sessionStorage.getItem(storageKey) ?? 'null'))
  const page = source('app/requests/page.tsx')
  assert.match(page, /setStatus\(normalizeStoredRequestStatusLabels\(saved\.status, REQUEST_STATUS_OPTIONS, OPEN_STATUSES\)\)/)
  assert.match(page, /catch \{ \/\* malformed tab state falls back to defaults \*\//)
  assert.match(page, /sessionStorage\.setItem\(REQUESTS_VISIT_STORE, JSON\.stringify\(\{ query, status,/)
})

test('mobile filter state rerenders preserve the chosen keyboard control while each reopen initially focuses Close', async () => {
  const user = userEvent.setup({ document })
  const view = render(<ToolbarHarness resolved />)
  const trigger = view.getByRole('button', { name: 'Filters' })
  await user.click(trigger)
  await waitFor(() => assert.ok(document.body.querySelector('[data-request-filter-portal]')))
  let portal = document.body.querySelector('[data-request-filter-portal]') as HTMLElement
  let dialog = within(portal).getByRole('dialog', { name: 'Filters' })
  assert.equal(document.activeElement, within(dialog).getByRole('button', { name: 'Close filters' }))

  const archived = within(dialog).getByRole('checkbox', { name: 'Archived' }) as HTMLInputElement
  await user.click(archived)
  assert.equal(archived.checked, true)
  assert.equal(document.activeElement, archived)
  assert.ok(document.body.contains(dialog))

  const pending = within(dialog).getByRole('checkbox', { name: 'Pending' }) as HTMLInputElement
  await user.click(pending)
  assert.equal(pending.checked, true)
  assert.equal(document.activeElement, pending)
  assert.ok(document.body.contains(dialog))

  const createdGroup = within(dialog).getByText('Created', { selector: 'legend' }).closest('fieldset') as HTMLElement
  const createdToday = within(createdGroup).getByRole('radio', { name: 'Today' }) as HTMLInputElement
  await user.click(createdToday)
  assert.equal(createdToday.checked, true)
  assert.equal(document.activeElement, createdToday)
  assert.ok(document.body.contains(dialog))

  const updatedGroup = within(dialog).getByText('Updated', { selector: 'legend' }).closest('fieldset') as HTMLElement
  const updatedWeek = within(updatedGroup).getByRole('radio', { name: 'Last 7 days' }) as HTMLInputElement
  await user.click(updatedWeek)
  assert.equal(updatedWeek.checked, true)
  assert.equal(document.activeElement, updatedWeek)
  assert.ok(document.body.contains(dialog))

  await user.keyboard('{Escape}')
  await settle()
  assert.equal(document.body.querySelector('[data-request-filter-portal]'), null)
  assert.equal(document.activeElement, trigger)
  await user.click(trigger)
  await waitFor(() => assert.ok(document.body.querySelector('[data-request-filter-portal]')))
  portal = document.body.querySelector('[data-request-filter-portal]') as HTMLElement
  dialog = within(portal).getByRole('dialog', { name: 'Filters' })
  assert.equal(document.activeElement, within(dialog).getByRole('button', { name: 'Close filters' }))
  assert.equal((within(dialog).getByRole('checkbox', { name: 'Archived' }) as HTMLInputElement).checked, true)
  assert.equal((within(dialog).getByRole('checkbox', { name: 'Pending' }) as HTMLInputElement).checked, true)
  assert.equal((within(within(dialog).getByText('Created', { selector: 'legend' }).closest('fieldset') as HTMLElement)
    .getByRole('radio', { name: 'Today' }) as HTMLInputElement).checked, true)
  assert.equal((within(within(dialog).getByText('Updated', { selector: 'legend' }).closest('fieldset') as HTMLElement)
    .getByRole('radio', { name: 'Last 7 days' }) as HTMLInputElement).checked, true)
})

test('unresolved/mobile/desktop each own exactly one branch and crossings close open UIs without duplicate controls/listeners', async () => {
  actionMounts = 0
  actionUnmounts = 0
  const user = userEvent.setup({ document })
  const view = render(<ToolbarHarness resolved={null} />)
  assert.equal(view.container.querySelectorAll('[data-requests-toolbar-branch]').length, 1)
  assert.ok(view.container.querySelector('[data-requests-toolbar-branch="neutral"]'))
  assert.equal(view.queryByRole('textbox'), null)
  assert.equal(document.querySelectorAll('#jobs-new-trigger').length, 0)

  view.rerender(<ToolbarHarness resolved={false} />)
  assert.ok(view.container.querySelector('[data-requests-toolbar-branch="desktop"]'))
  assert.equal(view.getAllByRole('textbox', { name: 'Search plants, customers, JR-…' }).length, 1)
  assert.equal(document.querySelectorAll('#jobs-new-trigger').length, 1)
  assert.equal(actionMounts, 1)
  await user.click(view.getByRole('button', { name: 'Status · 4' }))
  assert.ok(view.getByRole('button', { name: 'Archived' }))

  view.rerender(<ToolbarHarness resolved />)
  await settle()
  assert.ok(view.container.querySelector('[data-requests-toolbar-branch="mobile"]'))
  assert.equal(view.getAllByRole('textbox', { name: 'Search plants, customers, JR-…' }).length, 1)
  assert.equal(view.queryByRole('button', { name: 'Status · 4' }), null)
  assert.equal(document.querySelectorAll('#jobs-new-trigger').length, 0)
  assert.equal(actionUnmounts, 1)
  assert.equal(document.activeElement, view.getByRole('textbox', { name: 'Search plants, customers, JR-…' }))

  await user.click(view.getByRole('button', { name: 'Filters' }))
  await waitFor(() => assert.ok(document.body.querySelector('[data-request-filter-portal]')))
  view.rerender(<ToolbarHarness resolved={false} />)
  await settle()
  assert.equal(document.body.querySelector('[data-request-filter-portal]'), null)
  assert.equal(document.body.style.overflow, '')
  assert.equal(document.querySelectorAll('#request-filter-surface').length, 0)
  assert.equal(document.querySelectorAll('#jobs-new-trigger').length, 1)
  assert.equal(document.activeElement, view.getByRole('textbox', { name: 'Search plants, customers, JR-…' }))

  await user.click(view.getByRole('button', { name: 'Status · 4' }))
  view.rerender(<ToolbarHarness resolved />)
  await settle()
  assert.equal(view.queryByRole('button', { name: 'Archived' }), null)
  await user.click(view.getByRole('button', { name: 'Filters' }))
  await waitFor(() => assert.equal(document.querySelectorAll('#request-filter-surface').length, 1))
  await user.keyboard('{Escape}')
  await settle()
  assert.equal(document.querySelectorAll('#request-filter-surface').length, 0)
})

function ToolbarCrossingWithDelete({
  resolved,
  onCancel,
}: {
  resolved: boolean
  onCancel: () => void
}) {
  const returnFocus = useRef<HTMLElement | null>(null)
  return (
    <>
      <ToolbarHarness resolved={resolved} />
      <DeleteRequestDialog
        request={REQUEST}
        busy={false}
        error=""
        returnFocus={returnFocus}
        onCancel={onCancel}
        onConfirm={() => {}}
      />
    </>
  )
}

test('899/900 crossing never steals focus from a connected whole-request Delete modal', async () => {
  const user = userEvent.setup({ document })
  let cancels = 0
  const view = render(
    <ToolbarCrossingWithDelete resolved={false} onCancel={() => { cancels += 1 }} />,
  )
  const cancel = view.getByRole('button', { name: 'Cancel' })
  const confirm = view.getByRole('button', { name: 'Delete permanently' })
  assert.equal(document.activeElement, cancel)

  view.rerender(
    <ToolbarCrossingWithDelete resolved onCancel={() => { cancels += 1 }} />,
  )
  await settle()
  assert.equal(document.activeElement, cancel)
  assert.notEqual(document.activeElement, view.getByRole('textbox', { name: 'Search plants, customers, JR-…' }))
  await user.tab({ shift: true })
  assert.equal(document.activeElement, confirm)
  await user.tab()
  assert.equal(document.activeElement, cancel)

  view.rerender(
    <ToolbarCrossingWithDelete resolved={false} onCancel={() => { cancels += 1 }} />,
  )
  await settle()
  assert.equal(document.activeElement, cancel)
  await user.keyboard('{Escape}')
  assert.equal(cancels, 1)
  assert.equal(document.activeElement, cancel)
})

function ResolvedToolbarHarness() {
  const mobile = useResolvedRequestsMobile()
  return <ToolbarHarness resolved={mobile} />
}

test('real media-query resolution is neutral in SSR and structural budgets bound 320/390/514/899 mobile rows before desktop at 900', async () => {
  const server = renderToString(<ResolvedToolbarHarness />)
  assert.match(server, /data-requests-toolbar-branch="neutral"/)
  assert.doesNotMatch(server, /jobs-new-trigger|request-filter-surface|<input/)
  const view = render(<ResolvedToolbarHarness />)
  await settle()
  for (const width of [320, 390, 514, 899]) {
    await setViewport(width)
    const mobile = view.container.querySelector('[data-requests-toolbar-branch="mobile"]') as HTMLElement
    assert.ok(mobile, `${width}px owns mobile branch`)
    const row = mobile.querySelector('[data-request-mobile-search-row]') as HTMLElement
    const input = within(row).getByRole('textbox')
    const searchOwner = input.parentElement as HTMLElement
    const filter = within(row).getByRole('button', { name: 'Filters' })
    // Literal Tailwind contracts: px-3 = 12px/side, gap-2 = 8px,
    // size-11 = 44px. The only remaining track is flex-1/min-w-0 Search.
    const horizontalPadding = 24
    const gap = 8
    const icon = 44
    const searchWidth = width - horizontalPadding - gap - icon
    assert.ok(searchWidth >= 96, `${width}px leaves ${searchWidth}px for Search`)
    assert.match(mobile.className, /\bw-full\b/)
    assert.match(mobile.className, /\bmax-w-full\b/)
    assert.match(mobile.className, /\bmin-w-0\b/)
    assert.match(mobile.className, /\bpx-3\b/)
    assert.doesNotMatch(mobile.className, /overflow-x-auto|overflow-x-scroll/)
    assert.match(row.className, /\bflex-nowrap\b/)
    assert.match(row.className, /\bmin-w-0\b/)
    assert.match(row.className, /\bgap-2\b/)
    assert.match(searchOwner.className, /\bflex-1\b/)
    assert.match(searchOwner.className, /\bmin-w-0\b/)
    assert.doesNotMatch(searchOwner.className, /(?:^|\s)(?:w|min-w|max-w)-\[/)
    assert.match(input.className, /\bw-full\b/)
    assert.match(input.className, /\bmin-w-0\b/)
    assert.match(filter.className, /\bsize-11\b/)
    assert.match(filter.className, /\bflex-none\b/)
    assert.equal(within(row).queryByRole('button', { name: 'Expand all' }), null)
  }
  await setViewport(900)
  assert.ok(view.container.querySelector('[data-requests-toolbar-branch="desktop"]'))
  assert.equal(view.container.querySelector('[data-request-mobile-search-row]'), null)
  assert.equal(document.querySelectorAll('#jobs-new-trigger').length, 1)
  const frame = source('components/workspace/frame.tsx')
  const page = source('app/requests/page.tsx')
  assert.match(frame, /flex min-h-0 min-w-0 flex-col overflow-hidden/)
  assert.match(page, /className="flex min-h-0 flex-1 flex-col gap-2\.5 overflow-auto/)
})

const REQUEST: JobRequestRow = {
  id: 27,
  name: 'Courtyard',
  status: 'sourcing',
  customer: null,
  billing: { address: null, city: null, state: null, zip: null },
  shipping: { address: null, city: null, state: null, zip: null },
  customerNotes: null,
  notes: [],
  externalNotes: null,
  sourcingNotes: null,
  itemCount: 0,
  statusCounts: { pending: 0, available: 0, alternative_proposed: 0, unavailable: 0 },
  lineTotal: 0,
  supplierLinks: [],
  items: [],
  createdAt: '2026-08-01T12:00:00Z',
  updatedAt: '2026-08-02T12:00:00Z',
}

function StaticCard({
  request,
  mobile,
  expanded = false,
  onToggle = () => {},
}: {
  request: JobRequestRow
  mobile: boolean
  expanded?: boolean
  onToggle?: () => void
}) {
  return (
    <RequestCard
      request={request}
      expanded={expanded}
      mobile={mobile}
      selected={new Set()}
      version={0}
      onToggle={onToggle}
      onSelect={() => {}}
      onDelete={() => {}}
      onDeleteItem={() => {}}
      onSaved={() => {}}
    />
  )
}

test('photo488 live shape is exactly two compact rows with chevron · JR · status · flexible identity, then Pending · Rosie', async () => {
  const user = userEvent.setup({ document })
  const longStatus = 'Awaiting extraordinarily detailed customer confirmation'
  const longRequest: JobRequestRow = {
    ...REQUEST,
    name: 'Courtyard 🌳 旗艦店 — Extremely long Unicode job name that must ellipsize',
    status: longStatus,
    customer: {
      id: 9,
      name: 'Renée 山田 Customer',
      company: 'Société 🌿 超長い会社名 with an exceptionally long company suffix',
      email: null,
      phone: null,
      rosieThreadId: null,
    },
  }
  let toggles = 0
  const view = render(<StaticCard request={longRequest} mobile onToggle={() => { toggles += 1 }} />)
  const rows = [...view.container.querySelectorAll<HTMLElement>('[data-mobile-request-row]')]
  assert.equal(rows.length, 2)
  const primary = rows[0]
  const secondary = rows[1]
  assert.equal(primary.dataset.mobileRequestRow, 'identity')
  assert.equal(secondary.dataset.mobileRequestRow, 'pending-chat')
  assert.deepEqual(
    [...primary.children].map((node) => {
      const data = (node as HTMLElement).dataset
      if (data.mobileRequestChevron !== undefined) return 'chevron'
      if (data.mobileRequestJr !== undefined) return 'jr'
      if (data.mobileRequestStatus !== undefined) return 'status'
      if (data.mobileRequestIdentity !== undefined) return 'identity'
      return 'unexpected'
    }),
    ['chevron', 'jr', 'status', 'identity'],
  )
  assert.deepEqual(
    [...secondary.children].map((node) => {
      const data = (node as HTMLElement).dataset
      if (data.mobilePendingSummary !== undefined) return 'pending'
      if (data.mobileRequestRosie !== undefined) return 'rosie'
      return 'unexpected'
    }),
    ['pending', 'rosie'],
  )
  for (const row of rows) {
    assert.match(row.className, /\bflex-nowrap\b/)
    assert.match(row.className, /\bw-full\b/)
    assert.match(row.className, /\bmax-w-full\b/)
    assert.match(row.className, /\bmin-w-0\b/)
    assert.doesNotMatch(row.className, /flex-wrap|overflow-x-auto|overflow-x-scroll/)
  }

  const chevron = primary.children[0] as HTMLButtonElement
  const jr = primary.children[1] as HTMLElement
  const statusOwner = primary.children[2] as HTMLElement
  const identity = primary.children[3] as HTMLAnchorElement
  const customer = identity.querySelector('[data-mobile-request-customer]') as HTMLElement
  const job = identity.querySelector('[data-mobile-request-job]') as HTMLElement
  assert.equal(primary.querySelectorAll('a').length, 1)
  assert.match(chevron.className, /\bsize-11\b/)
  assert.equal(chevron.getAttribute('aria-expanded'), 'false')
  assert.equal(jr.textContent, 'JR-27')
  assert.match(jr.className, /\bflex-none\b/)
  assert.match(jr.className, /\bwhitespace-nowrap\b/)
  assert.match(identity.className, /\bflex-1\b/)
  assert.match(identity.className, /\bmin-w-0\b/)
  assert.match(identity.className, /\boverflow-hidden\b/)
  assert.match(identity.className, /\btext-ellipsis\b/)
  assert.match(identity.className, /\bwhitespace-nowrap\b/)
  assert.doesNotMatch(identity.className, /(?:^|\s)(?:w|min-w|max-w)-\[/)
  assert.equal(identity.textContent, `${longRequest.customer?.company} · ${longRequest.name}`)
  assert.equal(identity.title, `${longRequest.customer?.company} · ${longRequest.name}`)
  assert.equal(identity.getAttribute('href'), '/jobs?jr=27')
  assert.equal(identity.getAttribute('aria-label'), `Open JR-27 — ${longRequest.name}`)
  assert.equal(customer.textContent, longRequest.customer?.company)
  assert.equal(job.textContent, longRequest.name)

  const status = within(statusOwner).getByRole('button', { name: longStatus })
  const statusToken = within(statusOwner).getByText('AED')
  assert.match(statusOwner.className, /\bsize-11\b/)
  assert.match(statusOwner.className, /\bflex-none\b/)
  assert.doesNotMatch(statusOwner.className, /overflow-hidden|truncate/)
  assert.match(status.className, /\bsize-11\b/)
  assert.match(status.className, /bg-transparent/)
  assert.doesNotMatch(statusToken.className, /overflow-hidden|truncate|text-clip/)

  const pending = secondary.children[0] as HTMLElement
  const rosie = secondary.children[1] as HTMLButtonElement
  assert.match(pending.textContent ?? '', /0\s*Pending/)
  assert.match(pending.className, /\binline-flex\b/)
  assert.doesNotMatch(pending.className, /\bw-full\b|\bmax-w-full\b|min-h-11/)
  assert.match(rosie.className, /\bsize-11\b/)
  assert.match(rosie.className, /\bflex-none\b/)
  assert.match(rosie.className, /\bml-auto\b/)
  assert.equal(view.getAllByRole('button', { name: 'Expand JR-27' }).length, 1)
  assert.equal(view.container.querySelector('[data-mobile-request-date]'), null)
  for (const absent of ['PO', 'Install Date', 'Pickup', 'Delivery', 'Created', 'Last updated']) {
    assert.equal(view.queryByText(absent), null)
  }

  identity.addEventListener('click', (event) => event.preventDefault(), { once: true })
  await user.click(identity)
  assert.equal(toggles, 0)
  await user.click(chevron)
  assert.equal(toggles, 1)

  // Structural budget only: viewport p-3, card border and head px-3.5 consume
  // 54px; row 1 then reserves 44px Chevron + a conservative 40px JR-27 +
  // 44px Status + three 4px gaps. Only the one min-w-0 identity track yields.
  for (const width of [320, 390, 480]) {
    await setViewport(width)
    const identityWidth = width - 24 - 2 - 28 - 44 - 40 - 44 - 12
    assert.ok(identityWidth >= 120, `${width}px leaves ${identityWidth}px for the one identity region`)
    assert.equal(view.container.querySelectorAll('[data-mobile-request-row]').length, 2)
  }

  let opened: unknown
  window.addEventListener('lps:open-chat', (event) => {
    opened = (event as CustomEvent).detail
  }, { once: true })
  await user.click(rosie)
  assert.deepEqual(opened, {
    agentId: 'rosie',
    threadId: 'jr-27',
    label: longRequest.name,
  })

  view.rerender(<StaticCard request={{
    ...longRequest,
    name: '   ',
    customer: { ...longRequest.customer!, company: '   ', name: '  Renée Customer  ' },
  }} mobile />)
  let normalizedIdentity = view.container.querySelector('[data-mobile-request-identity]') as HTMLAnchorElement
  let normalizedCustomer = view.container.querySelector('[data-mobile-request-customer]') as HTMLElement
  let normalizedJob = view.container.querySelector('[data-mobile-request-job]') as HTMLElement
  assert.equal(normalizedCustomer.textContent, 'Renée Customer')
  assert.equal(normalizedJob.textContent, 'JR-27')
  assert.equal(normalizedIdentity.textContent, 'Renée Customer · JR-27')
  assert.equal(normalizedIdentity.title, 'Renée Customer · JR-27')
  assert.equal(normalizedIdentity.getAttribute('aria-label'), 'Open JR-27')

  view.rerender(<StaticCard request={{
    ...longRequest,
    name: '',
    customer: { ...longRequest.customer!, company: '', name: '\t ' },
  }} mobile />)
  normalizedIdentity = view.container.querySelector('[data-mobile-request-identity]') as HTMLAnchorElement
  normalizedCustomer = view.container.querySelector('[data-mobile-request-customer]') as HTMLElement
  normalizedJob = view.container.querySelector('[data-mobile-request-job]') as HTMLElement
  assert.equal(normalizedCustomer.textContent, 'Unassigned customer')
  assert.equal(normalizedJob.textContent, 'JR-27')
  assert.equal(normalizedIdentity.textContent, 'Unassigned customer · JR-27')
  assert.equal(normalizedIdentity.getAttribute('aria-label'), 'Open JR-27')
})

test('mobile status uses readable deterministic tokens with exact full accessible canonical and unknown labels', () => {
  const canonical = [
    ['sourcing', 'Sourcing', 'Src'],
    ['quoted', 'Quote Delivered', 'QD'],
    ['closed_won', 'Closed won', 'Won'],
    ['closed_lost', 'Closed lost', 'Lost'],
    ['archived', 'Archived', 'Arc'],
  ] as const
  const view = render(<StaticCard request={{ ...REQUEST, status: canonical[0][0] }} mobile />)
  for (const [value, label, token] of canonical) {
    view.rerender(<StaticCard request={{ ...REQUEST, status: value }} mobile />)
    const owner = view.container.querySelector('[data-mobile-request-status]') as HTMLElement
    const button = within(owner).getByRole('button', { name: label })
    const visible = owner.querySelector('[data-compact-status-token]') as HTMLElement
    assert.equal(visible.textContent, token)
    assert.equal(button.getAttribute('aria-label'), label)
    assert.match(button.className, /\bsize-11\b/)
    assert.equal(owner.querySelector('svg'), null)
    assert.doesNotMatch(owner.className, /overflow-hidden|truncate/)
    assert.doesNotMatch(visible.className, /overflow-hidden|truncate|text-clip/)
  }

  for (const [value, label, token] of [
    ['Awaiting extraordinarily detailed customer confirmation', 'Awaiting extraordinarily detailed customer confirmation', 'AED'],
    ['状态等待', '状态等待', '状态等'],
    ['   ', 'Unknown status', '?'],
    ['', 'Unknown status', '?'],
  ]) {
    view.rerender(<StaticCard request={{ ...REQUEST, status: value }} mobile />)
    const owner = view.container.querySelector('[data-mobile-request-status]') as HTMLElement
    const visible = owner.querySelector('[data-compact-status-token]') as HTMLElement
    assert.equal(visible.textContent, token)
    assert.doesNotMatch(visible.className, /overflow-hidden|truncate|text-clip/)
    assert.ok(within(owner).getByRole('button', { name: label }))
  }
})

test('actual compact status picker opens by pointer and keyboard, keeps full state labels and closes accessibly inside phone bounds', async () => {
  const user = userEvent.setup({ document })
  const view = render(<StaticCard request={{ ...REQUEST, status: 'quoted' }} mobile />)
  const trigger = view.getByRole('button', { name: 'Quote Delivered' })
  const outside = document.createElement('button')
  outside.type = 'button'
  outside.textContent = 'Outside status picker'
  document.body.appendChild(outside)
  const expectedLabels = ['Sourcing', 'Quote Delivered', 'Closed won', 'Closed lost', 'Archived']
  assert.equal(REQUEST_STATUS_OPTIONS.find((option) => option.label === 'Quote Delivered')?.value, 'quoted')

  const assertOpenWithin = async (viewport: number) => {
    const menu = await waitFor(() => view.getByRole('menu', { name: 'Choose status for Quote Delivered' }))
    const left = Number.parseFloat(menu.style.left)
    const menuWidth = Number.parseFloat(menu.style.width)
    assert.equal(menuWidth, 190)
    assert.ok(left >= 8)
    assert.ok(left + menuWidth <= viewport - 8)
    assert.match(menu.className, /\bfixed\b/)
    const options = within(menu).getAllByRole('menuitemradio')
    assert.deepEqual(options.map((option) => option.textContent?.trim()), expectedLabels)
    assert.equal(within(menu).getByRole('menuitemradio', { name: 'Quote Delivered' }).getAttribute('aria-checked'), 'true')
    assert.doesNotMatch((view.container.querySelector('[data-mobile-request-status]') as HTMLElement).className, /overflow-hidden/)
    return menu
  }

  await setViewport(320)
  await user.click(trigger)
  const pointerMenu = await assertOpenWithin(320)
  await user.click(within(pointerMenu).getByRole('menuitemradio', { name: 'Quote Delivered' }))
  assert.equal(view.queryByRole('menu'), null)
  assert.equal(document.activeElement, trigger)
  assert.equal(trigger.getAttribute('aria-label'), 'Quote Delivered')
  assert.equal((view.container.querySelector('[data-compact-status-token]') as HTMLElement).textContent, 'QD')

  await setViewport(390)
  trigger.focus()
  await user.keyboard('{Enter}')
  await assertOpenWithin(390)
  await user.tab()
  assert.equal(document.activeElement, view.getByRole('menuitemradio', { name: 'Sourcing' }))
  await user.keyboard('{Escape}')
  assert.equal(view.queryByRole('menu'), null)
  assert.equal(document.activeElement, trigger)

  await setViewport(480)
  trigger.focus()
  await user.keyboard(' ')
  const spaceMenu = await assertOpenWithin(480)
  const lastOption = within(spaceMenu).getByRole('menuitemradio', { name: 'Archived' })
  lastOption.focus()
  await user.tab()
  assert.equal(view.queryByRole('menu'), null)
  assert.equal(document.activeElement, view.getByRole('link', { name: 'Open JR-27 — Courtyard' }))

  trigger.focus()
  await user.keyboard(' ')
  await assertOpenWithin(480)
  await user.click(outside)
  assert.equal(view.queryByRole('menu'), null)
  assert.equal(document.activeElement, outside)
  assert.equal(trigger.getAttribute('aria-label'), 'Quote Delivered')
  assert.equal((view.container.querySelector('[data-compact-status-token]') as HTMLElement).textContent, 'QD')
  outside.remove()
})

test('Last updated is absent from mobile summary and closed details, appears only inside the disclosure, and never comes from notes', async () => {
  const user = userEvent.setup({ document })
  const dated: JobRequestRow = {
    ...REQUEST,
    customer: {
      id: 8,
      name: 'Chris Customer',
      company: 'Oak Hill',
      email: 'chris@example.com',
      phone: '512-555-0100',
      rosieThreadId: 'customer-8',
    },
    externalNotes: 'Shared detail only after expansion',
    sourcingNotes: 'Possible install 8/8/26; Pickup discussed.',
    notes: [{ kind: 'customer', stamp: '2026-08-03 09:00', text: 'Customer note only after expansion' }],
  }
  const view = render(<StaticCard request={dated} mobile />)
  const secondary = view.container.querySelector('[data-mobile-request-secondary]') as HTMLElement
  assert.match(secondary.textContent ?? '', /0\s*Pending/)
  assert.doesNotMatch(secondary.textContent ?? '', /JR-27|Aug|2026|8\/8\/26|Pickup/)
  assert.equal(view.container.querySelector('[data-mobile-request-date]'), null)
  assert.equal(view.queryByText('Last updated'), null)
  for (const collapsedOnly of [
    'Chris Customer', 'chris@example.com', '512-555-0100',
    'Possible install 8/8/26; Pickup discussed.', 'Customer note only after expansion',
    'Shared detail only after expansion',
    'Available', 'Substituted', 'Unavailable',
  ]) {
    assert.equal(view.queryByText(collapsedOnly), null)
  }
  assert.equal(view.container.querySelectorAll('[data-mobile-request-row]').length, 2)
  assert.equal(view.getAllByText('Oak Hill').length, 1)
  assert.equal(view.queryByRole('button', { name: 'Open the customer conversation with Oak Hill' }), null)

  view.rerender(<StaticCard request={dated} mobile expanded />)
  let details = view.getByRole('button', { name: /More details & notes/ })
  assert.equal(details.getAttribute('aria-expanded'), 'false')
  assert.equal(view.container.querySelector('[data-request-last-updated]'), null)
  assert.equal(view.queryByText('Aug 2, 2026'), null)
  assert.ok(view.getByText('512-555-0100 · chris@example.com'))
  assert.ok(view.getByRole('button', { name: 'Open the customer conversation with Oak Hill' }))
  for (const label of ['Pending', 'Available', 'Substituted', 'Unavailable']) {
    assert.ok(view.getByText(label))
  }

  await user.click(details)
  let lastUpdated = view.container.querySelector('[data-request-last-updated]') as HTMLElement
  assert.ok(lastUpdated)
  assert.ok(within(lastUpdated).getByText('Last updated'))
  const timestamp = within(lastUpdated).getByText('Aug 2, 2026')
  assert.equal(timestamp.tagName, 'TIME')
  assert.equal(timestamp.getAttribute('datetime'), dated.updatedAt)
  assert.doesNotMatch(lastUpdated.textContent ?? '', /8\/8\/26|Pickup/)
  assert.ok(view.getByText('Customer note only after expansion'))
  assert.ok(view.getByRole('button', { name: 'Shared detail only after expansion' }))
  assert.ok(view.getByRole('button', { name: 'Possible install 8/8/26; Pickup discussed.' }))

  details = view.getByRole('button', { name: /More details & notes/ })
  await user.click(details)
  assert.equal(view.container.querySelector('[data-request-last-updated]'), null)

  view.rerender(<StaticCard request={{ ...dated, updatedAt: null }} mobile expanded />)
  await user.click(view.getByRole('button', { name: /More details & notes/ }))
  lastUpdated = view.container.querySelector('[data-request-last-updated]') as HTMLElement
  assert.ok(within(lastUpdated).getByText('Not recorded'))
  assert.equal(lastUpdated.querySelector('time'), null)
  await user.click(view.getByRole('button', { name: /More details & notes/ }))

  view.rerender(<StaticCard request={dated} mobile={false} />)
  const desktopDate = view.getByText('Aug 2, 2026')
  assert.equal(desktopDate.getAttribute('title'), 'Created Aug 1, 2026')
})

test('collapsed mobile card shows only exact Pending count while desktop and expanded mobile retain every plant status', () => {
  const counts = { pending: 7, available: 6, alternative_proposed: 5, unavailable: 4 }
  const request = { ...REQUEST, itemCount: 22, statusCounts: counts }
  const view = render(<StaticCard request={request} mobile />)
  const pending = view.container.querySelector('[data-mobile-pending-summary]') as HTMLElement
  assert.ok(pending)
  assert.match(pending.textContent ?? '', /7\s*Pending/)
  for (const hidden of ['Available', 'Substituted', 'Unavailable']) {
    assert.equal(within(pending).queryByText(hidden), null)
    assert.equal(view.queryByText(hidden), null)
  }
  assert.match(pending.className, /\binline-flex\b/)
  assert.match(pending.className, /\bh-7\b/)
  assert.doesNotMatch(pending.className, /\bw-full\b|\bmax-w-full\b|overflow-hidden|min-h-11/)
  const row2 = view.container.querySelector('[data-mobile-request-row="pending-chat"]') as HTMLElement
  assert.equal(row2.children[0], pending)
  assert.equal((row2.children[1] as HTMLElement).dataset.mobileRequestRosie, 'true')

  view.rerender(<StaticCard request={request} mobile={false} />)
  assert.equal(view.container.querySelector('[data-mobile-pending-summary]'), null)
  for (const [label, count] of [['Pending', 7], ['Available', 6], ['Substituted', 5], ['Unavailable', 4]] as const) {
    assert.ok(view.getByText(label))
    assert.ok(view.getByText(String(count)))
  }

  view.rerender(<StaticCard request={request} mobile expanded />)
  assert.equal(view.container.querySelector('[data-mobile-pending-summary]'), null)
  for (const label of ['Pending', 'Available', 'Substituted', 'Unavailable']) {
    assert.ok(view.getByText(label))
  }
})

function CardDeleteHarness({ fetcher }: { fetcher: typeof fetch }) {
  const [expanded, setExpanded] = useState(false)
  const [visible, setVisible] = useState(true)
  const [target, setTarget] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const returnFocus = useRef<HTMLElement | null>(null)
  const list = useRef<HTMLDivElement>(null)
  return (
    <div ref={list} tabIndex={-1} aria-label="Job requests">
      {visible && (
        <RequestCard
          request={REQUEST}
          expanded={expanded}
          mobile
          selected={new Set()}
          version={0}
          onToggle={() => setExpanded((value) => !value)}
          onSelect={() => {}}
          onDelete={(focus) => { returnFocus.current = focus; setTarget(true); setError('') }}
          onDeleteItem={() => {}}
          onSaved={() => {}}
        />
      )}
      {target && (
        <DeleteRequestDialog
          request={REQUEST}
          busy={busy}
          error={error}
          returnFocus={returnFocus}
          onCancel={() => setTarget(false)}
          onConfirm={() => {
            setBusy(true)
            void deleteRequestFromApi(REQUEST.id, fetcher).then(({ ok, body }) => {
              setBusy(false)
              if (!ok) {
                setError(`Could not delete JR-27${body.error ? ` — ${body.error}` : ''}`)
                return
              }
              returnFocus.current = list.current
              setVisible(false)
              setTarget(false)
            })
          }}
        />
      )}
    </div>
  )
}

test('real RequestCard owns no collapsed mobile action and expanded Delete drives cancel, 403 error, success and focus/API behavior', async () => {
  const calls: { input: string; method?: string }[] = []
  let attempts = 0
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input: String(input), method: init?.method })
    attempts += 1
    if (attempts === 1) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
    return new Response(JSON.stringify({ ok: true, deleted: { items: 0, availabilityRequests: 0 } }), { status: 200 })
  }) as typeof fetch
  const user = userEvent.setup({ document })
  const view = render(<CardDeleteHarness fetcher={fetcher} />)
  assert.equal(view.queryByRole('button', { name: /Delete JR-27/ }), null)
  assert.equal(view.queryByRole('button', { name: /Actions/ }), null)
  await user.click(view.getByRole('button', { name: 'Expand JR-27' }))
  const remove = view.getByRole('button', { name: 'Delete JR-27 permanently' })
  assert.match(remove.className, /min-h-11/)
  await user.click(remove)
  assert.ok(view.getByRole('dialog', { name: 'Permanently delete JR-27 — Courtyard?' }))
  assert.match(view.getByText(/change history/).textContent ?? '', /cannot be undone/i)
  await user.click(view.getByRole('button', { name: 'Cancel' }))
  await settle()
  assert.equal(document.activeElement, remove)

  await user.click(remove)
  await user.click(view.getByRole('button', { name: 'Delete permanently' }))
  await waitFor(() => assert.ok(view.getByRole('alert')))
  assert.match(view.getByRole('alert').textContent ?? '', /forbidden/)
  assert.deepEqual(calls[0], { input: '/api/requests/27', method: 'DELETE' })
  assert.ok(view.getByRole('dialog'))

  await user.click(view.getByRole('button', { name: 'Delete permanently' }))
  await waitFor(() => assert.equal(view.queryByRole('dialog'), null))
  await settle()
  assert.equal(view.queryByRole('button', { name: 'Collapse JR-27' }), null)
  assert.equal(document.activeElement, view.getByLabelText('Job requests'))
  assert.deepEqual(calls[1], { input: '/api/requests/27', method: 'DELETE' })
})

test('actual proxy permission path rejects unsigned and partner whole-request DELETE access while admin passes', async () => {
  process.env.APP_SESSION_SECRET = 'test-secret-with-enough-entropy-for-proxy-contract'
  const unsigned = await proxy(new NextRequest('http://localhost/api/requests/27', { method: 'DELETE' }))
  assert.equal(unsigned.status, 401)
  const partner = await createSession({ id: 'p1', username: 'partner', role: 'partner', supplierId: 9, mustChangePassword: false })
  const forbidden = await proxy(new NextRequest('http://localhost/api/requests/27', {
    method: 'DELETE', headers: { cookie: `${SESSION_COOKIE}=${partner}` },
  }))
  assert.equal(forbidden.status, 403)
  const admin = await createSession({ id: 'a1', username: 'admin', role: 'admin', supplierId: null, mustChangePassword: false })
  const allowed = await proxy(new NextRequest('http://localhost/api/requests/27', {
    method: 'DELETE', headers: { cookie: `${SESSION_COOKIE}=${admin}` },
  }))
  assert.equal(allowed.status, 200)
  assert.equal(allowed.headers.get('x-middleware-next'), '1')
})

test('real query builder preserves exact filter selections, rolling date values, broad query and paging', () => {
  const filters = buildRequestFilterQuery({
    status: ['Sourcing', 'Closed won'],
    itemStatus: ['Pending', 'Unavailable'],
    customer: ['Oak Hill', 'Missing'],
    created: ['Last 14 days'],
    updated: ['Today'],
    customerIds: new Map([['Oak Hill', 41]]),
    requestStatusOptions: REQUEST_STATUS_OPTIONS,
    itemStatusOptions: ITEM_STATUS_OPTIONS,
  })
  assert.equal(
    filters,
    'status=sourcing%2Cclosed_won&itemStatus=pending%2Cunavailable&customer=41&created=14&updated=1',
  )
  assert.equal(
    buildRequestListUrl(filters, 'oak JR-27', 3),
    '/api/requests?status=sourcing%2Cclosed_won&itemStatus=pending%2Cunavailable&customer=41&created=14&updated=1&q=oak+JR-27&page=3',
  )
})

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('untouched route/query layer keeps parent updated DESC NULLS LAST then id DESC, rolling windows, paging and history cleanup', () => {
  const route = source('app/api/requests/route.ts')
  const requestRoute = source('app/api/requests/[id]/route.ts')
  const queries = source('lib/job-request-queries.ts')
  assert.match(route, /createdWithin: days\(url\.searchParams\.get\('created'\)\)/)
  assert.match(route, /updatedWithin: days\(url\.searchParams\.get\('updated'\)\)/)
  assert.match(queries, /gte\('created_at', daysAgoIso\(filters\.createdWithin\)\)/)
  assert.match(queries, /gte\('updated_at', daysAgoIso\(filters\.updatedWithin\)\)/)
  assert.match(queries, /\.order\('updated_at', \{ ascending: false, nullsFirst: false \}\)\s*\.order\('id', \{ ascending: false \}\)\s*\.range\(from, from \+ JOB_REQUEST_PAGE_SIZE - 1\)/)
  assert.match(requestRoute, /export async function DELETE/)
  assert.match(requestRoute, /deleteJobRequest\(id\)/)
  assert.match(queries, /export async function deleteJobRequest/)
  assert.match(queries, /job_request_changelog/)
  assert.doesNotMatch(source('components/workspace/request-card-utilities.tsx'), /Print|Copy|Actions/)
})
