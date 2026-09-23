import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { afterEach, beforeEach } from 'node:test'
import React, { useMemo, useState } from 'react'
import { JSDOM } from 'jsdom'
import { cleanup, render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  DEFAULT_REQUEST_BUCKETS,
  PartnerRequestRow,
  REQUEST_BUCKETS,
  RequestBucketControls,
  RequestBucketList,
  SELECT_ALL_PALETTE,
  requestBucketCounts,
  type RequestBucketId,
  type SemanticPalette,
} from '../components/workspace/partner-request-buckets.tsx'
import type { ARDetail } from './availability.ts'
import { PartnerRequestCard } from '../components/workspace/partner.tsx'

let dom: JSDOM

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/partner/7' })
  const win = dom.window
  for (const [key, value] of Object.entries({
    window: win,
    self: win,
    document: win.document,
    navigator: win.navigator,
    HTMLElement: win.HTMLElement,
    Node: win.Node,
    MouseEvent: win.MouseEvent,
    KeyboardEvent: win.KeyboardEvent,
    getComputedStyle: win.getComputedStyle,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  Object.defineProperty(win.HTMLElement.prototype, 'getClientRects', {
    configurable: true,
    value() { return this.isConnected ? [{ width: 1, height: 1 }] : [] },
  })
  Object.defineProperty(win.HTMLElement.prototype, 'attachEvent', { configurable: true, value() {} })
  Object.defineProperty(win.HTMLElement.prototype, 'detachEvent', { configurable: true, value() {} })
})

afterEach(async () => {
  cleanup()
  await new Promise((resolve) => setTimeout(resolve, 0))
  dom.window.close()
})

function request(id: number, status: ARDetail['status']): ARDetail {
  return {
    id,
    jobRequestId: id + 100,
    jobName: `Job ${id}`,
    supplierId: 7,
    supplierName: 'Oak Hill Nursery',
    shareCustomerDetails: false,
    status,
    submittedAt: status === 'submitted' ? '2026-09-03T12:00:00.000Z' : null,
    createdAt: '2026-09-03T11:00:00.000Z',
    itemCount: 1,
    answeredCount: status === 'new' ? 0 : 1,
    lpsNotes: null,
    customer: null,
    shipping: null,
    items: [{
      id: id + 1000,
      jobRequestItemId: id + 2000,
      name: `Plant ${id}`,
      size: '15 G',
      quantity: 2,
      status: status === 'new' ? null : 'available',
      availableQuantity: status === 'new' ? null : 2,
      unitPrice: 10,
      notes: null,
      lpsNotes: null,
    }],
  }
}

function BucketHarness({ requests }: { requests: ARDetail[] }) {
  const [selected, setSelected] = useState<RequestBucketId[]>([...DEFAULT_REQUEST_BUCKETS])
  const counts = useMemo(() => requestBucketCounts(requests), [requests])
  return (
    <>
      <RequestBucketControls counts={counts} selected={selected} onChange={setSelected} />
      <main><RequestBucketList requests={requests} selected={selected} supplierId={7} /></main>
    </>
  )
}

const mixed = [
  request(1, 'new'),
  request(2, 'new'),
  request(3, 'processing'),
  request(4, 'submitted'),
  request(5, 'submitted'),
]

test('open and closed request cards show creation and each anonymous job schedule without truncating request notes', () => {
  const note = 'Please allow room for the delivery truck at the south gate.\nCall the site contact before unloading the entire shipment.'
  const value: ARDetail = {
    ...request(8, 'new'),
    recordName: 'JR-42:AR-1',
    createdAt: '2026-09-15T02:00:00Z',
    lpsNotes: note,
    jobSchedules: [
      { jobRequestId: 11, jobName: 'Private courtyard', expectedInstallDate: '2026-09-20', fulfillmentMethod: 'pickup' },
      { jobRequestId: 22, jobName: 'Private garden', expectedInstallDate: '2026-09-26', fulfillmentMethod: 'delivery' },
    ],
  }
  const view = render(<PartnerRequestRow request={value} href="/partner/7/requests/8" />)
  const noteElement = view.getByTitle(note, { normalizer: (text) => text })
  assert.equal(noteElement.textContent, note)
  assert.doesNotMatch(noteElement.className, /truncate|line-clamp/)
  assert.match(noteElement.className, /whitespace-pre-wrap/)

  for (const card of [
    <PartnerRequestRow key="open" request={value} href="/partner/7/requests/8" />,
    <PartnerRequestCard key="closed" request={{ ...value, status: 'closed' }} href="/partner/7/requests/8" />,
  ]) {
    view.rerender(card)
    const link = view.getByRole('link')
    assert.equal(link.getAttribute('href'), '/partner/7/requests/8')
    assert.ok(link.textContent?.includes('JR-42:AR-1'))
    assert.match(link.textContent ?? '', /Created 09-14/)
    const schedules = within(link).getByLabelText('Job schedules')
    assert.equal(schedules.children[0].textContent, 'Job 1EDD09-20FulfillmentPickup')
    assert.equal(schedules.children[1].textContent, 'Job 2EDD09-26FulfillmentDelivery')
    assert.doesNotMatch(link.textContent ?? '', /Private courtyard|Private garden|JR-11|JR-22/)
  }

  view.rerender(<PartnerRequestRow request={request(8, 'new')} href="/partner/7/requests/8" />)
  assert.equal(view.getByLabelText('Job schedules').textContent, 'EDD—Fulfillment—')
})

test('fresh mounts default to New + Processing while independent toggles and Select all keep global counts', async () => {
  const user = userEvent.setup({ document })
  const view = render(<BucketHarness requests={mixed} />)
  const group = view.getByRole('group', { name: 'Request work buckets' })

  assert.equal(within(group).getByRole('button', { name: 'New: 2 requests, selected' }).getAttribute('aria-pressed'), 'true')
  assert.equal(within(group).getByRole('button', { name: 'Processing: 1 requests, selected' }).getAttribute('aria-pressed'), 'true')
  assert.equal(within(group).getByRole('button', { name: 'Completed: 2 requests, not selected' }).getAttribute('aria-pressed'), 'false')
  assert.equal(view.getAllByRole('link').length, 3)
  assert.equal(view.queryByRole('link', { name: 'Completed request: Job 4' }), null)

  await user.click(within(group).getByRole('button', { name: 'Completed: 2 requests, not selected' }))
  assert.equal(view.getAllByRole('link').length, 5)
  await user.click(within(group).getByRole('button', { name: 'New: 2 requests, selected' }))
  assert.equal(view.getAllByRole('link').length, 3)
  assert.ok(view.getByRole('link', { name: 'Processing request: Job 3' }))
  assert.ok(view.getByRole('link', { name: 'Completed request: Job 4' }))

  await user.click(within(group).getByRole('button', { name: 'Select all request buckets, 5 open requests' }))
  assert.equal(view.getAllByRole('link').length, 5)
  assert.equal(within(group).getByRole('button', { name: 'Select all request buckets, 5 open requests' }).getAttribute('aria-pressed'), 'true')
  assert.ok(within(group).getByRole('button', { name: 'New: 2 requests, selected' }))
  assert.ok(within(group).getByRole('button', { name: 'Processing: 1 requests, selected' }))
  assert.ok(within(group).getByRole('button', { name: 'Completed: 2 requests, selected' }))

  view.unmount()
  const fresh = render(<BucketHarness requests={mixed} />)
  assert.ok(fresh.getByRole('button', { name: 'New: 2 requests, selected' }))
  assert.ok(fresh.getByRole('button', { name: 'Processing: 1 requests, selected' }))
  assert.ok(fresh.getByRole('button', { name: 'Completed: 2 requests, not selected' }))
  assert.equal(fresh.getAllByRole('link').length, 3)
})

function relativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(a: string, b: string) {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((left, right) => right - left)
  return (lighter + 0.05) / (darker + 0.05)
}

function assertAccessiblePalette(name: string, palette: SemanticPalette) {
  for (const theme of ['light', 'dark'] as const) {
    const pair = palette[theme]
    assert.ok(contrast(pair.foreground, pair.normal) >= 4.5, `${name} ${theme} text on normal`)
    assert.ok(contrast(pair.foreground, pair.background) >= 4.5, `${name} ${theme} text/check on tint`)
    assert.ok(contrast(pair.border, pair.normal) >= 3, `${name} ${theme} border on normal`)
    assert.ok(contrast(pair.border, pair.background) >= 3, `${name} ${theme} border on tint`)
  }
}

test('every rendered light/dark semantic text, check and border pair passes contrast and remains status-consistent', () => {
  const globals = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
  assert.match(globals, /:root \{[\s\S]*?--card: #FFFFFF;/)
  assert.match(globals, /\.dark(?:,\s*[^{}]+)?\s*\{[^{}]*--card: #1A1A1A;/)
  const selected: RequestBucketId[] = ['new', 'processing', 'submitted']
  const view = render(
    <>
      <RequestBucketControls counts={requestBucketCounts(mixed)} selected={selected} onChange={() => {}} />
      {mixed.filter((entry, index) => index === 0 || index >= 2).map((entry) => (
        <PartnerRequestRow key={entry.id} request={entry} href={`/request/${entry.id}`} />
      ))}
    </>,
  )

  assertAccessiblePalette('Select all', SELECT_ALL_PALETTE)
  for (const bucket of REQUEST_BUCKETS) {
    assertAccessiblePalette(bucket.label, bucket.palette)
    const control = view.container.querySelector<HTMLElement>(`[data-request-bucket="${bucket.id}"]`)!
    assert.equal(control.getAttribute('aria-pressed'), 'true')
    assert.match(control.getAttribute('aria-label') ?? '', new RegExp(`^${bucket.label}:`))
    assert.equal(control.style.getPropertyValue('--bucket-light-foreground'), bucket.palette.light.foreground)
    assert.equal(control.style.getPropertyValue('--bucket-dark-foreground'), bucket.palette.dark.foreground)
    assert.match(control.className, /bg-\[var\(--bucket-light-background\)\]/)
    assert.match(control.className, /dark:bg-\[var\(--bucket-dark-background\)\]/)
    assert.match(control.className, /dark:border-\[var\(--bucket-dark-border\)\]/)
    assert.ok(control.querySelector('svg'), `${bucket.label} selected check is visible`)

    const row = view.container.querySelector<HTMLElement>(`[data-request-row-status="${bucket.id}"]`)!
    const pill = row.querySelector<HTMLElement>(`[data-request-status="${bucket.id}"]`)!
    assert.equal(pill.textContent, bucket.label)
    assert.equal(pill.style.getPropertyValue('--bucket-light-foreground'), bucket.palette.light.foreground)
    assert.equal(pill.style.getPropertyValue('--bucket-dark-border'), bucket.palette.dark.border)
    assert.match(row.getAttribute('aria-label') ?? '', new RegExp(`^${bucket.label} request:`))
    assert.doesNotMatch(JSON.stringify(bucket.palette), /#E5484D/i)
  }

  const row = view.container.querySelector<HTMLElement>('[data-request-row-status="new"]')!
  assert.match(row.className, /grid-cols-\[minmax\(0,1fr\)_auto\]/)
  assert.match(row.className, /sm:grid-cols-\[8\.5rem_minmax\(0,1fr\)_6\.5rem\]/)
  assert.match(view.getByRole('group', { name: 'Request work buckets' }).className, /overflow-x-auto/)
})

test('empty states distinguish no open work, no selection, hidden results and a genuinely empty active queue', () => {
  const view = render(<RequestBucketList requests={[]} selected={DEFAULT_REQUEST_BUCKETS} supplierId={7} />)
  assert.match(view.getByRole('status').textContent ?? '', /No open requests/)

  view.rerender(<RequestBucketList requests={mixed} selected={[]} supplierId={7} />)
  assert.match(view.getByRole('status').textContent ?? '', /No request buckets selected/)

  view.rerender(<RequestBucketList requests={[request(4, 'new')]} selected={['submitted']} supplierId={7} />)
  assert.match(view.getByRole('status').textContent ?? '', /Nothing in the selected buckets/)
  assert.doesNotMatch(view.getByRole('status').textContent ?? '', /no active request work/i)

  view.rerender(<RequestBucketList requests={[request(5, 'submitted')]} selected={DEFAULT_REQUEST_BUCKETS} supplierId={7} />)
  assert.match(view.getByRole('status').textContent ?? '', /No New or Processing requests/)
  assert.match(view.getByRole('status').textContent ?? '', /no active request work/i)
})

test('a refreshed submitted request leaves the default active buckets, Completed reveals it, and reopening to New restores it', async () => {
  const user = userEvent.setup({ document })
  const view = render(<BucketHarness requests={[request(8, 'processing')]} />)
  assert.ok(view.getByRole('link', { name: 'Processing request: Job 8' }))

  view.rerender(<BucketHarness requests={[request(8, 'submitted')]} />)
  assert.equal(view.queryByRole('link'), null)
  assert.match(view.getByRole('status').textContent ?? '', /No New or Processing requests/)
  assert.ok(view.getByRole('button', { name: 'Completed: 1 requests, not selected' }))

  await user.click(view.getByRole('button', { name: 'Completed: 1 requests, not selected' }))
  assert.ok(view.getByRole('link', { name: 'Completed request: Job 8' }))

  view.rerender(<BucketHarness requests={[request(8, 'new')]} />)
  assert.ok(view.getByRole('link', { name: 'New request: Job 8' }))
})
