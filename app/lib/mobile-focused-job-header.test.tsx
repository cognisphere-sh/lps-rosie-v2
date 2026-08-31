import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JSDOM } from 'jsdom'

import {
  FocusedJobHeader,
  focusedJobChatChoices,
  formatEstimatedProjectDate,
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
})

afterEach(() => {
  cleanup()
  dom.window.close()
})

function request(name: string | null): JobRequestRow {
  return {
    id: 27,
    name,
    status: 'sourcing',
    customer: {
      id: 4,
      name: 'Jamie Long',
      company: 'Long Landscape',
      email: null,
      phone: null,
      rosieThreadId: null,
    },
    billing: { address: null, city: null, state: null, zip: null },
    shipping: { address: null, city: 'Austin', state: 'TX', zip: null },
    customerNotes: null,
    notes: [],
    externalNotes: null,
    sourcingNotes: null,
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
    <FocusedJobHeader request={request(longName)} mobile projectDate={null} status={status} preview={preview} />,
  )
  const header = view.container.querySelector<HTMLElement>('[data-focused-job-header="mobile"]')
  assert.ok(header)
  assert.equal(view.queryByText(longName)?.textContent, longName)
  const heading = view.getByRole('heading', { level: 1 })
  assert.match(heading.className, /break-words/)
  assert.match(heading.className, /\[overflow-wrap:anywhere\]/)
  assert.doesNotMatch(heading.className, /truncate|text-ellipsis|overflow-hidden|whitespace-nowrap/)
  assert.match(heading.parentElement?.className ?? '', /min-w-0/)
  assert.equal(view.getByTestId('preview').textContent, 'Long Landscape · Austin, TX')
})

test('mobile project date accepts only a real YYYY-MM-DD calendar day and is timezone-independent', () => {
  assert.equal(formatEstimatedProjectDate('2026-08-30'), '8/30/26')
  assert.equal(formatEstimatedProjectDate('2024-02-29'), '2/29/24')
  assert.equal(formatEstimatedProjectDate('2000-02-29'), '2/29/00')
  for (const invalid of [
    '2025-02-29',
    '1900-02-29',
    '2026-02-30',
    '2026-00-10',
    '2026-13-10',
    '2026-08-30T00:00:00Z',
    '2026-01-01T00:30:00+14:00',
    ' 2026-08-30',
    '2026-08-30 ',
    'August 30, 2026',
    '',
    0,
    null,
    undefined,
  ]) assert.equal(formatEstimatedProjectDate(invalid), null, String(invalid))

  const dated = render(
    <FocusedJobHeader request={request('Patio')} mobile projectDate="2026-08-30" status={status} preview={preview} />,
  )
  assert.equal(dated.getByText('EPD: 8/30/26').textContent, 'EPD: 8/30/26')
  dated.unmount()

  const missing = render(
    <FocusedJobHeader request={request('Patio')} mobile projectDate={null} status={status} preview={preview} />,
  )
  assert.equal(missing.queryByText(/EPD:/), null)
  assert.doesNotMatch(missing.container.textContent ?? '', /Created|Updated|8\/29\/26|8\/31\/26/)
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
    'inline-flex flex-none items-stretch overflow-hidden rounded-full border border-lps-edge bg-card text-[10.5px] font-semibold')
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
    <FocusedJobHeader request={linked} mobile projectDate={null} status={status} preview={preview}
      onOpenRosie={(target) => { opened = target }} />,
  )
  fireEvent.click(view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' }))
  assert.equal(view.queryByRole('button', { name: 'Supplier chat · Different duplicate label' }), null)
  assert.equal(view.queryByRole('button', { name: 'Supplier chat · Blank' }), null)
  assert.equal(view.queryByRole('button', { name: 'Supplier chat · Job collision' }), null)
  fireEvent.click(view.getByRole('button', { name: 'Supplier chat · First label' }))
  assert.deepEqual(opened, { agentId: 'rosie', threadId: 'supplier-shared', label: 'First label' })
})

test('mobile 44px no-tooltip icon opens exact Job-first and multiple supplier chat choices without ARs', () => {
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
    <FocusedJobHeader
      request={linked}
      mobile
      projectDate={null}
      status={status}
      preview={preview}
      onOpenRosie={(target) => { opened = target }}
    />,
  )
  const trigger = view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' })
  assert.match(trigger.className, /size-11/)
  assert.equal(trigger.getAttribute('title'), null)
  assert.equal(trigger.textContent, '')
  assert.equal(trigger.getAttribute('aria-haspopup'), 'dialog')
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  assert.equal(view.container.querySelector('[data-focused-job-header="mobile"] img'), null)

  fireEvent.click(trigger)
  const dialog = view.getByRole('dialog', { name: 'Choose a chat' })
  assert.equal(dialog.getAttribute('aria-modal'), 'true')
  assert.equal(trigger.getAttribute('aria-expanded'), 'true')
  assert.equal(trigger.getAttribute('aria-controls'), dialog.id)
  const job = view.getByRole('button', { name: 'Job chat · JR-27' })
  const supplierOne = view.getByRole('button', { name: 'Supplier chat · Hill Country Native Plant Supply' })
  const supplierTwo = view.getByRole('button', { name: 'Supplier chat · Oak & Stone Nursery' })
  assert.deepEqual(
    [job, supplierOne, supplierTwo].map((option) => option.textContent?.trim()),
    ['Job chat · JR-27', 'Supplier chat · Hill Country Native Plant Supply', 'Supplier chat · Oak & Stone Nursery'],
  )
  assert.equal(document.activeElement, job)
  assert.equal(view.queryByRole('button', { name: /AR-803|AR-804/ }), null)

  fireEvent.click(supplierTwo)
  assert.deepEqual(opened, {
    agentId: 'rosie',
    threadId: 'supplier-oak-stone-nursery',
    label: 'Oak & Stone Nursery',
  })
  assert.equal(view.queryByRole('dialog', { name: 'Choose a chat' }), null)
  assert.equal(document.querySelector('[data-focused-job-chat-portal-host]'), null)
  assert.equal(document.body.style.overflow, '')
  assert.equal(window.location.href, 'http://localhost/jobs?jr=27')
})

test('reflected inert property restores exact legacy/absent attributes on Close, select, cross and unmount', () => {
  const reflectedLegacy = document.createElement('div')
  const reflectedAbsent = document.createElement('div')
  const attributeOnly = document.createElement('div')
  const reflectInert = (element: HTMLElement) => Object.defineProperty(element, 'inert', {
    configurable: true,
    get: () => element.hasAttribute('inert'),
    set: (value: boolean) => {
      if (value) element.setAttribute('inert', '')
      else element.removeAttribute('inert')
    },
  })
  reflectInert(reflectedLegacy)
  reflectInert(reflectedAbsent)
  reflectedLegacy.setAttribute('inert', 'legacy-value')
  reflectedLegacy.setAttribute('aria-hidden', 'false')
  attributeOnly.setAttribute('inert', 'attribute-only')
  attributeOnly.setAttribute('aria-hidden', '')
  document.body.append(reflectedLegacy, reflectedAbsent, attributeOnly)
  document.body.style.overflow = 'clip'

  const assertIsolated = () => {
    const host = document.querySelector<HTMLElement>('[data-focused-job-chat-portal-host]')
    assert.ok(host)
    assert.equal(host.hasAttribute('inert'), false)
    assert.equal(host.hasAttribute('aria-hidden'), false)
    for (const sibling of [...document.body.children].filter((child) => child !== host) as HTMLElement[]) {
      assert.equal(sibling.getAttribute('inert'), '')
      assert.equal((sibling as HTMLElement & { inert: boolean }).inert, true)
      assert.equal(sibling.getAttribute('aria-hidden'), 'true')
    }
    assert.equal(document.body.style.overflow, 'hidden')
  }
  const assertRestored = () => {
    assert.equal(document.querySelector('[data-focused-job-chat-portal-host]'), null)
    assert.equal(document.body.style.overflow, 'clip')
    assert.equal(reflectedLegacy.getAttribute('inert'), 'legacy-value')
    assert.equal((reflectedLegacy as HTMLElement & { inert: boolean }).inert, true)
    assert.equal(reflectedLegacy.getAttribute('aria-hidden'), 'false')
    assert.equal(reflectedAbsent.hasAttribute('inert'), false)
    assert.equal((reflectedAbsent as HTMLElement & { inert: boolean }).inert, false)
    assert.equal(reflectedAbsent.hasAttribute('aria-hidden'), false)
    assert.equal(attributeOnly.getAttribute('inert'), 'attribute-only')
    assert.equal('inert' in attributeOnly, false)
    assert.equal(attributeOnly.getAttribute('aria-hidden'), '')
  }
  const props = { request: request('Patio'), projectDate: null, status, preview }

  let view = render(<FocusedJobHeader {...props} mobile />)
  fireEvent.click(view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' }))
  assertIsolated()
  fireEvent.click(view.getByRole('button', { name: 'Close chat chooser' }))
  assertRestored()
  view.unmount()

  view = render(<FocusedJobHeader {...props} mobile onOpenRosie={() => undefined} />)
  fireEvent.click(view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' }))
  assertIsolated()
  fireEvent.click(view.getByRole('button', { name: 'Job chat · JR-27' }))
  assertRestored()
  view.unmount()

  view = render(<FocusedJobHeader {...props} mobile />)
  fireEvent.click(view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' }))
  assertIsolated()
  view.rerender(<FocusedJobHeader {...props} mobile={false} />)
  assertRestored()
  view.unmount()

  view = render(<FocusedJobHeader {...props} mobile />)
  fireEvent.click(view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' }))
  assertIsolated()
  view.unmount()
  assertRestored()
})

test('tall chooser bounds and scrolls options while the last 44px supplier stays focusable and routable', () => {
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
    <FocusedJobHeader request={linked} mobile projectDate={null} status={status} preview={preview}
      onOpenRosie={(target) => { opened = target }} />,
  )
  fireEvent.click(view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' }))
  const dialog = view.getByRole('dialog', { name: 'Choose a chat' })
  const header = view.getByText('Choose a chat').parentElement
  const options = document.querySelector<HTMLElement>('[data-focused-job-chat-options]')
  assert.ok(header)
  assert.ok(options)
  assert.match(dialog.className, /max-h-\[calc\(100dvh-1\.5rem\)\]/)
  assert.match(dialog.className, /flex-col/)
  assert.match(header.className, /sticky/)
  assert.match(header.className, /flex-none/)
  assert.match(options.className, /min-h-0/)
  assert.match(options.className, /overflow-y-auto/)
  assert.equal(options.querySelectorAll('button').length, 49)
  const last = view.getByRole('button', { name: 'Supplier chat · Supplier 48' })
  assert.match(last.className, /min-h-11/)
  last.focus()
  assert.equal(document.activeElement, last)
  fireEvent.click(last)
  assert.deepEqual(opened, { agentId: 'rosie', threadId: 'supplier-48', label: 'Supplier 48' })
  assert.equal(document.querySelector('[data-focused-job-chat-portal-host]'), null)
  assert.equal(document.body.style.overflow, '')
})

test('zero-supplier chooser supports keyboard opening/activation of the canonical Job chat without inventing another destination', async () => {
  let opened: FocusedJobChatTarget | null = null
  const view = render(
    <FocusedJobHeader
      request={request('Patio')}
      mobile
      projectDate={null}
      status={status}
      preview={preview}
      onOpenRosie={(target) => { opened = target }}
    />,
  )
  const user = userEvent.setup({ document })
  const trigger = view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' })
  trigger.focus()
  await user.keyboard('{Enter}')
  const dialog = view.getByRole('dialog', { name: 'Choose a chat' })
  assert.equal(dialog.querySelectorAll('button').length, 2) // Close + Job chat.
  assert.equal(view.queryByRole('button', { name: /Supplier chat/ }), null)
  assert.equal(document.activeElement, view.getByRole('button', { name: 'Job chat · JR-27' }))
  await user.keyboard('{Enter}')
  assert.deepEqual(opened, { agentId: 'rosie', threadId: 'jr-27', label: 'Patio' })
  assert.equal(document.querySelector('[data-focused-job-chat-portal-host]'), null)
  assert.equal(document.body.style.overflow, '')
})

test('chooser contains focus, dismisses predictably, returns focus, repeats, and unmounts at desktop', () => {
  const props = {
    request: request('Patio'),
    projectDate: null,
    status,
    preview,
  }
  const view = render(<FocusedJobHeader {...props} mobile />)
  const trigger = view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' })

  fireEvent.click(trigger)
  let dialog = view.getByRole('dialog', { name: 'Choose a chat' })
  let close = view.getByRole('button', { name: 'Close chat chooser' })
  let job = view.getByRole('button', { name: 'Job chat · JR-27' })
  assert.match(close.className, /size-11/)
  close.focus()
  fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
  assert.equal(document.activeElement, job)
  fireEvent.keyDown(dialog, { key: 'Tab' })
  assert.equal(document.activeElement, close)
  let globalEscapes = 0
  const globalEscape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') globalEscapes++ }
  document.addEventListener('keydown', globalEscape)
  fireEvent.keyDown(dialog, { key: 'Escape' })
  document.removeEventListener('keydown', globalEscape)
  assert.equal(globalEscapes, 0)
  assert.equal(view.queryByRole('dialog', { name: 'Choose a chat' }), null)
  assert.equal(document.querySelector('[data-focused-job-chat-portal-host]'), null)
  assert.equal(document.body.style.overflow, '')
  assert.equal(document.activeElement, trigger)

  fireEvent.click(trigger)
  assert.equal(document.activeElement, view.getByRole('button', { name: 'Job chat · JR-27' }))
  fireEvent.click(view.getByRole('button', { name: 'Close chat chooser' }))
  assert.equal(document.querySelector('[data-focused-job-chat-portal-host]'), null)
  assert.equal(document.body.style.overflow, '')
  assert.equal(document.activeElement, trigger)

  fireEvent.click(trigger)
  const backdrop = document.querySelector<HTMLElement>('[data-focused-job-chat-backdrop]')
  assert.ok(backdrop)
  fireEvent.pointerDown(backdrop)
  assert.equal(view.queryByRole('dialog', { name: 'Choose a chat' }), null)
  assert.equal(document.querySelector('[data-focused-job-chat-portal-host]'), null)
  assert.equal(document.body.style.overflow, '')
  assert.equal(document.activeElement, trigger)

  fireEvent.click(trigger)
  assert.ok(view.getByRole('dialog', { name: 'Choose a chat' }))
  view.rerender(<FocusedJobHeader {...props} mobile={false} />)
  assert.equal(view.queryByRole('dialog', { name: 'Choose a chat' }), null)
  assert.equal(document.querySelector('[data-focused-job-chat-portal-host]'), null)
  assert.equal(document.body.style.overflow, '')
  assert.equal(view.queryByRole('button', { name: 'Choose a Rosie chat for JR-27' }), null)
  assert.ok(view.getByText('Chat with Rosie'))
  view.rerender(<FocusedJobHeader {...props} mobile />)
  assert.equal(view.queryByRole('dialog', { name: 'Choose a chat' }), null)
  fireEvent.click(view.getByRole('button', { name: 'Choose a Rosie chat for JR-27' }))
  dialog = view.getByRole('dialog', { name: 'Choose a chat' })
  close = view.getByRole('button', { name: 'Close chat chooser' })
  job = view.getByRole('button', { name: 'Job chat · JR-27' })
  assert.ok(dialog && close && job)
})

test('desktop branch preserves the labelled avatar treatment, direct canonical route, truncating name and no EPD refinement', () => {
  const longName = 'Long Landscape | Courtyard Installation'
  let opened: FocusedJobChatTarget | null = null
  const view = render(
    <FocusedJobHeader request={request(longName)} mobile={false} projectDate="2026-08-30" status={status} preview={preview} onOpenRosie={(target) => { opened = target }} />,
  )
  assert.ok(view.container.querySelector('[data-focused-job-header="desktop"]'))
  assert.equal(view.container.querySelector('[data-focused-job-header="mobile"]'), null)
  assert.match(view.getByText(longName).className, /truncate/)
  fireEvent.click(view.getByRole('button', { name: 'Chat with Rosie' }))
  assert.deepEqual(opened, { agentId: 'rosie', threadId: 'jr-27', label: longName })
  assert.equal(view.queryByRole('dialog', { name: 'Choose a chat' }), null)
  assert.equal(view.container.querySelectorAll('img').length, 1)
  assert.equal(view.queryByText('EPD: 8/30/26'), null)
  assert.ok(view.getByTestId('status'))
  assert.ok(view.getByTestId('preview'))
})
