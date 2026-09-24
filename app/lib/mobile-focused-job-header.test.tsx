import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import React from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JSDOM } from 'jsdom'

import {
  FocusedJobHeader,
  focusedJobChatChoices,
  focusedJobChatMenuPosition,
  type FocusedJobChatTarget,
} from '../components/workspace/focused-job-header.tsx'
import { RequestLinks } from '../components/workspace/job-request.tsx'
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
  win.HTMLElement.prototype.getBoundingClientRect = () => ({
    left: 20, right: 64, top: 20, bottom: 64, width: 44, height: 44,
    x: 20, y: 20, toJSON: () => ({}),
  })
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
    noteFromCustomer: null,
    notes: [],
    noteForCustomer: null,
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

const status = <span data-testid="status" className="text-[11.5px]">Sourcing</span>
const preview = <div data-testid="preview">Long Landscape · Austin, TX</div>

test('rendered mobile header gives the full long Job name a wrapping, non-truncated track', () => {
  const longName = 'Long Landscape | 1700 Very Long Residential Boulevard Courtyard Installation Phase Two'
  const view = render(
    <FocusedJobHeader request={request(longName)} mobile status={status} preview={preview} />,
  )
  const header = view.container.querySelector<HTMLElement>('[data-focused-job-header="mobile"]')
  assert.ok(header)
  assert.equal(view.queryByText(longName)?.textContent, longName)
  const heading = view.getByRole('heading', { level: 1 })
  const nameControl = view.getByRole('button', { name: 'Edit job name for JR-27' })
  assert.match(nameControl.className, /break-words/)
  assert.match(nameControl.className, /\[overflow-wrap:anywhere\]/)
  assert.match(nameControl.className, /min-h-11/)
  assert.doesNotMatch(nameControl.className, /truncate|text-ellipsis|overflow-hidden|whitespace-nowrap/)
  assert.match(heading.className, /min-w-0/)
  assert.match(heading.parentElement?.className ?? '', /min-w-0/)
  assert.equal(view.getByTestId('preview').textContent, 'Long Landscape · Austin, TX')
})

test('focused headers display saved dates and a separate pickup tag on mobile and desktop', () => {
  for (const mobile of [true, false]) {
    const dated = render(
      <FocusedJobHeader request={{ ...request('Patio'), expectedInstallDate: '2026-08-30', fulfillmentMethod: 'pickup' }}
        mobile={mobile} status={status} preview={preview} />,
    )
    assert.equal(dated.container.querySelector('[data-job-fulfillment]')?.textContent, 'Pickup')
    const metadata = dated.container.querySelector('[data-job-metadata]')!
    assert.deepEqual([...metadata.querySelectorAll('dt')].map((node) => node.textContent), ['EDD', 'Fulfillment'])
    assert.equal(metadata.querySelector('dd')?.textContent, 'Sun, 08/30')
    assert.ok(metadata.parentElement?.querySelector(mobile ? 'h1' : '[data-desktop-job-identity]'))
    dated.unmount()

    const missing = render(
      <FocusedJobHeader request={request('Patio')} mobile={mobile} status={status} preview={preview} />,
    )
    assert.equal(missing.container.querySelector('[data-job-metadata] dd')?.textContent, '—')
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
      const tone = id === 800 ? 'grey' : id === 802 || id === 801 ? 'amber' : 'green'
      assert.ok(link.classList.contains(`bg-[var(--lps-tone-${tone}-bg)]`))
      assert.ok(link.classList.contains(`text-[var(--lps-tone-${tone}-fg)]`))
      if (id === 800) {
        assert.equal(dot, null)
      } else {
        assert.ok(dot)
        assert.match(dot.className, id === 802 || id === 801 ? /lps-tone-amber-dot/ : /lps-tone-green-dot/)
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
    'inline-flex min-w-0 max-w-full flex-none flex-wrap items-stretch overflow-hidden rounded-xl border border-lps-edge bg-card text-[10.5px] font-semibold')
})

test('chat choices normalize and dedupe existing routes in stable first-seen order without Job collisions', () => {
  const linked = request('Patio')
  linked.supplierLinks = [
    { supplierId: 1, name: 'First label', lpsPartner: true, availabilityRequests: [], rosieThreadId: '  supplier-shared  ' },
    { supplierId: 2, name: 'Different duplicate label', lpsPartner: true, availabilityRequests: [], rosieThreadId: 'supplier-shared' },
    { supplierId: 3, name: 'First label', lpsPartner: true, availabilityRequests: [], rosieThreadId: ' supplier-shared ' },
    { supplierId: 4, name: 'Blank', lpsPartner: true, availabilityRequests: [], rosieThreadId: '   ' },
    { supplierId: 5, name: 'Job collision', lpsPartner: true, availabilityRequests: [], rosieThreadId: ' jr-27 ' },
    { supplierId: 6, name: 'Second unique', lpsPartner: false, availabilityRequests: [], rosieThreadId: ' supplier-second ' },
  ]
  const choices = focusedJobChatChoices(linked)
  assert.deepEqual(choices.map((choice) => [choice.label, choice.target.threadId]), [
    ['Job chat · JR-27', 'jr-27'],
    ['Supplier chat · First label', 'supplier-shared'],
    ['Supplier chat · Second unique', 'supplier-second'],
  ])
  assert.equal(new Set(choices.map((choice) => choice.target.threadId)).size, choices.length)

  let opened: FocusedJobChatTarget | null = null
  const view = render(
    <FocusedJobHeader request={linked} mobile status={status} preview={preview}
      onOpenRosie={(target) => { opened = target }} />,
  )
  fireEvent.click(view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' }))
  assert.equal(view.queryByRole('menuitem', { name: 'Supplier chat · Different duplicate label' }), null)
  assert.equal(view.queryByRole('menuitem', { name: 'Supplier chat · Blank' }), null)
  assert.equal(view.queryByRole('menuitem', { name: 'Supplier chat · Job collision' }), null)
  fireEvent.click(view.getByRole('menuitem', { name: 'Supplier chat · First label' }))
  assert.deepEqual(opened, { agentId: 'rosie', threadId: 'supplier-shared', label: 'First label' })
})

test('mobile 44px Rosie avatar opens an exact Job-first anchored menu with supplier routes and no modal chrome', () => {
  const linked = request('Patio')
  linked.supplierLinks = [
    {
      supplierId: 88,
      name: 'Hill Country Native Plant Supply',
      lpsPartner: true,
      availabilityRequests: [{ id: 803, status: 'submitted' }],
      rosieThreadId: 'supplier-hill-country-native-plant-supply',
    },
    {
      supplierId: 89,
      name: 'Oak & Stone Nursery',
      lpsPartner: false,
      availabilityRequests: [{ id: 804, status: 'new' }],
      rosieThreadId: 'supplier-oak-stone-nursery',
    },
  ]
  let opened: FocusedJobChatTarget | null = null
  const view = render(
    <FocusedJobHeader request={linked} mobile status={status} preview={preview}
      onOpenRosie={(target) => { opened = target }} />,
  )
  const trigger = view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' })
  assert.match(trigger.className, /size-11/)
  assert.equal(trigger.getAttribute('title'), null)
  assert.equal(trigger.textContent, '')
  assert.equal(trigger.getAttribute('aria-haspopup'), 'menu')
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  assert.equal(trigger.querySelectorAll('img').length, 1)

  fireEvent.click(trigger)
  const menu = view.getByRole('menu', { name: 'Rosie chats for JR-27' })
  assert.equal(trigger.getAttribute('aria-expanded'), 'true')
  assert.equal(trigger.getAttribute('aria-controls'), menu.id)
  assert.equal(view.queryByText('Choose a chat'), null)
  assert.equal(view.queryByRole('button', { name: /Close chat chooser/ }), null)
  const items = view.getAllByRole('menuitem')
  assert.deepEqual(items.map((item) => item.textContent?.trim()), [
    'Job chat · JR-27',
    'Supplier chat · Hill Country Native Plant Supply',
    'Supplier chat · Oak & Stone Nursery',
  ])
  assert.equal(document.activeElement, items[0])
  assert.equal(view.queryByRole('menuitem', { name: /AR-803|AR-804/ }), null)

  fireEvent.click(view.getByRole('menuitem', { name: 'Supplier chat · Oak & Stone Nursery' }))
  assert.deepEqual(opened, {
    agentId: 'rosie',
    threadId: 'supplier-oak-stone-nursery',
    label: 'Oak & Stone Nursery',
  })
  assert.equal(view.queryByRole('menu', { name: 'Rosie chats for JR-27' }), null)
  assert.equal(document.querySelector('[data-focused-job-chat-portal-host]'), null)
})

test('zero-supplier trigger and menu support Arrow open plus Enter on the canonical Job route', () => {
  let opened: FocusedJobChatTarget | null = null
  const view = render(
    <FocusedJobHeader request={request('Patio')} mobile status={status} preview={preview}
      onOpenRosie={(target) => { opened = target }} />,
  )
  const trigger = view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' })
  trigger.focus()
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  const menu = view.getByRole('menu', { name: 'Rosie chats for JR-27' })
  const job = view.getByRole('menuitem', { name: 'Job chat · JR-27' })
  assert.equal(view.getAllByRole('menuitem').length, 1)
  assert.equal(document.activeElement, job)
  fireEvent.keyDown(menu, { key: 'Enter' })
  assert.deepEqual(opened, { agentId: 'rosie', threadId: 'jr-27', label: 'Patio' })
})

test('menu keyboard navigation wraps, supports Home/End/Space, and routes the focused item', () => {
  const linked = request('Patio')
  linked.supplierLinks = [
    { supplierId: 1, name: 'Supplier One', lpsPartner: true, availabilityRequests: [], rosieThreadId: 'supplier-one' },
    { supplierId: 2, name: 'Supplier Two', lpsPartner: true, availabilityRequests: [], rosieThreadId: 'supplier-two' },
  ]
  let opened: FocusedJobChatTarget | null = null
  const view = render(
    <FocusedJobHeader request={linked} mobile status={status} preview={preview}
      onOpenRosie={(target) => { opened = target }} />,
  )
  const trigger = view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' })
  trigger.focus()
  fireEvent.keyDown(trigger, { key: 'ArrowUp' })
  const menu = view.getByRole('menu', { name: 'Rosie chats for JR-27' })
  const job = view.getByRole('menuitem', { name: 'Job chat · JR-27' })
  const one = view.getByRole('menuitem', { name: 'Supplier chat · Supplier One' })
  const two = view.getByRole('menuitem', { name: 'Supplier chat · Supplier Two' })
  assert.equal(document.activeElement, two)
  fireEvent.keyDown(menu, { key: 'Home' })
  assert.equal(document.activeElement, job)
  fireEvent.keyDown(menu, { key: 'ArrowDown' })
  assert.equal(document.activeElement, one)
  fireEvent.keyDown(menu, { key: 'End' })
  assert.equal(document.activeElement, two)
  fireEvent.keyDown(menu, { key: 'ArrowDown' })
  assert.equal(document.activeElement, job)
  fireEvent.keyDown(menu, { key: 'ArrowUp' })
  assert.equal(document.activeElement, two)
  fireEvent.keyDown(menu, { key: ' ' })
  assert.deepEqual(opened, { agentId: 'rosie', threadId: 'supplier-two', label: 'Supplier Two' })
})

test('anchored menu clamps inward and chooses above or below from viewport space', () => {
  assert.deepEqual(
    focusedJobChatMenuPosition(
      { left: 4, right: 48, top: 20, bottom: 64 },
      { width: 320, height: 480 },
      3,
    ),
    { left: 8, width: 288, maxHeight: 144, top: 70 },
  )
  assert.deepEqual(
    focusedJobChatMenuPosition(
      { left: 268, right: 312, top: 420, bottom: 464 },
      { width: 320, height: 480 },
      3,
    ),
    { left: 24, width: 288, maxHeight: 144, bottom: 66 },
  )
  assert.equal(
    focusedJobChatMenuPosition(
      { left: 268, right: 312, top: -60, bottom: -16 },
      { width: 320, height: 480 },
      3,
    ),
    null,
  )
  assert.equal(
    focusedJobChatMenuPosition(
      { left: 268, right: 312, top: -44, bottom: 0 },
      { width: 320, height: 480 },
      3,
    ),
    null,
  )
  assert.equal(
    focusedJobChatMenuPosition(
      { left: 268, right: 312, top: 480, bottom: 524 },
      { width: 320, height: 480 },
      3,
    ),
    null,
  )
  assert.equal(
    focusedJobChatMenuPosition(
      { left: 268, right: 312, top: 496, bottom: 540 },
      { width: 320, height: 480 },
      3,
    ),
    null,
  )
  assert.deepEqual(
    focusedJobChatMenuPosition(
      { left: 268, right: 312, top: -43, bottom: 1 },
      { width: 320, height: 480 },
      3,
    ),
    { left: 24, width: 288, maxHeight: 144, top: 14 },
  )
  assert.deepEqual(
    focusedJobChatMenuPosition(
      { left: 268, right: 312, top: -36, bottom: 8 },
      { width: 320, height: 480 },
      3,
    ),
    { left: 24, width: 288, maxHeight: 144, top: 14 },
  )
  assert.deepEqual(
    focusedJobChatMenuPosition(
      { left: 268, right: 312, top: 479, bottom: 523 },
      { width: 320, height: 480 },
      3,
    ),
    { left: 24, width: 288, maxHeight: 144, bottom: 14 },
  )
  assert.deepEqual(
    focusedJobChatMenuPosition(
      { left: 268, right: 312, top: 472, bottom: 516 },
      { width: 320, height: 480 },
      3,
    ),
    { left: 24, width: 288, maxHeight: 144, bottom: 14 },
  )
  assert.deepEqual(
    focusedJobChatMenuPosition(
      { left: -20, right: 24, top: -16, bottom: 28 },
      { width: 320, height: 480 },
      3,
    ),
    { left: 8, width: 288, maxHeight: 144, top: 34 },
  )
  assert.deepEqual(
    focusedJobChatMenuPosition(
      { left: 300, right: 344, top: 460, bottom: 504 },
      { width: 320, height: 480 },
      3,
    ),
    { left: 24, width: 288, maxHeight: 144, bottom: 26 },
  )

  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 480 })
  const view = render(
    <FocusedJobHeader request={request('Patio')} mobile status={status} preview={preview} />,
  )
  const trigger = view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' })
  trigger.getBoundingClientRect = () => ({
    left: 268, right: 312, top: 420, bottom: 464, width: 44, height: 44,
    x: 268, y: 420, toJSON: () => ({}),
  })
  fireEvent.click(trigger)
  const menu = view.getByRole('menu', { name: 'Rosie chats for JR-27' })
  assert.equal(menu.style.left, '24px')
  assert.equal(menu.style.width, '288px')
  assert.equal(menu.style.bottom, '66px')
  assert.equal(menu.style.top, '')
  assert.equal(menu.style.maxHeight, '56px')
})

test('captured scroll and resize dismiss fully offscreen anchors without refocusing them or leaving listeners', () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 480 })
  const view = render(
    <FocusedJobHeader request={request('Patio')} mobile status={status} preview={preview} />,
  )
  const trigger = view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' })
  let box = { left: 268, right: 312, top: 20, bottom: 64 }
  let measurements = 0
  trigger.getBoundingClientRect = () => {
    measurements++
    return {
      ...box,
      width: 44,
      height: 44,
      x: box.left,
      y: box.top,
      toJSON: () => ({}),
    }
  }

  fireEvent.click(trigger)
  const menu = view.getByRole('menu', { name: 'Rosie chats for JR-27' })
  const host = document.querySelector('[data-focused-job-chat-portal-host]')
  assert.ok(host)
  for (const partial of [
    { box: { left: 268, right: 312, top: -43, bottom: 1 }, edge: 'top' as const },
    { box: { left: 268, right: 312, top: -36, bottom: 8 }, edge: 'top' as const },
    { box: { left: 268, right: 312, top: 479, bottom: 523 }, edge: 'bottom' as const },
    { box: { left: 268, right: 312, top: 472, bottom: 516 }, edge: 'bottom' as const },
  ]) {
    box = partial.box
    fireEvent.scroll(window)
    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
    assert.equal(view.getByRole('menu', { name: 'Rosie chats for JR-27' }), menu)
    assert.equal(document.querySelector('[data-focused-job-chat-portal-host]'), host)
    assert.equal(partial.edge === 'top' ? menu.style.top : menu.style.bottom, '14px')
    assert.equal(menu.style.left, '24px')
    assert.equal(menu.style.width, '288px')
  }

  box = { left: 268, right: 312, top: -60, bottom: -16 }
  fireEvent.scroll(window)
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  assert.equal(view.queryByRole('menu', { name: 'Rosie chats for JR-27' }), null)
  assert.equal(document.querySelector('[data-focused-job-chat-portal-host]'), null)
  assert.notEqual(document.activeElement, trigger)
  const afterAboveDismiss = measurements
  fireEvent.scroll(window)
  fireEvent.resize(window)
  assert.equal(measurements, afterAboveDismiss)

  box = { left: 268, right: 312, top: 20, bottom: 64 }
  fireEvent.click(trigger)
  assert.ok(view.getByRole('menu', { name: 'Rosie chats for JR-27' }))
  box = { left: 268, right: 312, top: 496, bottom: 540 }
  fireEvent.resize(window)
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  assert.equal(view.queryByRole('menu', { name: 'Rosie chats for JR-27' }), null)
  assert.equal(document.querySelector('[data-focused-job-chat-portal-host]'), null)
  assert.notEqual(document.activeElement, trigger)
  const afterBelowDismiss = measurements
  fireEvent.scroll(window)
  fireEvent.resize(window)
  assert.equal(measurements, afterBelowDismiss)
})

test('exact zero-visible-pixel boundaries dismiss while one visible pixel remains eligible', () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 480 })
  const view = render(
    <FocusedJobHeader request={request('Patio')} mobile status={status} preview={preview} />,
  )
  const trigger = view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' })
  let box = { left: 268, right: 312, top: -43, bottom: 1 }
  trigger.getBoundingClientRect = () => ({
    ...box,
    width: 44,
    height: 44,
    x: box.left,
    y: box.top,
    toJSON: () => ({}),
  })

  fireEvent.click(trigger)
  assert.equal(trigger.getAttribute('aria-expanded'), 'true')
  box = { left: 268, right: 312, top: -44, bottom: 0 }
  fireEvent.scroll(window)
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  assert.equal(document.querySelector('[data-focused-job-chat-portal-host]'), null)

  box = { left: 268, right: 312, top: 479, bottom: 523 }
  fireEvent.click(trigger)
  assert.equal(trigger.getAttribute('aria-expanded'), 'true')
  box = { left: 268, right: 312, top: 480, bottom: 524 }
  fireEvent.resize(window)
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  assert.equal(document.querySelector('[data-focused-job-chat-portal-host]'), null)
})

test('same-mounted supplier refresh updates and clamps the live menu without replacing its portal host', () => {
  const supplier = (supplierId: number, name: string, rosieThreadId: string) => ({
    supplierId,
    name,
    lpsPartner: true,
    availabilityRequests: [],
    rosieThreadId,
  })
  const refreshed = (supplierLinks: JobRequestRow['supplierLinks']) => {
    const next = request('Patio')
    next.supplierLinks = supplierLinks
    return next
  }
  const a = supplier(1, 'Supplier A', 'supplier-a')
  const b = supplier(2, 'Supplier B', 'supplier-b')
  const c = supplier(3, 'Supplier C', 'supplier-c')
  const props = { mobile: true, status, preview }
  const view = render(<FocusedJobHeader {...props} request={refreshed([a])} />)
  const trigger = view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' })
  fireEvent.click(trigger)
  const host = document.querySelector<HTMLElement>('[data-focused-job-chat-portal-host]')
  const surface = view.getByRole('menu', { name: 'Rosie chats for JR-27' })
  assert.ok(host)
  assert.equal(document.activeElement, view.getByRole('menuitem', { name: 'Job chat · JR-27' }))

  view.rerender(<FocusedJobHeader {...props} request={refreshed([a, b, c])} />)
  assert.equal(document.querySelector('[data-focused-job-chat-portal-host]'), host)
  assert.equal(view.getByRole('menu', { name: 'Rosie chats for JR-27' }), surface)
  assert.equal(host.isConnected, true)
  assert.equal(trigger.getAttribute('aria-expanded'), 'true')
  assert.deepEqual(view.getAllByRole('menuitem').map((item) => item.textContent?.trim()), [
    'Job chat · JR-27',
    'Supplier chat · Supplier A',
    'Supplier chat · Supplier B',
    'Supplier chat · Supplier C',
  ])
  assert.equal(document.activeElement, view.getByRole('menuitem', { name: 'Job chat · JR-27' }))

  act(() => view.getByRole('menuitem', { name: 'Supplier chat · Supplier C' }).focus())
  view.rerender(<FocusedJobHeader {...props} request={refreshed([
    a,
    supplier(4, 'Duplicate A', ' supplier-a '),
    b,
  ])} />)
  assert.equal(document.querySelector('[data-focused-job-chat-portal-host]'), host)
  assert.equal(view.getByRole('menu', { name: 'Rosie chats for JR-27' }), surface)
  assert.equal(trigger.getAttribute('aria-expanded'), 'true')
  assert.deepEqual(view.getAllByRole('menuitem').map((item) => item.textContent?.trim()), [
    'Job chat · JR-27',
    'Supplier chat · Supplier A',
    'Supplier chat · Supplier B',
  ])
  assert.equal(document.activeElement, view.getByRole('menuitem', { name: 'Supplier chat · Supplier B' }))

  view.rerender(<FocusedJobHeader {...props} request={refreshed([])} />)
  assert.equal(document.querySelector('[data-focused-job-chat-portal-host]'), host)
  assert.equal(view.getByRole('menu', { name: 'Rosie chats for JR-27' }), surface)
  assert.equal(trigger.getAttribute('aria-expanded'), 'true')
  assert.deepEqual(view.getAllByRole('menuitem').map((item) => item.textContent?.trim()), ['Job chat · JR-27'])
  assert.equal(document.activeElement, view.getByRole('menuitem', { name: 'Job chat · JR-27' }))

  fireEvent.click(trigger)
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  assert.equal(view.queryByRole('menu', { name: 'Rosie chats for JR-27' }), null)
  assert.equal(host.isConnected, false)
  assert.equal(document.querySelector('[data-focused-job-chat-portal-host]'), null)
})

test('outside pointer, Escape, Tab, repeated open and breakpoint cleanup follow menu dismissal semantics', async () => {
  const props = { request: request('Patio'), status, preview }
  const view = render(<FocusedJobHeader {...props} mobile />)
  const trigger = view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' })

  fireEvent.click(trigger)
  let menu = view.getByRole('menu', { name: 'Rosie chats for JR-27' })
  let globalEscapes = 0
  const globalEscape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') globalEscapes++ }
  document.addEventListener('keydown', globalEscape)
  fireEvent.keyDown(menu, { key: 'Escape' })
  document.removeEventListener('keydown', globalEscape)
  assert.equal(globalEscapes, 0)
  assert.equal(view.queryByRole('menu', { name: 'Rosie chats for JR-27' }), null)
  assert.equal(document.activeElement, trigger)

  fireEvent.click(trigger)
  fireEvent.pointerDown(document.body)
  assert.equal(view.queryByRole('menu', { name: 'Rosie chats for JR-27' }), null)
  assert.equal(document.activeElement, trigger)

  fireEvent.click(trigger)
  menu = view.getByRole('menu', { name: 'Rosie chats for JR-27' })
  fireEvent.keyDown(menu, { key: 'Tab' })
  assert.equal(view.queryByRole('menu', { name: 'Rosie chats for JR-27' }), null)
  assert.notEqual(document.activeElement, trigger)

  fireEvent.click(trigger)
  assert.equal(document.activeElement, view.getByRole('menuitem', { name: 'Job chat · JR-27' }))
  view.rerender(<FocusedJobHeader {...props} mobile={false} />)
  assert.equal(view.queryByRole('menu', { name: 'Rosie chats for JR-27' }), null)
  assert.equal(document.querySelector('[data-focused-job-chat-portal-host]'), null)
  assert.ok(view.getByRole('button', { name: 'Chat with Rosie' }))
  view.rerender(<FocusedJobHeader {...props} mobile />)
  assert.equal(view.queryByRole('menu', { name: 'Rosie chats for JR-27' }), null)
  await userEvent.setup({ document }).click(view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' }))
  assert.ok(view.getByRole('menu', { name: 'Rosie chats for JR-27' }))
})

test('Tab and Shift+Tab dismiss the body-portal menu into the trigger’s document-order neighbours', () => {
  const view = render(
    <div>
      <button type="button">Before Rosie</button>
      <FocusedJobHeader request={request('Patio')} mobile status={status} preview={preview} />
      <button type="button">After Rosie</button>
    </div>,
  )
  const trigger = view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' })
  fireEvent.click(trigger)
  let menu = view.getByRole('menu', { name: 'Rosie chats for JR-27' })
  fireEvent.keyDown(menu, { key: 'Tab' })
  assert.equal(document.activeElement, view.getByRole('button', { name: 'After Rosie' }))
  assert.equal(view.queryByRole('menu', { name: 'Rosie chats for JR-27' }), null)

  fireEvent.click(trigger)
  menu = view.getByRole('menu', { name: 'Rosie chats for JR-27' })
  fireEvent.keyDown(menu, { key: 'Tab', shiftKey: true })
  assert.equal(document.activeElement, view.getByRole('button', { name: 'Edit job name for JR-27' }))
  assert.equal(view.queryByRole('menu', { name: 'Rosie chats for JR-27' }), null)
})

test('tall anchored menu scrolls and End plus Enter reaches the last 44px supplier', () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 480 })
  const linked = request('Patio')
  linked.supplierLinks = Array.from({ length: 48 }, (_, index) => ({
    supplierId: index + 1,
    name: `Supplier ${String(index + 1).padStart(2, '0')}`,
    lpsPartner: true,
    availabilityRequests: [],
    rosieThreadId: `supplier-${index + 1}`,
  }))
  let opened: FocusedJobChatTarget | null = null
  const view = render(
    <FocusedJobHeader request={linked} mobile status={status} preview={preview}
      onOpenRosie={(target) => { opened = target }} />,
  )
  const trigger = view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' })
  trigger.getBoundingClientRect = () => ({
    left: 338, right: 382, top: 200, bottom: 244, width: 44, height: 44,
    x: 338, y: 200, toJSON: () => ({}),
  })
  fireEvent.click(trigger)
  const menu = view.getByRole('menu', { name: 'Rosie chats for JR-27' })
  assert.match(menu.className, /overflow-y-auto/)
  assert.equal(menu.style.maxHeight, '222px')
  assert.equal(view.getAllByRole('menuitem').length, 49)
  fireEvent.keyDown(menu, { key: 'End' })
  const last = view.getByRole('menuitem', { name: 'Supplier chat · Supplier 48' })
  assert.match(last.className, /min-h-11/)
  assert.equal(document.activeElement, last)
  fireEvent.keyDown(menu, { key: 'Enter' })
  assert.deepEqual(opened, { agentId: 'rosie', threadId: 'supplier-48', label: 'Supplier 48' })
})

test('desktop branch keeps labelled avatar/direct route and uses the structured one-line identity with install metadata', () => {
  const longName = 'Long Landscape | Courtyard Installation'
  let opened: FocusedJobChatTarget | null = null
  const view = render(
    <FocusedJobHeader request={{ ...request(longName), expectedInstallDate: "2026-08-30" }} mobile={false} status={status} preview={preview} onOpenRosie={(target) => { opened = target }} />,
  )
  assert.ok(view.container.querySelector('[data-focused-job-header="desktop"]'))
  assert.equal(view.container.querySelector('[data-focused-job-header="mobile"]'), null)
  const identity = view.container.querySelector<HTMLElement>('[data-desktop-job-identity]')
  assert.ok(identity)
  assert.equal(identity.textContent, `Long Landscape | ${longName} | Jamie Long`)
  assert.match(identity.firstElementChild?.className ?? '', /text-ellipsis/)
  assert.match(identity.firstElementChild?.className ?? '', /whitespace-nowrap/)
  assert.equal(view.getByRole('button', { name: 'Edit job name for JR-27' }).textContent, longName)
  fireEvent.click(view.getByRole('button', { name: 'Chat with Rosie' }))
  assert.deepEqual(opened, { agentId: 'rosie', threadId: 'jr-27', label: longName })
  assert.equal(view.queryByRole('menu', { name: 'Rosie chats for JR-27' }), null)
  assert.equal(view.container.querySelectorAll('img').length, 1)
  assert.equal(view.getByText('Sun, 08/30').textContent, 'Sun, 08/30')
  assert.ok(view.getByTestId('status'))
  assert.ok(view.getByTestId('preview'))
})
