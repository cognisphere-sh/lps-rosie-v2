import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { JSDOM } from 'jsdom'

import { RequestLinks } from '../components/workspace/job-request.tsx'
import { RequestCardHeader } from '../components/workspace/request-list-card.tsx'
import type { JobRequestRow } from './rows.ts'

let dom: JSDOM

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/jobs?jr=27' })
  const win = dom.window
  for (const [key, value] of Object.entries({
    window: win,
    self: win,
    document: win.document,
    navigator: win.navigator,
    HTMLElement: win.HTMLElement,
    Node: win.Node,
    MouseEvent: win.MouseEvent,
    CustomEvent: win.CustomEvent,
    getComputedStyle: win.getComputedStyle,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
})

afterEach(() => {
  cleanup()
  dom.window.close()
})

function request(name: string | null): JobRequestRow {
  return {
    id: 27,
    name,
    status: 'quoted',
    customer: {
      type: null,
      id: 4,
      name: 'Jamie Long',
      company: 'Long Landscape',
      email: null,
      phone: null,
      rosieThreadId: null,
    },
    billing: { address: null, city: null, state: null, zip: null },
    shipping: { address: null, city: 'Austin', state: 'TX', zip: null },
    noteForCustomer: null,
    notes: [],
    noteInternal: null,
    itemCount: 0,
    statusCounts: {},
    lineTotal: 0,
    supplierLinks: [],
    items: [],
    createdAt: '2026-08-29T12:00:00Z',
    updatedAt: '2026-08-31T12:00:00Z',
  }
}

/** The live focused Job header: the stacked request card head /jobs renders. */
function stackedHeader(value: JobRequestRow, mobile: boolean) {
  return <RequestCardHeader request={value} mobile={mobile} expanded onToggle={() => undefined}
    onDelete={() => undefined} onSaved={() => undefined} showActions={false} stacked />
}

test('rendered mobile focused header gives the full long Job name a wrapping, non-truncated track', () => {
  const longName = 'Long Landscape | 1700 Very Long Residential Boulevard Courtyard Installation Phase Two'
  const view = render(stackedHeader(request(longName), true))
  const nameControl = view.getByRole('button', { name: 'Edit job name for JR-27' })
  assert.equal(nameControl.textContent, longName)
  assert.match(nameControl.className, /\[overflow-wrap:anywhere\]/)
  assert.doesNotMatch(nameControl.className, /truncate|text-ellipsis|overflow-hidden|whitespace-nowrap/)
  assert.match(nameControl.closest('[data-job-name-editor]')?.parentElement?.className ?? '', /min-w-0/)
})

test('focused headers display saved dates and the pickup mode on mobile and desktop', () => {
  for (const mobile of [true, false]) {
    const dated = render(stackedHeader({ ...request('Patio'), expectedInstallDate: '2026-08-30', fulfillmentMethod: 'pickup' }, mobile))
    assert.equal(dated.container.querySelector('[data-job-metadata] dd')?.textContent, 'Sun, 08/30')
    assert.equal((dated.getByRole('combobox', { name: 'Pickup or delivery' }) as HTMLSelectElement).value, 'pickup')
    assert.ok(dated.getByText('Pickup', { selector: 'span' }))
    dated.unmount()

    const missing = render(stackedHeader(request('Patio'), mobile))
    // An empty editable date asks for one rather than showing a bare dash.
    assert.equal(missing.container.querySelector('[data-job-metadata] dd')?.textContent, 'Set date')
    assert.doesNotMatch(missing.container.querySelector('[data-job-metadata]')?.textContent ?? '', /08-31/)
    missing.unmount()
  }
})

test('job AR links show the submitted date only while submitted, otherwise the creation date', () => {
  const linked = request('Patio')
  linked.supplierLinks = [{
    supplierId: 88, name: 'APS', lpsPartner: true, rosieThreadId: null,
    availabilityRequests: [
      { id: 803, status: 'submitted', createdAt: '2026-09-01T12:00:00Z', submittedAt: '2026-09-15T01:00:00Z' },
      { id: 802, status: 'new', createdAt: '2026-09-02T12:00:00Z', submittedAt: '2026-09-10T12:00:00Z' },
      { id: 801, status: 'processing', createdAt: '2026-09-03T12:00:00Z', submittedAt: null },
      { id: 800, status: 'closed', createdAt: '2026-09-04T12:00:00Z', submittedAt: '2026-09-10T12:00:00Z' },
      { id: 799, status: 'submitted', createdAt: '2026-09-01T12:00:00Z', submittedAt: null },
    ],
  }]
  for (const focusedMobile of [false, true]) {
    const view = render(<RequestLinks request={linked} focusedMobile={focusedMobile} />)
    for (const [id, expected] of [[803, 'Mon, 09/14'], [802, 'Wed, 09/02'], [801, 'Thu, 09/03'], [800, 'Fri, 09/04'], [799, '—']]) {
      const link = view.getByRole('button', { name: new RegExp(`AR-${id}`) })
      assert.equal(link.lastElementChild?.textContent, expected)
      assert.equal(document.getElementById(link.getAttribute('aria-describedby')!)?.textContent, expected)
      const dot = link.querySelector('[aria-hidden="true"]')
      const tone = id === 800 ? 'grey' : id === 802 ? 'blue' : id === 801 ? 'orange' : 'green'
      assert.ok(link.classList.contains(`bg-[var(--lps-tone-${tone}-bg)]`))
      assert.ok(link.classList.contains(`text-[var(--lps-tone-${tone}-fg)]`))
      if (id === 800) {
        assert.equal(dot, null)
      } else {
        assert.ok(dot)
        assert.match(dot.className, id === 802 ? /lps-tone-blue-dot/ : id === 801 ? /lps-tone-orange-dot/ : /lps-tone-green-dot/)
        assert.match(link.getAttribute('aria-label')!, id === 802 || id === 801 ? /In progress/ : /Completed/)
      }
    }
    view.unmount()
  }
})

test('focused mobile RequestLinks wraps long suppliers and keeps every AR reachable without duplicating nested chat at 320 and 390', () => {
  const linked = request('Patio')
  linked.supplierLinks = [{
    supplierId: 88,
    name: 'Extraordinarily Long Hill Country Native Plant and Tree Supply Company',
    lpsPartner: true,
    availabilityRequests: [
      { id: 803, status: 'submitted' },
      { id: 802, status: 'processing' },
      { id: 801, status: 'new' },
    ],
    rosieThreadId: 'supplier-extraordinarily-long-hill-country-native-plant-tree-supply',
  }]

  for (const width of [320, 390]) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    const view = render(
      <div style={{ width }}>
        <RequestLinks request={linked} focusedMobile className="px-3" />
      </div>,
    )
    const links = view.container.querySelector<HTMLElement>('[data-focused-mobile-request-links]')
    const pill = view.container.querySelector<HTMLElement>('[data-focused-mobile-supplier-pill]')
    assert.ok(links)
    assert.ok(pill)
    assert.match(links.className, /min-w-0/)
    assert.match(links.className, /max-w-full/)
    assert.doesNotMatch(links.className, /overflow-x-(?:auto|scroll|hidden)/)
    assert.match(pill.className, /w-full/)
    assert.match(pill.className, /min-w-0/)
    assert.match(pill.className, /max-w-full/)
    assert.match(pill.className, /flex-wrap/)
    assert.doesNotMatch(pill.className, /overflow-hidden/)

    const supplierName = view.getByText(linked.supplierLinks[0].name)
    assert.match(supplierName.className, /break-words/)
    assert.match(supplierName.className, /\[overflow-wrap:anywhere\]/)
    assert.doesNotMatch(supplierName.className, /truncate|whitespace-nowrap/)
    for (const id of [803, 802, 801]) {
      const action = view.getByRole('button', { name: new RegExp(`AR-${id}`) })
      assert.equal(action.closest('[data-focused-mobile-supplier-pill]'), pill)
    }
    assert.equal(view.queryByRole('button', {
      name: `Open the supplier conversation with ${linked.supplierLinks[0].name}`,
    }), null)
    assert.equal(pill.querySelectorAll('button').length, 3)
    view.unmount()
  }

  const ars: number[] = []
  let supplierChat: unknown = null
  window.addEventListener('lps:open-ar', (event) => ars.push((event as CustomEvent<number>).detail))
  window.addEventListener('lps:open-chat', (event) => { supplierChat = (event as CustomEvent).detail })
  const routes = render(<RequestLinks request={linked} focusedMobile />)
  fireEvent.click(routes.getByRole('button', { name: /AR-802/ }))
  assert.deepEqual(ars, [802])
  assert.equal(supplierChat, null)
})

test('ordinary and desktop-focused RequestLinks retain the established single-row segmented pill', () => {
  const linked = request('Patio')
  linked.supplierLinks = [{
    supplierId: 88,
    name: 'Extraordinarily Long Hill Country Native Plant and Tree Supply Company',
    lpsPartner: true,
    availabilityRequests: [{ id: 803, status: 'submitted' }, { id: 802, status: 'new' }],
    rosieThreadId: 'supplier-88',
  }]
  const view = render(<RequestLinks request={linked} />)
  assert.equal(view.container.querySelector('[data-focused-mobile-request-links]'), null)
  assert.equal(view.container.querySelector('[data-focused-mobile-supplier-pill]'), null)
  const name = view.getByText(linked.supplierLinks[0].name)
  assert.match(name.className, /truncate/)
  assert.equal(name.parentElement?.parentElement?.className,
    'inline-flex min-w-0 max-w-full flex-none flex-wrap items-stretch overflow-hidden rounded-xl border border-lps-edge bg-card text-[11px] font-semibold')
})
