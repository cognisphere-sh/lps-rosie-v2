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
import { Toolbar, type Chip } from '../components/workspace/toolbar.tsx'
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

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

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

const BASELINE = ['Quote', 'Availability', 'Committed', 'Won', 'Lost']

function useRequestChips() {
  const [status, setStatus] = useState(BASELINE)
  const [itemStatus, setItemStatus] = useState<string[]>([])
  const [customer, setCustomer] = useState<string[]>([])
  const [created, setCreated] = useState<string[]>([])
  const [updated, setUpdated] = useState<string[]>([])
  return [
    { label: 'Status', values: status, options: BASELINE, onChange: setStatus, allLabel: 'All statuses' },
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
  for (const group of ['Status', 'Customer', 'Created', 'Updated']) {
    assert.ok(within(dialog).getByText(group, { selector: 'legend' }))
  }
  assert.equal(within(dialog).queryByText('Item status'), null)
  assert.equal(within(dialog).queryByRole('checkbox', { name: 'Pending' }), null)
  for (const status of BASELINE) {
    assert.equal((within(dialog).getByRole('checkbox', { name: status }) as HTMLInputElement).checked, true)
  }
  assert.equal(within(dialog).queryByRole('checkbox', { name: 'Confirmed' }), null)
  assert.equal((within(dialog).getByRole('checkbox', { name: 'Committed' }) as HTMLInputElement).checked, true)
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
  await user.click(within(portal).getByRole('checkbox', { name: 'Committed' }))
  assert.equal(trigger.getAttribute('aria-label'), 'Filters, 1 active')
  await user.click(within(portal).getByRole('checkbox', { name: 'Oak Hill' }))
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

function ItemStatusIsolationHarness({ resolved }: { resolved: boolean }) {
  const [itemStatus, setItemStatus] = useState(['Pending'])
  const chips: Chip[] = [
    { label: 'Status', values: BASELINE, options: BASELINE, onChange: () => {}, allLabel: 'All statuses' },
    { label: 'Item status', values: itemStatus, options: ['Pending', 'Available'], onChange: setItemStatus, allLabel: 'All item statuses' },
  ]
  const effective = resolved === false ? itemStatus : []
  const filters = buildRequestFilterQuery({
    status: BASELINE, itemStatus: effective, customer: [], created: [], updated: [], customerIds: new Map(),
    requestStatusOptions: REQUEST_STATUS_OPTIONS, itemStatusOptions: ITEM_STATUS_OPTIONS,
  })
  return <div data-effective-query={filters}>
    <RequestsToolbar resolvedMobile={resolved} placeholder="Search plants, customers, JR-…" query="" onQuery={() => {}}
      chips={chips} statusBaseline={BASELINE} controls={null} hasFilters={effective.length > 0}
      onClear={() => { if (resolved === false) setItemStatus([]) }} summary="12 requests" />
  </div>
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
      controls={resolved === false ? <button type="button">Expand all</button> : null}
      rightActions={<DesktopAction />}
      hasFilters={false}
      onClear={() => {}}
      summary="12 requests"
    />
  )
}

test('desktop Item status is parked across mobile with no mobile DOM, badge or query constraint', async () => {
  const user = userEvent.setup({ document })
  const view = render(<ItemStatusIsolationHarness resolved={false} />)
  assert.equal(new URLSearchParams(view.container.firstElementChild?.getAttribute('data-effective-query') ?? '').get('itemStatus'), 'pending')
  assert.ok(view.getByRole('button', { name: 'Pending' }))

  view.rerender(<ItemStatusIsolationHarness resolved />)
  assert.equal(new URLSearchParams(view.container.firstElementChild?.getAttribute('data-effective-query') ?? '').has('itemStatus'), false)
  const filter = view.getByRole('button', { name: 'Filters' })
  await user.click(filter)
  await waitFor(() => assert.ok(document.body.querySelector('[data-request-filter-portal]')))
  const dialog = within(document.body.querySelector('[data-request-filter-portal]') as HTMLElement).getByRole('dialog', { name: 'Filters' })
  assert.equal(within(dialog).queryByText('Item status'), null)
  assert.equal(within(dialog).queryByRole('checkbox', { name: 'Pending' }), null)
  await user.keyboard('{Escape}')
  await settle()

  view.rerender(<ItemStatusIsolationHarness resolved={false} />)
  assert.equal(new URLSearchParams(view.container.firstElementChild?.getAttribute('data-effective-query') ?? '').get('itemStatus'), 'pending')
  assert.ok(view.getByRole('button', { name: 'Pending' }))
  const page = source('app/(workspace)/requests/page.tsx')
  assert.match(page, /normalizeStoredRequestStatusLabels\(saved\.itemStatus/)
  assert.match(page, /JSON\.stringify\(\{ query, status, itemStatus, customer/)
  assert.match(page, /effectiveItemStatus = requestsMobile === false \? itemStatus : \[\]/)
  assert.match(page, /itemStatus: effectiveItemStatus/)
  assert.match(page, /if \(requestsMobile === false\) setItemStatus\(DEFAULT_ITEM_STATUSES\)/)
})

test('legacy persisted Quoted filter restores and saves canonically without losing quoted jobs or creating a false deviation', () => {
  const storageKey = 'lps.requests.visit.v1'
  window.sessionStorage.setItem(storageKey, JSON.stringify({
    status: ['Sourcing', 'Quoted', 'Availability', 'Confirmed', 'Closed won', 'Closed lost'],
  }))
  const stored = JSON.parse(window.sessionStorage.getItem(storageKey) ?? 'null') as { status: unknown }
  const legacy = normalizeStoredRequestStatusLabels(
    stored.status,
    REQUEST_STATUS_OPTIONS,
    BASELINE,
  )
  assert.deepEqual(legacy, BASELINE)
  assert.equal(legacy.includes('Quoted'), false)
  assert.equal(legacy.includes('Quote'), true)
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
  assert.equal(new URLSearchParams(query).get('status'), 'quoted,availability,committed,closed_won,closed_lost')
  window.sessionStorage.setItem(storageKey, JSON.stringify({ ...stored, status: legacy }))
  assert.deepEqual(JSON.parse(window.sessionStorage.getItem(storageKey) ?? 'null').status, BASELINE)

  assert.deepEqual(
    normalizeStoredRequestStatusLabels(
      ['Quoted', 'Quote', 'Bogus', 7, null, 'Active'],
      REQUEST_STATUS_OPTIONS,
      BASELINE,
    ),
    ['Quote'],
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
  const page = source('app/(workspace)/requests/page.tsx')
  assert.match(page, /setStatus\(normalizeStoredRequestStatusLabels\(saved\.status, REQUEST_STATUS_OPTIONS, DEFAULT_STATUSES\)\)/)
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

  const committed = within(dialog).getByRole('checkbox', { name: 'Committed' }) as HTMLInputElement
  await user.click(committed)
  assert.equal(committed.checked, false)
  assert.equal(document.activeElement, committed)
  assert.ok(document.body.contains(dialog))

  assert.equal(within(dialog).queryByText('Item status'), null)
  assert.equal(within(dialog).queryByRole('checkbox', { name: 'Pending' }), null)

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
  assert.equal((within(dialog).getByRole('checkbox', { name: 'Committed' }) as HTMLInputElement).checked, false)
  assert.equal(within(dialog).queryByText('Item status'), null)
  assert.equal(within(dialog).queryByRole('checkbox', { name: 'Pending' }), null)
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
  await user.click(view.getByRole('button', { name: 'Status · 5' }))
  assert.ok(view.getByRole('button', { name: 'Committed' }))

  view.rerender(<ToolbarHarness resolved />)
  await settle()
  assert.ok(view.container.querySelector('[data-requests-toolbar-branch="mobile"]'))
  assert.equal(view.getAllByRole('textbox', { name: 'Search plants, customers, JR-…' }).length, 1)
  assert.equal(view.queryByRole('button', { name: 'Status · 5' }), null)
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

  await user.click(view.getByRole('button', { name: 'Status · 5' }))
  view.rerender(<ToolbarHarness resolved />)
  await settle()
  assert.equal(view.queryByRole('button', { name: 'Committed' }), null)
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

test('real media-query resolution is neutral in SSR and structural budgets bound 320/390/480/514/899 mobile rows before desktop at 900', async () => {
  const server = renderToString(<ResolvedToolbarHarness />)
  assert.match(server, /data-requests-toolbar-branch="neutral"/)
  assert.doesNotMatch(server, /jobs-new-trigger|request-filter-surface|<input/)
  const view = render(<ResolvedToolbarHarness />)
  await settle()
  for (const width of [320, 390, 480, 514, 899]) {
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
    assert.equal([...view.container.querySelectorAll('button')].some((button) => button.textContent === 'Expand all'), false)
    assert.equal(view.container.querySelector('[hidden] button'), null)
    if ([320, 390, 480].includes(width)) {
      fireEvent.click(filter)
      await waitFor(() => assert.ok(document.body.querySelector('[data-request-filter-portal]')))
      const portal = document.body.querySelector('[data-request-filter-portal]') as HTMLElement
      assert.equal([...portal.querySelectorAll('legend')].some((legend) => legend.textContent === 'Item status'), false)
      assert.equal([...portal.querySelectorAll('input')].some((control) => control.getAttribute('name') === 'requests-Item status'), false)
      fireEvent.click(portal.querySelector('button[aria-label="Close filters"]')!)
      await settle()
    }
  }
  await setViewport(900)
  assert.ok(view.container.querySelector('[data-requests-toolbar-branch="desktop"]'))
  assert.ok(view.getByRole('button', { name: 'Expand all' }))
  assert.ok(view.getByRole('button', { name: /Item status/ }))
  assert.equal(view.container.querySelector('[data-request-mobile-search-row]'), null)
  assert.equal(document.querySelectorAll('#jobs-new-trigger').length, 1)
  const frame = source('components/workspace/frame.tsx')
  const page = source('app/(workspace)/requests/page.tsx')
  assert.match(frame, /flex min-h-0 min-w-0 flex-col overflow-hidden/)
  assert.match(page, /controls=\{requestsMobile === false \? \(/)
  assert.match(page, /className="flex min-h-0 flex-1 flex-col gap-2\.5 overflow-auto/)
})

const REQUEST: JobRequestRow = {
  id: 27,
  name: 'Courtyard',
  status: 'quoted',
  customer: null,
  billing: { address: null, city: null, state: null, zip: null },
  shipping: { address: null, city: null, state: null, zip: null },
  noteForCustomer: null,
  notes: [],
  noteInternal: null,
  itemCount: 0,
  statusCounts: { pending: 0, available: 0, diff_size_sub: 0, unavailable: 0 },
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

test('request cards show the requested identity, totals and contact rows without status counts', async () => {
  const user = userEvent.setup({ document })
  const request = { ...REQUEST, name: 'Courtyard', itemCount: 22,
    notes: [{ kind: 'customer' as const, stamp: null, text: 'Please deliver all plants to the rear entrance after calling ahead.' }],
    customer: { ...REQUEST.customer!, company: 'Land Water Light', name: 'Dior Goodwin', type: 'Homeowner/Retail' as const } }
  const view = render(<StaticCard request={request} mobile />)
  const identity = view.getByRole('link', { name: 'Open JR-27 — Land Water Light — Courtyard' })
  assert.equal(identity.textContent, 'JR-27 - Retail Land Water Light - Courtyard')
  assert.match(identity.title, /Created /)
  assert.ok(view.getByText('22 items'))
  assert.ok(view.getByLabelText('Edit EDD'))
  assert.equal((view.getByRole('combobox', { name: 'Pickup or delivery' }) as HTMLSelectElement).value, '')
  const customerPill = view.container.querySelector('[data-request-customer-pill]') as HTMLElement
  assert.match(customerPill.className, /max-w-full/)
  assert.equal(within(customerPill).getByRole('link', { name: 'Dior Goodwin' }).getAttribute('href'), `/customers/${request.customer.id}`)
  assert.equal(identity.getAttribute('href'), '/jobs?jr=27')
  const note = within(customerPill).getByText(request.notes[0].text)
  assert.match(note.className, /truncate/)
  assert.match(note.parentElement?.className ?? '', /flex-1/)
  assert.equal(note.parentElement?.title, request.notes[0].text)
  assert.equal(view.container.querySelector('[data-request-card-secondary]')?.parentElement, view.container.querySelector('[data-request-card-head]'))
  assert.ok(view.container.querySelector('[data-request-card-secondary]')?.contains(customerPill))
  assert.equal(view.queryByText('Customer Chat'), null)
  assert.equal(view.queryByText('Rosie Chat'), null)
  assert.equal(view.queryByText('Pending'), null)
  assert.equal(view.queryByText('Created'), null)
  assert.equal(view.queryByRole('button', { name: /Expand|Collapse/ }), null)
  let opened: unknown
  window.addEventListener('lps:open-chat', (event) => { opened = (event as CustomEvent).detail }, { once: true })
  await user.click(view.getByRole('button', { name: 'Chat with Rosie about JR-27' }))
  assert.deepEqual(opened, { agentId: 'rosie', threadId: 'jr-27', label: 'Courtyard' })
  view.rerender(<StaticCard request={request} mobile={false} />)
  assert.ok(view.getByRole('button', { name: 'Expand JR-27' }))
  assert.equal(view.queryByRole('menuitem', { name: 'Delete JR-27' }), null)
  const more = view.getByRole('button', { name: 'More actions for JR-27' })
  await user.click(more)
  assert.ok(view.getByRole('menuitem', { name: 'Delete JR-27' }))
  await user.keyboard('{Escape}')
  assert.equal(document.activeElement, more)
  assert.equal(view.queryByText('Pending'), null)
  view.rerender(<StaticCard request={request} mobile={false} expanded />)
  assert.ok(view.getByRole('button', { name: 'Collapse JR-27' }))
  assert.ok(view.getByRole('button', { name: 'Job details & notes' }))
})

test('status filter supports selecting and deselecting every option', async () => {
  function Harness() {
    const [values, setValues] = useState(['Committed', 'Availability'])
    return <RequestFilters chips={[{ label: 'Status', values, onChange: setValues,
      options: BASELINE, allLabel: 'All statuses', selectAllActions: true }]}
      statusBaseline={['Committed', 'Availability']} onClear={() => {}} />
  }
  const user = userEvent.setup({ document })
  const view = render(<Harness />)
  await user.click(view.getByRole('button', { name: 'Filters' }))
  const dialog = within(document.body).getByRole('dialog')
  assert.equal(within(dialog).queryByRole('button', { name: 'All statuses' }), null)
  await user.click(within(dialog).getByRole('button', { name: 'Select all' }))
  assert.ok(within(dialog).getAllByRole('checkbox').every((input) => (input as HTMLInputElement).checked))
  await user.click(within(dialog).getByRole('button', { name: 'Deselect all' }))
  assert.ok(within(dialog).getAllByRole('checkbox').every((input) => !(input as HTMLInputElement).checked))
})


test('desktop Item status selects and deselects all options with distinct query behavior', async () => {
  const options = ITEM_STATUS_OPTIONS.map((option) => option.label)
  function Harness() {
    const [values, setValues] = useState(options)
    return <Toolbar placeholder="Search" query="" onQuery={() => {}} hasFilters={false} onClear={() => {}} summary=""
      chips={[{ label: 'Item status', values, options, onChange: setValues, allLabel: 'All item statuses', selectAllActions: true }]} />
  }
  const user = userEvent.setup({ document })
  const view = render(<Harness />)
  await user.click(view.getByRole('button', { name: `Item status · ${options.length}` }))
  assert.equal(view.queryByRole('button', { name: 'All item statuses' }), null)
  await user.click(view.getByRole('button', { name: 'Deselect all' }))
  // Empty means "none" here, and the chip says so instead of reading as "all".
  assert.ok(view.getByRole('button', { name: 'Item status · none' }))
  await user.click(view.getByRole('button', { name: 'Select all' }))
  assert.ok(view.getByRole('button', { name: `Item status · ${options.length}` }))
  const args = { status: ['Committed'], customer: [], created: [], updated: [], customerIds: new Map<string, number>(),
    requestStatusOptions: REQUEST_STATUS_OPTIONS, itemStatusOptions: ITEM_STATUS_OPTIONS, itemStatusEmptyMeansNone: true }
  assert.equal(new URLSearchParams(buildRequestFilterQuery({ ...args, itemStatus: [] })).get('itemStatus'), 'none')
  assert.equal(new URLSearchParams(buildRequestFilterQuery({ ...args, itemStatus: options })).get('itemStatus'), null)
})
