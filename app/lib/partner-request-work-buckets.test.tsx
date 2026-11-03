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
  requestBucketCounts,
  type RequestBucketId,
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
    noteForSupplier: null,
    customer: null,
    shipping: null,
    items: [{
      id: id + 1000,
      name: `Plant ${id}`,
      size: '15 G',
      demandedQuantity: 2,
      status: status === 'new' ? null : 'available',
      availableQuantity: status === 'new' ? null : 2,
      unitPrice: 10,
      noteForSupplier: null,
      noteFromSupplier: null,
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

test('open and closed request cards are one row, as a /requests job card: status, name, EDD, mode, items, total (2026-10-21)', () => {
  const note = 'Please allow room for the delivery truck at the south gate.\nCall the site contact before unloading the entire shipment.'
  const value: ARDetail = {
    ...request(8, 'new'),
    recordName: 'JR-42:AR-1',
    createdAt: '2026-09-15T02:00:00Z',
    noteForSupplier: note,
    customer: { name: 'Sam Rivera', company: 'Rivera Landscapes', phone: null, email: null },
    jobSchedules: [
      { jobRequestId: 11, jobName: 'Private courtyard', expectedInstallDate: '2026-09-20', fulfillmentMethod: 'pickup' },
      { jobRequestId: 22, jobName: 'Private garden', expectedInstallDate: '2026-09-26', fulfillmentMethod: 'delivery' },
    ],
  }
  const view = render(<PartnerRequestRow request={value} href="/partner/7/requests/8" />)

  for (const card of [
    <PartnerRequestRow key="open" request={value} href="/partner/7/requests/8" />,
    <PartnerRequestCard key="closed" request={{ ...value, status: 'closed' }} href="/partner/7/requests/8" />,
  ]) {
    view.rerender(card)
    const link = view.getByRole('link')
    assert.equal(link.getAttribute('href'), '/partner/7/requests/8')
    const article = link.closest('article')!
    // One row; the note lives on the request page, the customer in its details.
    assert.equal(article.querySelectorAll(':scope > header').length, 1)
    assert.match(article.textContent ?? '', /JR-42:AR-1.*1 item\$/)
    assert.doesNotMatch(article.textContent ?? '', /Created|Please allow room|Rivera Landscapes/)
    assert.ok(within(article).getAllByText('Sun, 09/20')[0].className.includes('rounded-full'))
    // A request spanning jobs stacks each job's EDD and mode, in job order.
    const schedules = within(article).getByLabelText('Job schedules')
    assert.deepEqual([...schedules.children].map((child) => child.textContent), ['EDDSun, 09/20', 'EDDSat, 09/26'])
    assert.match(article.textContent ?? '', /PickupDelivery/)
    assert.doesNotMatch(article.textContent ?? '', /Private courtyard|Private garden|JR-11|JR-22/)
  }

  view.rerender(<PartnerRequestRow request={request(8, 'new')} href="/partner/7/requests/8" />)
  assert.equal(view.getByLabelText('Job schedules').textContent, 'EDD—')
})

test('New + Processing is the default and each bucket toggles independently', async () => {
  const user = userEvent.setup({ document })
  const view = render(<BucketHarness requests={mixed} />)
  const group = within(view.getByRole('group', { name: 'Request work buckets' }))
  assert.equal(group.queryByRole('button', { name: /select all/i }), null)
  assert.equal(group.getAllByRole('button').length, 3)
  assert.equal(view.getAllByRole('link').length, 3)
  assert.ok(group.getByRole('button', { name: 'New: 2 requests, selected' }))
  assert.ok(group.getByRole('button', { name: 'Processing: 1 requests, selected' }))
  assert.ok(group.getByRole('button', { name: 'Completed: 2 requests, not selected' }))

  await user.click(group.getByRole('button', { name: 'Completed: 2 requests, not selected' }))
  assert.equal(view.getAllByRole('link').length, 5)
  await user.click(group.getByRole('button', { name: 'New: 2 requests, selected' }))
  assert.equal(view.getAllByRole('link').length, 3)
  assert.ok(view.getAllByRole('link').every((link) => !link.getAttribute('aria-label')?.startsWith('New')))
  await user.click(group.getByRole('button', { name: 'Processing: 1 requests, selected' }))
  await user.click(group.getByRole('button', { name: 'Completed: 2 requests, selected' }))
  assert.equal(view.queryAllByRole('link').length, 0)
  assert.match(view.getByRole('status').textContent ?? '', /No request buckets selected/)
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

/** A token's value in the light (`:root`) or dark block of globals.css. */
function token(globals: string, theme: 'light' | 'dark', name: string) {
  const block = theme === 'light' ? globals.match(/:root \{[\s\S]*?\n\}/)![0] : globals.match(/\.dark,[^{]*\{[\s\S]*?\n\}/)![0]
  return block.match(new RegExp(`--${name}: (#[0-9A-Fa-f]{6});`))![1]
}

// Selected tiles invert the card/foreground pair; pills still use the tint.
function assertAccessibleTone(globals: string, name: string, tone: string) {
  for (const theme of ['light', 'dark'] as const) {
    const card = token(globals, theme, 'card')
    const fg = token(globals, theme, `lps-tone-${tone}-fg`)
    const bg = token(globals, theme, `lps-tone-${tone}-bg`)
    assert.ok(contrast(fg, card) >= 4.5, `${name} ${theme} text/border on card`)
    assert.ok(contrast(fg, bg) >= 4.5, `${name} ${theme} text/check/border on tint`)
  }
}

test('every rendered light/dark semantic text, check and border pair passes contrast and remains status-consistent', () => {
  const globals = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
  assert.match(globals, /:root \{[\s\S]*?--card: #FFFFFF;/)
  assert.match(globals, /\.dark(?:,\s*[^{}]+)?\s*\{[^{}]*--card: #1A1A1A;/)
  const selected: RequestBucketId[] = []
  const view = render(
    <>
      <RequestBucketControls counts={requestBucketCounts(mixed)} selected={selected} onChange={() => {}} />
      {mixed.filter((entry, index) => index === 0 || index >= 2).map((entry) => (
        <PartnerRequestRow key={entry.id} request={entry} href={`/request/${entry.id}`} />
      ))}
    </>,
  )

  for (const bucket of REQUEST_BUCKETS) {
    assertAccessibleTone(globals, bucket.label, bucket.tone)
    const control = view.container.querySelector<HTMLElement>(`[data-request-bucket="${bucket.id}"]`)!
    assert.equal(control.getAttribute('aria-pressed'), 'false')
    assert.match(control.getAttribute('aria-label') ?? '', new RegExp(`^${bucket.label}:`))
    assert.equal(control.style.getPropertyValue('--status-filter-color'), `var(--lps-tone-${bucket.tone}-fg)`)
    assert.match(control.className, /enabled:hover:bg-muted/)
    assert.match(control.className, /border-\[var\(--status-filter-color\)\]/)
    assert.equal(control.querySelector('svg'), null)

    const row = view.container.querySelector<HTMLElement>(`[data-request-row-status="${bucket.id}"]`)!
    const pill = row.querySelector<HTMLElement>(`[data-request-status="${bucket.id}"]`)!
    assert.equal(pill.textContent, bucket.label)
    assert.equal(pill.style.getPropertyValue('--bucket-text'), `var(--lps-tone-${bucket.tone}-fg)`)
    assert.match(row.querySelector('a')!.getAttribute('aria-label') ?? '', new RegExp(`^${bucket.label} request:`))
  }

  const row = view.container.querySelector<HTMLElement>('[data-request-row-status="new"] > header')!
  assert.match(row.className, /grid/)
  assert.match(row.className, /px-3\.5 py-2\.5/)
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

  view.rerender(<RequestBucketList requests={[request(5, 'submitted')]} selected={['new']} supplierId={7} />)
  assert.match(view.getByRole('status').textContent ?? '', /No New or Processing requests/)
  assert.match(view.getByRole('status').textContent ?? '', /no active request work/i)
})

test('the default hides submitted requests until Completed is selected, and filters follow reopened requests', async () => {
  const user = userEvent.setup({ document })
  const view = render(<BucketHarness requests={[request(8, 'processing')]} />)
  assert.ok(view.getByRole('link', { name: 'Processing request: Job 8' }))

  view.rerender(<BucketHarness requests={[request(8, 'submitted')]} />)
  assert.equal(view.queryByRole('link'), null)
  assert.ok(view.getByRole('button', { name: 'Completed: 1 requests, not selected' }))

  await user.click(view.getByRole('button', { name: 'Completed: 1 requests, not selected' }))
  assert.ok(view.getByRole('link', { name: 'Completed request: Job 8' }))

  view.rerender(<BucketHarness requests={[request(8, 'new')]} />)
  assert.ok(view.getByRole('link', { name: 'New request: Job 8' }))
})
