import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { afterEach, beforeEach } from 'node:test'
import React, { useEffect, useRef, useState } from 'react'
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JSDOM } from 'jsdom'

import { FocusedJobHeader, FocusedJobNameEditor, focusConnectedJobNameTrigger } from '../components/workspace/focused-job-header.tsx'
import { EditableText, EditableTextarea } from '../components/workspace/editable.tsx'
import { FocusedJobRecord } from '../components/workspace/focused-job-record.tsx'
import { FocusedJobsRailRow } from '../components/workspace/focused-jobs-rail.tsx'
import { DeleteRequestDialog, requestDeletionCounts } from '../components/workspace/request-delete.tsx'
import { StatusPill } from '../components/workspace/job-request.tsx'
import { Markdown } from '../components/workspace/chat-kit.tsx'
import { RequestCard } from '../components/workspace/request-list-card.tsx'
import {
  balancedHeaderGeometry,
  structuredJobIdentityLine,
} from './job-identity.ts'
import { jobInboxRowAriaLabel, orderJobInbox, type JobInboxRow } from './job-inbox.ts'
import type { JobRequestRow } from './rows.ts'
import { onOpenAvailabilityRequest } from './chat-bus.ts'

let dom: JSDOM
const originalFetch = globalThis.fetch

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/jobs?jr=19' })
  const win = dom.window
  Object.defineProperty(win.HTMLElement.prototype, 'attachEvent', { configurable: true, value() {} })
  Object.defineProperty(win.HTMLElement.prototype, 'detachEvent', { configurable: true, value() {} })
  for (const [key, value] of Object.entries({
    window: win,
    self: win,
    document: win.document,
    navigator: win.navigator,
    HTMLElement: win.HTMLElement,
    HTMLButtonElement: win.HTMLButtonElement,
    Node: win.Node,
    MouseEvent: win.MouseEvent,
    KeyboardEvent: win.KeyboardEvent,
    CustomEvent: win.CustomEvent,
    getComputedStyle: win.getComputedStyle,
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(callback, 0),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
})

afterEach(() => {
  cleanup()
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: originalFetch })
  dom.window.close()
})

function request(overrides: Partial<JobRequestRow> = {}): JobRequestRow {
  return {
    id: 19,
    name: 'Oak Grove Rd. planting',
    status: 'quoted',
    customer: {
      type: null,
      id: 4,
      name: 'Johnathan',
      company: 'Urban Landscape Group',
      email: 'johnathan@example.com',
      phone: '+1 512 555 0100',
      rosieThreadId: 'customer-johnathan',
    },
    billing: { address: '401 Billing Ave', city: 'Austin', state: 'TX', zip: '78701' },
    shipping: { address: '16202 Oak Grove Rd.', city: 'Buda', state: 'TX', zip: '78610' },
    noteFromCustomer: 'Use the south entrance.',
    notes: [{ kind: 'customer', stamp: '2026-09-01 09:00', text: 'Use the south entrance.' }],
    noteForCustomer: 'Share delivery updates.',
    noteInternal: 'Call before loading.',
    itemCount: 0,
    statusCounts: { pending: 0, available: 0, substituted: 0, unavailable: 0 },
    lineTotal: 0,
    supplierLinks: [],
    items: [],
    createdAt: '2026-09-01T12:00:00Z',
    updatedAt: '2026-09-01T13:00:00Z',
    ...overrides,
  }
}

const status = <span data-testid="sales-status">Sourcing</span>

test('collapsed, expanded and mobile job cards show adjacent created/install dates without fulfillment', () => {
  for (const [mobile, expanded] of [[false, false], [false, true], [true, false], [true, true]]) {
    const view = render(
      <RequestCard request={request({ expectedInstallDate: '2026-09-20', fulfillmentMethod: 'delivery' })}
        expanded={expanded} mobile={mobile} selected={new Set()} version={0}
        onToggle={() => {}} onSelect={() => {}} onDelete={() => {}} onDeleteItem={() => {}} onSaved={() => {}} />,
    )
    const head = view.container.querySelector('[data-request-card-head]')!
    assert.deepEqual([...head.querySelectorAll('[data-job-metadata] dd')].map((node) => node.textContent), ['Sun, 09/20'])
    assert.ok(head.querySelector('[data-job-metadata]')?.parentElement?.querySelector('a[href="/jobs?jr=19"]'))
    assert.equal(view.container.querySelector('[data-compact-job-details]'), null)
    view.unmount()
  }
})

const sourcingMarkdown = '**<u>Austin Plant Supply</u>**\n$105 · 15 G · Qty 12 · [AR-42](ar:42) · Pending\n\n**<u>Acosta</u>**\n$98 · Qty 20 · Completed · Selected by Chris'
const sourcingItem = {
  id: 51, name: 'Live Oak', size: '15 G', quantity: 12, availableQuantity: null,
  unitPrice: 105, total: 1260, status: 'pending', notes: [], noteFromCustomer: null,
  noteForCustomer: '**Customer note stays plain**', noteInternal: sourcingMarkdown, updatedAt: null,
}

for (const mobile of [false, true]) {
  test(`focused Job ${mobile ? 'mobile' : 'desktop'} renders item and job sourcing Markdown with usable AR links`, () => {
    const opened: number[] = []
    const stop = onOpenAvailabilityRequest((id) => opened.push(id))
    const view = render(<FocusedJobRecord request={request({ items: [sourcingItem], itemCount: 1, noteInternal: sourcingMarkdown })}
      mobile={mobile} version={0} onSaved={() => {}} />)
    const table = view.container.querySelector<HTMLElement>('[data-request-line-table]')!
    assert.equal(table.querySelector('strong > u'), null)
    const preview = within(table).getByRole('button', { name: /Edit internal note for Live Oak/ })
    assert.equal(preview.title, sourcingMarkdown)
    assert.ok(preview.querySelector('.truncate'))
    fireEvent.click(preview)
    assert.deepEqual([...table.querySelectorAll('strong > u')].map((node) => node.textContent), ['Austin Plant Supply', 'Acosta'])
    assert.equal(table.querySelectorAll('hr').length, 0)
    assert.equal(table.querySelector('table'), null)
    assert.ok(within(table).getByText('**Customer note stays plain**'))
    const ar = within(table).getByRole('button', { name: 'AR-42' })
    assert.equal(ar.parentElement?.closest('button'), null)
    fireEvent.click(ar)
    assert.deepEqual(opened, [42])
    assert.ok(table.querySelector('.lps-pop'))

    fireEvent.click(view.getByRole('button', { name: 'Job details & notes' }))
    const details = view.container.querySelector<HTMLElement>('[data-compact-job-details]')!
    assert.equal(details.querySelectorAll('strong > u').length, 2)
    assert.equal(details.querySelectorAll('hr').length, 0)
    assert.ok(within(details).getByRole('button', { name: 'Edit job internal note' }))
    stop()
  })
}

test('job and item sourcing editors preserve raw Markdown and save it through their own fields', async () => {
  const writes: Array<{ table: string; id: number; column: string; value: string }> = []
  globalThis.fetch = async (_input, init) => {
    writes.push(JSON.parse(String(init?.body)))
    return Response.json({ ok: true })
  }
  const user = userEvent.setup({ document })
  let saved = 0
  const initial = request({ items: [sourcingItem], itemCount: 1, noteInternal: sourcingMarkdown })
  const view = render(<FocusedJobRecord request={initial} mobile={false} version={0} onSaved={() => { saved++ }} />)
  await user.click(view.getByRole('button', { name: 'Job details & notes' }))
  await user.click(view.getByRole('button', { name: 'Edit job internal note' }))
  const jobInput = view.getByRole('textbox', { name: 'Edit job internal note' }) as HTMLTextAreaElement
  assert.equal(jobInput.value, sourcingMarkdown)
  await user.keyboard('{Escape}')
  assert.equal(writes.length, 0)
  await user.click(view.getByRole('button', { name: 'Edit job internal note' }))
  const edited = '**<u>Austin Plant Supply</u>**\n$110 · Qty 15 · Follow-up'
  const editor = view.getByRole('textbox', { name: 'Edit job internal note' })
  await user.clear(editor)
  await user.type(editor, edited)
  await user.keyboard('{Control>}{Enter}{/Control}')
  await waitFor(() => assert.equal(saved, 1))
  assert.deepEqual(writes[0], { table: 'job_requests', id: 19, column: 'note_internal', value: edited })
  view.rerender(<FocusedJobRecord request={{ ...initial, noteInternal: edited }} mobile={false} version={0} onSaved={() => { saved++ }} />)
  const details = view.container.querySelector<HTMLElement>('[data-compact-job-details]')!
  assert.equal(details.querySelector('strong > u')?.textContent, 'Austin Plant Supply')
  assert.ok(within(details).getByText('$110 · Qty 15 · Follow-up'))

  await user.click(view.getByRole('button', { name: /Edit internal note for Live Oak/ }))
  const popover = view.container.querySelector<HTMLElement>('.lps-pop')!
  assert.equal(popover.querySelectorAll('strong > u').length, 2)
  assert.equal(popover.querySelectorAll('hr').length, 0)
  await user.click(within(popover).getByRole('button', { name: /Edit internal note for Live Oak/ }))
  const itemInput = within(popover).getByRole('textbox', { name: /Edit internal note for Live Oak/ }) as HTMLTextAreaElement
  assert.equal(itemInput.value, sourcingMarkdown)
  await user.clear(itemInput)
  await user.type(itemInput, edited)
  fireEvent.blur(itemInput)
  await waitFor(() => assert.equal(saved, 2))
  assert.deepEqual(writes[1], { table: 'job_request_items', id: 51, column: 'note_internal', value: edited })
})

test('Markdown renders separators and safe underline without executing arbitrary HTML or formatting fenced code', () => {
  const view = render(<Markdown text={'**<u>Supplier</u>**\n----\n<u onclick="alert(1)">Unsafe</u>\n<img src=x onerror="alert(1)">\n[unsafe](javascript:alert(1))\n```text\n**<u>Literal</u>**\n----\n```'} />)
  assert.equal(view.container.querySelectorAll('strong > u').length, 1)
  assert.equal(view.container.querySelectorAll('hr').length, 1)
  assert.equal(view.container.querySelector('img, script, [onclick], [onerror], a[href^="javascript:"]'), null)
  assert.match(view.container.textContent ?? '', /<u onclick="alert\(1\)">Unsafe<\/u>/)
  assert.equal(view.container.querySelector('pre code')?.textContent, '**<u>Literal</u>**\n----')
})

test('structured identity is exact nonblank Company | Job/Site | Contact values with honest omission', () => {
  const exact = structuredJobIdentityLine(request())
  assert.equal(exact, 'Urban Landscape Group | Oak Grove Rd. planting | Johnathan')
  assert.doesNotMatch(exact, /(?:Contractor|Company|Job|Contact)\s*:/i)
  assert.equal(structuredJobIdentityLine(request({
    id: 34,
    name: 'Ox Eye Phase II',
    customer: { ...request().customer!, company: 'Land Water Light', name: 'Dior Goodwin' },
  })), 'Land Water Light | Ox Eye Phase II | Dior Goodwin')
  assert.equal(structuredJobIdentityLine(request({
    id: 36,
    name: '803 Redbud',
    customer: { ...request().customer!, company: 'Outdoor Renovations', name: 'Kyle Stoutenger' },
  })), 'Outdoor Renovations | 803 Redbud | Kyle Stoutenger')

  const blank = request({ name: '  ' })
  assert.equal(structuredJobIdentityLine(blank), 'Urban Landscape Group | Johnathan')
  const hostile: JobRequestRow = {
    ...blank,
    customer: { ...blank.customer!, company: '  ', name: ' Johnathan ' },
    shipping: { address: 'must not infer site', city: 'Buda', state: 'TX', zip: '78610' },
    createdAt: '2026-09-01T12:00:00Z',
    updatedAt: '2026-09-01T13:00:00Z',
    billing: { address: 'must never become identity', city: 'Austin', state: 'TX', zip: null },
    noteInternal: 'Install date 9/8; pickup; PO-44',
  }
  assert.equal(structuredJobIdentityLine(hostile), 'Johnathan')
  assert.equal(structuredJobIdentityLine({ ...blank, customer: null }), '')
})

test('full job names keep the customer or company prefix once in headers and inbox labels', () => {
  for (const name of ['Urban Landscape Group | Oak Grove', 'Johnathan | 12 Live Oaks', 'Urban Landscape Group']) {
    const value = request({ name })
    assert.equal(structuredJobIdentityLine(value), name)
    const inbox: JobInboxRow = {
      id: value.id, name, status: value.status, customer: null,
      customerCompany: value.customer!.company, customerContact: value.customer!.name,
      createdAt: null, updatedAt: null, thread: null,
    }
    const aria = jobInboxRowAriaLabel(orderJobInbox([inbox])[0], 'Quote')
    assert.equal(aria.split(name).length - 1, 1)
    for (const mobile of [false, true]) {
      const view = render(<FocusedJobHeader request={value} mobile={mobile} status={status} preview={null} />)
      assert.equal(view.getByRole('button', { name: 'Edit job name for JR-19' }).textContent, name)
      assert.equal(view.container.textContent!.split(name).length - 1, 1)
      if (mobile) assert.equal(view.container.querySelector('[data-mobile-job-identity]'), null)
      else assert.equal(view.container.querySelector('[data-desktop-job-identity]')?.textContent, name)
      view.unmount()
    }
    const card = render(<RequestCard request={value} expanded selected={new Set()} version={0}
      onToggle={() => {}} onSelect={() => {}} onDelete={() => {}} onDeleteItem={() => {}} onSaved={() => {}} mobile={false} />)
    const link = card.getByRole('link', { name: `Open JR-19 — ${name}` })
    assert.equal(link.textContent, `JR-19 - ${name}`)
    card.unmount()
  }
  assert.equal(structuredJobIdentityLine(request({ name: 'Urban | Oak Grove' })),
    'Urban Landscape Group | Urban | Oak Grove | Johnathan')
  assert.equal(structuredJobIdentityLine(request({ name: 'Jane Smith | Oak Grove', customer: null })),
    'Jane Smith | Oak Grove')
})

test('pure balanced geometry and rendered tracks keep exact center with 44px nonoverlapping flanks', () => {
  for (const viewport of [900, 1024, 1440]) {
    const focusedWidth = viewport - 292
    const focused = balancedHeaderGeometry(focusedWidth)
    const expanded = balancedHeaderGeometry(viewport, 44)
    assert.ok(focused)
    assert.ok(expanded)
    for (const geometry of [focused, expanded]) {
      assert.ok(geometry.flank >= 44)
      assert.ok(geometry.identity > 0)
      assert.equal(geometry.edge * 2 + geometry.flank * 2 + geometry.identity, geometry.width)
      assert.equal(geometry.identityCenter, geometry.width / 2)
    }
  }
  assert.equal(balancedHeaderGeometry(87), null)

  const long = request({
    name: 'Courtyard 🌳'.repeat(40),
    customer: {
      ...request().customer!,
      company: '設計施工会社'.repeat(30),
      name: 'Dior Goodwin — José 🚚'.repeat(16),
    },
  })
  const expected = structuredJobIdentityLine(long)
  for (const width of [900, 1024, 1440]) {
    const view = render(
      <div style={{ width }}>
        <FocusedJobHeader request={long} mobile={false} status={status} preview={null} />
      </div>,
    )
    const header = view.container.querySelector<HTMLElement>('[data-focused-job-header="desktop"]')
    const identityRegion = view.container.querySelector<HTMLElement>('[data-desktop-job-identity]')
    const editor = view.getByRole('button', { name: 'Edit job name for JR-19' })
    assert.ok(header)
    assert.ok(identityRegion)
    assert.equal(identityRegion.textContent, expected)
    assert.equal(identityRegion.firstElementChild?.getAttribute('title'), expected)
    assert.equal(editor.textContent, long.name)
    assert.match(identityRegion.firstElementChild?.className ?? '', /whitespace-nowrap/)
    assert.match(identityRegion.firstElementChild?.className ?? '', /text-ellipsis/)
    assert.match(identityRegion.firstElementChild?.className ?? '', /overflow-hidden/)
    assert.doesNotMatch(identityRegion.firstElementChild?.className ?? '', /break-words|whitespace-normal/)
    assert.match(header.className, /flex-wrap/)
    assert.equal(header.querySelector('[data-job-metadata]')?.parentElement, header)
    const flanks = header.querySelectorAll<HTMLElement>('[data-balanced-header-flank]')
    assert.equal(flanks.length, 2)
    assert.match(flanks[0].className, /overflow-hidden/)
    assert.match(flanks[1].className, /overflow-hidden/)
    const chat = view.getByRole('button', { name: 'Chat with Rosie' })
    assert.match(chat.className, /size-11/)
    assert.equal(view.queryByText(/EPD:|Pickup|Delivery\/Pickup|Install Date/), null)
    view.unmount()
  }
})

test('focused header, expanded desktop card and Active Jobs rail share exact stored identity while Job editor stays atomic', () => {
  const value = request({
    id: 34,
    name: 'Ox Eye Phase II',
    customer: { ...request().customer!, company: 'Land Water Light', name: 'Dior Goodwin' },
  })
  const expected = 'Land Water Light | Ox Eye Phase II | Dior Goodwin'

  let view = render(<FocusedJobHeader request={value} mobile={false} status={status} preview={null} />)
  assert.equal(view.container.querySelector('[data-desktop-job-identity]')?.textContent, expected)
  assert.equal(view.getByRole('button', { name: 'Edit job name for JR-34' }).textContent, 'Ox Eye Phase II')
  view.unmount()

  view = render(<RequestCard request={value} expanded selected={new Set()} version={0} onToggle={() => undefined} onSelect={() => undefined} onDelete={() => undefined} onDeleteItem={() => undefined} onSaved={() => undefined} mobile={false} />)
  assert.equal(view.container.querySelector('[data-desktop-job-identity]')?.textContent, expected)
  view.unmount()

  const inbox: JobInboxRow = {
    id: 34, name: value.name, status: value.status, customer: 'legacy must stay unused',
    customerCompany: value.customer?.company ?? null, customerContact: value.customer?.name ?? null,
    createdAt: value.createdAt, updatedAt: value.updatedAt, thread: null,
  }
  const row = orderJobInbox([inbox])[0]
  const aria = jobInboxRowAriaLabel(row, 'Quote')
  view = render(<FocusedJobsRailRow row={row} selected statusLabel="Quote" ariaLabel={aria} onSelect={() => undefined} />)
  assert.equal(view.container.querySelector('[data-focused-job-rail-primary]')?.textContent, value.name)
  assert.ok(view.getByText('Land Water Light · Dior Goodwin'))
  assert.equal(view.container.querySelector('[data-focused-job-rail-primary]')?.getAttribute('title'), `JR-34 · ${expected}`)
})

test('rendered missing and invalid identity candidates stay honest in the desktop strip', () => {
  const missing = request({
    name: '  ',
    customer: null,
    shipping: { address: null, city: null, state: null, zip: null },
    billing: { address: 'Ignored Billing', city: 'Austin', state: 'TX', zip: null },
    createdAt: 'invalid',
    updatedAt: '2026-09-01T13:00:00Z',
    noteInternal: 'PO-44 | Pickup | Install 9/9',
  })
  const view = render(
    <FocusedJobHeader request={missing} mobile={false} status={status} preview={null} />,
  )
  const identity = view.container.querySelector<HTMLElement>('[data-desktop-job-identity]')
  assert.ok(identity)
  assert.equal(identity.textContent, '')
  const add = view.getByRole('button', { name: 'Add job name for JR-19' })
  assert.equal(add.textContent, '')
  assert.doesNotMatch(identity.textContent, /Ignored Billing|PO-44|Pickup|Install|2026|Unassigned|JR-19/)
  view.unmount()
  const mobile = render(<FocusedJobHeader request={{ ...missing, customer: { ...request().customer!, company: 'Company only', name: 'Contact only' } }} mobile status={status} preview={null} />)
  const mobileAdd = mobile.getByRole('button', { name: 'Add job name for JR-19' })
  assert.equal(mobileAdd.textContent, 'Add Job name')
  assert.doesNotMatch(mobileAdd.textContent ?? '', /Company only|Contact only/)
  assert.equal(mobile.container.querySelector('[data-mobile-job-identity]')?.textContent, 'Company only | Contact only')
})

test('expanded desktop All Jobs removes Request boxes and keeps totals/table before a keyboard-operable compact tray', async () => {
  const value = request()
  const view = render(
    <RequestCard
      request={value}
      expanded
      selected={new Set()}
      version={0}
      onToggle={() => undefined}
      onSelect={() => undefined}
      onDelete={() => undefined}
      onDeleteItem={() => undefined}
      onSaved={() => undefined}
      mobile={false}
    />,
  )
  const head = view.container.querySelector<HTMLElement>('[data-desktop-expanded-request-header]')
  const identity = view.container.querySelector<HTMLElement>('[data-desktop-job-identity]')
  assert.ok(head)
  assert.ok(identity)
  assert.equal(identity.textContent, 'Urban Landscape Group | Oak Grove Rd. planting | Johnathan')
  assert.equal(view.queryByText('Request'), null)
  assert.equal(view.queryByText('Billing & payment'), null)
  assert.ok(view.getByText('Total items'))
  assert.ok(view.getByText('Plant Name'))

  const disclosure = view.getByRole('button', { name: 'Job details & notes' })
  assert.equal(disclosure.getAttribute('aria-expanded'), 'false')
  assert.match(disclosure.className, /min-h-11/)
  assert.match(disclosure.className, /focus-visible:ring-2/)
  assert.equal(view.container.querySelector('[data-compact-job-details]'), null)
  assert.equal(view.queryByText('Payment contact / billing'), null)
  assert.equal(disclosure.textContent?.trim(), 'Job details & notes')
  const summary = view.container.querySelector<HTMLElement>('[data-demand-summary]')
  const table = view.container.querySelector<HTMLElement>('[data-request-line-table]')
  const disclosureRegion = view.container.querySelector<HTMLElement>('[data-compact-job-details-disclosure]')
  assert.ok(summary)
  assert.ok(table)
  assert.ok(disclosureRegion)
  assert.ok(summary.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING)
  assert.ok(table.compareDocumentPosition(disclosureRegion) & Node.DOCUMENT_POSITION_FOLLOWING)
  assert.ok(disclosureRegion.compareDocumentPosition(view.getByRole('button', { name: /Change history/ })) & Node.DOCUMENT_POSITION_FOLLOWING)

  const expandedHeader = view.container.querySelector<HTMLElement>('[data-desktop-expanded-request-header]')
  assert.ok(expandedHeader)
  assert.match(expandedHeader.className, /flex-wrap/)
  assert.equal(expandedHeader.querySelector('[data-job-metadata]')?.parentElement, expandedHeader)
  assert.match(view.getByRole('button', { name: 'Quote' }).className, /size-11|(?:min-h-11.*min-w-11)/)
  assert.match(view.getByRole('button', { name: 'Chat with Rosie about JR-19' }).className, /size-11/)
  assert.match(view.getByRole('button', { name: 'Delete JR-19' }).className, /size-11/)

  disclosure.focus()
  await userEvent.setup({ document }).keyboard('{Enter}')
  assert.equal(disclosure.getAttribute('aria-expanded'), 'true')
  assert.equal(document.activeElement, disclosure)
  const tray = view.container.querySelector<HTMLElement>('[data-compact-job-details]')
  assert.ok(tray)
  assert.match(tray.className, /grid-cols-1/)
  assert.match(tray.className, /min-\[1100px\]:grid-cols-2/)
  assert.match(tray.className, /min-\[1500px\]:grid-cols-4/)
  for (const label of ['Contact', 'Payment contact / billing', 'Delivery', 'Other / notes']) {
    assert.ok(within(tray).getByRole('heading', { name: label }))
  }
  assert.ok(within(tray).getByText('Johnathan'))
  assert.ok(within(tray).getByText('+1 512 555 0100 · johnathan@example.com'))
  assert.ok(within(tray).getByText('Last updated'))
  assert.equal(within(tray).queryByText(/Payment method|Gate code|Tax status|Delivery\/Pickup/i), null)
  assert.equal(within(tray).queryByText('Oak Grove Rd. planting'), null)
  assert.equal(within(tray).queryByText('JR-19'), null)
})

test('focused mobile uses the compact post-table tray and switching JR closes it', async () => {
  const view = render(<FocusedJobRecord request={request()} mobile version={0} onSaved={() => undefined} />)
  assert.equal(view.queryByText('Request'), null)
  const table = view.container.querySelector<HTMLElement>('[data-request-line-table]')
  const disclosureRegion = view.container.querySelector<HTMLElement>('[data-compact-job-details-disclosure]')
  assert.ok(table)
  assert.ok(disclosureRegion)
  assert.ok(table.compareDocumentPosition(disclosureRegion) & Node.DOCUMENT_POSITION_FOLLOWING)
  const disclosure = view.getByRole('button', { name: 'Job details & notes' })
  await userEvent.setup({ document }).click(disclosure)
  assert.equal(disclosure.getAttribute('aria-expanded'), 'true')
  view.rerender(<FocusedJobRecord request={request({ id: 20, name: 'Second Job' })} mobile version={0} onSaved={() => undefined} />)
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(view.getByRole('button', { name: 'Job details & notes' }).getAttribute('aria-expanded'), 'false')
})

test('closed compact disclosure label stays neutral for every independently stored tray fact', () => {
  const empty = request({
    customer: null,
    billing: { address: null, city: null, state: null, zip: null },
    shipping: { address: null, city: null, state: null, zip: null },
    notes: [], noteForCustomer: null, noteInternal: null, supplierLinks: [], updatedAt: null,
  })
  const variants: JobRequestRow[] = [
    { ...empty, noteInternal: 'Exact sourcing fact' },
    { ...empty, updatedAt: '2026-09-01T13:00:00Z' },
    { ...empty, customer: { ...request().customer!, rosieThreadId: 'customer-johnathan' } },
    { ...empty, supplierLinks: [{ supplierId: 8, name: 'Supplier', lpsPartner: true, availabilityRequests: [{ id: 81, status: 'new' }], rosieThreadId: 'supplier-8' }] },
    { ...empty, notes: [{ kind: 'customer', stamp: null, text: 'Exact note' }] },
    { ...empty, shipping: { address: '1 Main', city: null, state: null, zip: null } },
  ]
  for (const value of variants) {
    const view = render(<FocusedJobRecord request={value} mobile={false} version={0} onSaved={() => undefined} />)
    const disclosure = view.getByRole('button', { name: 'Job details & notes' })
    assert.equal(disclosure.textContent?.trim(), 'Job details & notes')
    assert.doesNotMatch(disclosure.textContent ?? '', /No secondary|No address|saved details/i)
    view.unmount()
  }
})

test('focused header exposes summary and customer, AR and supplier routes before opening details', async () => {
  const linked = request({
    lineTotal: 1250.5, itemCount: 7, statusCounts: { pending: 3, available: 4 },
    supplierLinks: [{ supplierId: 8, name: 'Hill Country', lpsPartner: true, availabilityRequests: [{ id: 81, status: 'new' }], rosieThreadId: 'supplier-8' }],
  })
  const chatRoutes: unknown[] = []
  const ars: number[] = []
  window.addEventListener('lps:open-chat', (event) => chatRoutes.push((event as CustomEvent).detail))
  window.addEventListener('lps:open-ar', (event) => ars.push((event as CustomEvent<number>).detail))
  const toolbar = document.createElement('div')
  document.body.append(toolbar)
  const view = render(<FocusedJobRecord actionsTarget={toolbar} request={linked} mobile={false} version={0} onSaved={() => undefined} />)
  assert.equal(view.getByRole('button', { name: 'Job details & notes' }).getAttribute('aria-expanded'), 'false')
  const header = view.container.querySelector<HTMLElement>('[data-focused-job-summary]')!
  const identityHeader = view.container.querySelector<HTMLElement>('[data-focused-job-header]')!
  assert.ok(toolbar.contains(view.getByRole('button', { name: 'Delete JR-19' })))
  assert.equal(identityHeader.querySelector('[aria-label="Delete JR-19"]'), null)
  assert.ok(toolbar.contains(view.getByRole('button', { name: 'Chat with Rosie' })))
  assert.ok(header.firstElementChild?.matches('[data-demand-summary]'))
  assert.equal(view.container.querySelectorAll('[data-demand-summary]').length, 1)
  assert.ok(within(header).getByText('$1,250.50'))
  assert.ok(within(header).getByText('3'))
  assert.ok(within(header).getByText('4'))
  for (const label of ['Pending', 'Available', 'Unavailable', 'Diff Sz/Qnty/Sub', 'Can Order', 'Arriving Soon', 'Total items']) {
    assert.ok(within(header).getByText(label))
  }
  const customer = view.getByRole('button', { name: /Open the customer conversation/ })
  const ar = view.getByRole('button', { name: /AR-81/ })
  const supplier = view.getByRole('button', { name: /Open the supplier conversation/ })
  assert.match(customer.className, /min-h-11/)
  for (const control of [ar, supplier]) assert.match(control.className, /min-h-8/)
  assert.match(ar.className, /flex-row/)
  for (const control of [customer, ar, supplier]) assert.ok(header.contains(control))
  await userEvent.setup({ document }).click(customer)
  await userEvent.setup({ document }).click(ar)
  await userEvent.setup({ document }).click(supplier)
  assert.equal(chatRoutes.length, 2)
  assert.deepEqual(ars, [81])
  view.unmount()
  assert.equal(toolbar.childElementCount, 0)
  toolbar.remove()
})

test('shared editable defaults stay compact while focused work explicitly opts into 44px controls', () => {
  const source = readFileSync(new URL('../components/workspace/editable.tsx', import.meta.url), 'utf8')
  assert.match(source, /touchTarget = false/)
  assert.match(source, /touchTarget && 'min-h-11'/)
  const normal = render(<EditableText table="customers" id={4} column="name" value="Jamie" onSaved={() => undefined} />)
  assert.doesNotMatch(normal.getByRole('button').className, /min-h-11/)
  normal.unmount()
  const focused = render(<EditableText table="job_requests" id={19} column="name" value="Patio" touchTarget onSaved={() => undefined} />)
  assert.match(focused.getByRole('button').className, /min-h-11/)
  focused.unmount()
  const textareaDefault = render(<EditableTextarea table="customers" id={4} column="notes" value="Note" placeholder="Add" onSaved={() => undefined} />)
  assert.doesNotMatch(textareaDefault.getByRole('button').className, /min-h-11/)
  textareaDefault.unmount()
  const textareaFocused = render(<EditableTextarea table="job_requests" id={19} column="note_internal" value="Note" placeholder="Add" touchTarget onSaved={() => undefined} />)
  assert.match(textareaFocused.getByRole('button').className, /min-h-11/)
  textareaFocused.unmount()
  const statusDefault = render(<StatusPill table="customers" id={4} column="status" value="active" label="Active" tone="green" options={[{ value: 'active', label: 'Active' }]} onSaved={() => undefined} />)
  assert.doesNotMatch(statusDefault.getByRole('button').className, /min-h-11|min-w-11|size-11/)
  statusDefault.unmount()
  const statusFocused = render(<StatusPill table="job_requests" id={19} column="status" value="sourcing" label="Sourcing" tone="amber" options={[{ value: 'sourcing', label: 'Sourcing' }]} touchTarget onSaved={() => undefined} />)
  assert.match(statusFocused.getByRole('button').className, /min-h-11/)
  assert.match(source, /if \(e\.key === 'Escape'\)[\s\S]*setEditing\(false\)[\s\S]*restoreTrigger\(\)/)
  assert.match(source, /target\?\.isConnected && !target\.closest\('\[inert\]'\)/)
})

test('focused Job name editor trims and PATCHes only name, cancels blank/Escape, handles failure and ignores a stale JR', async () => {
  const user = userEvent.setup({ document })
  const calls: Array<{ url: string; init: RequestInit }> = []
  let responses: Array<Promise<{ ok: boolean; json: () => Promise<{ error?: string }> }>> = []
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return responses.shift() ?? Promise.resolve({ ok: true, json: async () => ({}) })
    },
  })
  let refetches = 0
  const view = render(<FocusedJobNameEditor request={request()} mobile onSaved={() => { refetches += 1 }} />)

  await user.click(view.getByRole('button', { name: 'Edit job name for JR-19' }))
  let input = view.getByRole('textbox', { name: 'Job name for JR-19' })
  await user.clear(input)
  await user.type(input, '   ')
  await user.keyboard('{Enter}')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(calls.length, 0)
  assert.equal(document.activeElement, view.getByRole('button', { name: 'Edit job name for JR-19' }))

  await user.click(view.getByRole('button', { name: 'Edit job name for JR-19' }))
  await user.keyboard('{Escape}')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(calls.length, 0)
  assert.equal(document.activeElement, view.getByRole('button', { name: 'Edit job name for JR-19' }))

  responses = [Promise.resolve({ ok: true, json: async () => ({}) })]
  await user.click(view.getByRole('button', { name: 'Edit job name for JR-19' }))
  input = view.getByRole('textbox', { name: 'Job name for JR-19' })
  await user.clear(input)
  await user.type(input, '  Renamed Job  {Enter}')
  await waitFor(() => assert.equal(refetches, 1))
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api/rows')
  assert.equal(calls[0].init.method, 'PATCH')
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    table: 'job_requests', id: 19, column: 'name', value: 'Renamed Job',
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(document.activeElement, view.getByRole('button', { name: 'Edit job name for JR-19' }))

  responses = [Promise.resolve({ ok: false, json: async () => ({ error: 'Denied' }) })]
  await user.click(view.getByRole('button', { name: 'Edit job name for JR-19' }))
  await user.clear(view.getByRole('textbox'))
  await user.type(view.getByRole('textbox'), 'Failed name{Enter}')
  await waitFor(() => assert.equal(calls.length, 2))
  await waitFor(() => assert.equal((view.getByRole('textbox', { name: 'Job name for JR-19' }) as HTMLInputElement).disabled, false))
  assert.equal(document.activeElement, view.getByRole('textbox', { name: 'Job name for JR-19' }))
  assert.equal(refetches, 1)
  await user.click(view.getByRole('button', { name: 'Cancel' }))

  await user.click(view.getByRole('button', { name: 'Edit job name for JR-19' }))
  await user.clear(view.getByRole('textbox'))
  await user.type(view.getByRole('textbox'), 'x'.repeat(161))
  await user.click(view.getByRole('button', { name: 'Save' }))
  assert.match(view.getByRole('alert').textContent ?? '', /160 characters or fewer/)
  assert.equal(calls.length, 2)
  assert.equal(document.activeElement, view.getByRole('textbox'))
  await user.click(view.getByRole('button', { name: 'Cancel' }))

  responses = [Promise.resolve({ ok: true, json: async () => ({}) })]
  await user.click(view.getByRole('button', { name: 'Edit job name for JR-19' }))
  await user.clear(view.getByRole('textbox'))
  await user.type(view.getByRole('textbox'), 'y'.repeat(160))
  await user.click(view.getByRole('button', { name: 'Save' }))
  await waitFor(() => assert.equal(refetches, 2))
  assert.equal(calls.length, 3)
  assert.equal(JSON.parse(String(calls[2].init.body)).value.length, 160)

  let resolveDouble!: (value: { ok: boolean; json: () => Promise<Record<string, never>> }) => void
  responses = [new Promise((resolve) => { resolveDouble = resolve })]
  await user.click(view.getByRole('button', { name: 'Edit job name for JR-19' }))
  input = view.getByRole('textbox')
  await user.clear(input)
  await user.type(input, 'One write')
  fireEvent.keyDown(input, { key: 'Enter' })
  fireEvent.keyDown(input, { key: 'Enter' })
  assert.equal(calls.length, 4)
  resolveDouble({ ok: true, json: async () => ({}) })
  await waitFor(() => assert.equal(refetches, 3))

  let resolveStale!: (value: { ok: boolean; json: () => Promise<Record<string, never>> }) => void
  responses = [new Promise((resolve) => { resolveStale = resolve })]
  await user.click(view.getByRole('button', { name: 'Edit job name for JR-19' }))
  await user.clear(view.getByRole('textbox'))
  await user.type(view.getByRole('textbox'), 'Old JR rename{Enter}')
  view.rerender(<FocusedJobNameEditor request={request({ id: 20, name: 'Current JR' })} mobile onSaved={() => { refetches += 1 }} />)
  resolveStale({ ok: true, json: async () => ({}) })
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(refetches, 3)
  assert.ok(view.getByRole('button', { name: 'Edit job name for JR-20' }))

  const older = { ...({ id: 19, name: 'Old', status: 'quoted', customer: null, customerCompany: null, customerContact: null, createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z', thread: null } satisfies JobInboxRow) }
  const newer = { ...older, id: 20, name: 'New', updatedAt: '2026-09-01T11:00:00Z' }
  assert.deepEqual(orderJobInbox([older, newer]).map((row) => row.id), [20, 19])
  const rowsRoute = readFileSync(new URL('../app/api/rows/route.ts', import.meta.url), 'utf8')
  assert.match(rowsRoute, /body\.table === 'job_requests' && body\.column === 'name'/)
  assert.match(rowsRoute, /value\.trim\(\)\.length > JOB_NAME_MAX_LENGTH/)
})

test('parent refetch lifecycle remounts both detail and rail before restoring the live Job-name trigger on mobile and desktop', async () => {
  for (const mobile of [true, false]) {
    let savedName = ''
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: async (_url: string, init: RequestInit) => {
        savedName = JSON.parse(String(init.body)).value
        return { ok: true, json: async () => ({}) }
      },
    })
    function Parent() {
      const [value, setValue] = useState(request())
      const root = useRef<HTMLDivElement>(null)
      const pending = useRef<number | null>(null)
      useEffect(() => {
        if (pending.current !== value.id) return
        requestAnimationFrame(() => {
          if (focusConnectedJobNameTrigger(root.current, value.id)) pending.current = null
        })
      }, [value])
      const inbox = orderJobInbox([{
        id: value.id, name: value.name, status: value.status, customer: 'legacy',
        customerCompany: value.customer?.company ?? null, customerContact: value.customer?.name ?? null,
        createdAt: value.createdAt, updatedAt: value.updatedAt, thread: null,
      }])[0]
      return <div ref={root}>
        <FocusedJobsRailRow row={inbox} selected statusLabel="Sourcing" ariaLabel="Focused row" onSelect={() => undefined} />
        <FocusedJobRecord request={value} mobile={mobile} version={0} onSaved={() => undefined} onNameSaved={(id) => {
          pending.current = id
          setValue(request({ id, name: savedName, updatedAt: '2026-09-01T14:00:00Z' }))
        }} />
      </div>
    }
    const view = render(<Parent />)
    const user = userEvent.setup({ document })
    await user.click(view.getByRole('button', { name: 'Edit job name for JR-19' }))
    const textbox = view.getByRole('textbox')
    await user.clear(textbox)
    await user.type(textbox, mobile ? 'Mobile rename' : 'Desktop rename')
    for (const action of [view.getByRole('button', { name: 'Save' }), view.getByRole('button', { name: 'Cancel' })]) {
      assert.match(action.className, /min-h-11/)
    }
    if (mobile) await user.click(view.getByRole('button', { name: 'Save' }))
    else fireEvent.keyDown(textbox, { key: 'Enter' })
    const expected = mobile ? 'Mobile rename' : 'Desktop rename'
    await waitFor(() => assert.equal(view.container.querySelector('[data-focused-job-rail-primary]')?.textContent, expected))
    await waitFor(() => assert.equal(document.activeElement, view.getByRole('button', { name: 'Edit job name for JR-19' })))
    assert.equal(view.container.querySelector('[data-desktop-job-identity]')?.textContent ?? view.container.querySelector('[data-mobile-job-identity]')?.textContent, `Urban Landscape Group | ${expected} | Johnathan`)
    view.unmount()
  }
  const page = readFileSync(new URL('../app/jobs/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /pendingNameFocus\.current = id[\s\S]*Promise\.all\(\[loadDetail\(id\), refreshList\(\)\]\)[\s\S]*focusConnectedJobNameTrigger/)
})

test('expanded desktop Delete opens the real confirmation and Cancel returns focus', async () => {
  function Harness() {
    const [open, setOpen] = useState(false)
    const returnFocus = useRef<HTMLElement | null>(null)
    return <><RequestCard request={request()} expanded selected={new Set()} version={0} onToggle={() => undefined} onSelect={() => undefined} onDelete={(target) => { returnFocus.current = target; setOpen(true) }} onDeleteItem={() => undefined} onSaved={() => undefined} mobile={false} />{open && <DeleteRequestDialog request={request()} busy={false} error="" returnFocus={returnFocus} onCancel={() => setOpen(false)} onConfirm={() => undefined} />}</>
  }
  const view = render(<Harness />)
  const trigger = view.getByRole('button', { name: 'Delete JR-19' })
  assert.match(trigger.className, /size-11/)
  await userEvent.setup({ document }).click(trigger)
  assert.ok(view.getByRole('dialog', { name: /Permanently delete JR-19/ }))
  await userEvent.setup({ document }).click(view.getByRole('button', { name: 'Cancel' }))
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(document.activeElement, trigger)
})

test('focused compact Delete keeps the permanent confirmation, focus return and success return callback', async () => {
  const user = userEvent.setup({ document })
  let deleted = 0
  const view = render(<FocusedJobRecord request={request()} mobile version={0} onSaved={() => undefined} onDeleted={() => { deleted += 1 }} />)
  let trigger = view.getByRole('button', { name: 'Delete JR-19' })
  assert.match(trigger.className, /min-h-11/)
  await user.click(trigger)
  let dialog = view.getByRole('dialog', { name: /Permanently delete JR-19/ })
  assert.match(dialog.textContent ?? '', /change history/i)
  assert.match(dialog.textContent ?? '', /Rosie chat and exclusive orders are also permanently deleted/)
  assert.match(dialog.textContent ?? '', /Exclusive availability requests are removed from active views, with their saved records retained/)
  assert.match(dialog.textContent ?? '', /shared with other jobs are kept/)
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  await new Promise((resolve) => setTimeout(resolve, 0))
  trigger = view.getByRole('button', { name: 'Delete JR-19' })
  assert.equal(document.activeElement, trigger)

  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: async (url: string, init: RequestInit) => {
      assert.equal(url, '/api/requests/19')
      assert.equal(init.method, 'DELETE')
      return { ok: true, json: async () => ({ ok: true, deleted: { items: 0, availabilityRequests: 0, availabilityRequestItems: 0, changelog: 0, answers: 0 } }) }
    },
  })
  await user.click(trigger)
  dialog = view.getByRole('dialog', { name: /Permanently delete JR-19/ })
  await user.click(within(dialog).getByRole('button', { name: /Delete permanently/ }))
  await waitFor(() => assert.equal(deleted, 1))
  assert.equal(view.queryByRole('dialog'), null)
})

test('focused Delete rejects network, 403, malformed and duplicate confirms, then accepts truthful nonzero counts', async () => {
  const user = userEvent.setup({ document })
  let navigations = 0
  const response = (ok: boolean, status: number, body: object) => ({ ok, status, json: async () => body })

  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: async () => { throw new Error('offline') } })
  let view = render(<FocusedJobRecord request={request()} mobile version={0} onSaved={() => undefined} onDeleted={() => { navigations += 1 }} />)
  await user.click(view.getByRole('button', { name: 'Delete JR-19' }))
  await user.click(view.getByRole('button', { name: 'Delete permanently' }))
  await waitFor(() => assert.match(view.getByRole('alert').textContent ?? '', /check your connection/))
  assert.equal(navigations, 0)
  view.unmount()

  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: async () => response(false, 403, { error: 'Forbidden' }) })
  view = render(<FocusedJobRecord request={request()} mobile version={0} onSaved={() => undefined} onDeleted={() => { navigations += 1 }} />)
  await user.click(view.getByRole('button', { name: 'Delete JR-19' }))
  await user.click(view.getByRole('button', { name: 'Delete permanently' }))
  await waitFor(() => assert.equal(view.getByRole('alert').textContent, 'Could not delete JR-19 — Forbidden'))
  assert.equal(navigations, 0)
  view.unmount()

  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: async () => response(true, 200, { ok: true, deleted: { items: '2' } }) })
  view = render(<FocusedJobRecord request={request()} mobile version={0} onSaved={() => undefined} onDeleted={() => { navigations += 1 }} />)
  await user.click(view.getByRole('button', { name: 'Delete JR-19' }))
  await user.click(view.getByRole('button', { name: 'Delete permanently' }))
  await waitFor(() => assert.match(view.getByRole('alert').textContent ?? '', /invalid response/))
  assert.equal(navigations, 0)
  view.unmount()

  let calls = 0
  let resolveDelete!: (value: ReturnType<typeof response>) => void
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: () => {
    calls += 1
    return new Promise((resolve) => { resolveDelete = resolve })
  } })
  view = render(<FocusedJobRecord request={request()} mobile version={0} onSaved={() => undefined} onDeleted={() => { navigations += 1 }} />)
  await user.click(view.getByRole('button', { name: 'Delete JR-19' }))
  const confirm = view.getByRole('button', { name: 'Delete permanently' })
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  assert.equal(calls, 1)
  resolveDelete(response(true, 200, { ok: true, deleted: { items: 2, availabilityRequests: 1, availabilityRequestItems: 4, changelog: 3, answers: 0 } }))
  await waitFor(() => assert.equal(navigations, 1))
  assert.equal(view.queryByRole('dialog'), null)
  assert.deepEqual(requestDeletionCounts({ deleted: { items: 2, availabilityRequests: 1, availabilityRequestItems: 4, changelog: 3, answers: 0 } }), { items: 2, availabilityRequests: 1, availabilityRequestItems: 4, changelog: 3, answers: 0 })
  assert.equal(requestDeletionCounts({ deleted: { items: -1, availabilityRequests: 0, availabilityRequestItems: 0, changelog: 0, answers: 0 } }), null)
})

test('sidebar cards show identity, status and Created/EDD dates without chat or activity text', () => {
  const base: JobInboxRow = {
    id: 34,
    name: 'Courtyard 🌿'.repeat(20),
    status: 'quoted',
    customer: 'must not be used',
    customerCompany: 'Land Water Light',
    customerContact: 'Dior Goodwin',
    createdAt: '2026-09-02T01:00:00Z',
    expectedInstallDate: '2026-09-20',
    updatedAt: '2026-09-01T13:00:00Z',
    thread: { lastId: 5, lastAt: '2026-09-01T14:00:00Z', lastText: 'Long snippet '.repeat(20), webReadId: 4 },
  }
  const row = orderJobInbox([base])[0]
  const expected = `JR-34 · Land Water Light | ${base.name} | Dior Goodwin`
  for (const selected of [false, true]) {
    const label = jobInboxRowAriaLabel(row, 'Quote')
    const view = render(
      <div style={{ width: 292 }}>
        <FocusedJobsRailRow
          row={row}
          selected={selected}
          statusLabel="Quote"
          ariaLabel={label}
          onSelect={() => undefined}
        />
      </div>,
    )
    const button = view.getByRole('button', { name: label })
    const primary = view.container.querySelector<HTMLElement>('[data-focused-job-rail-primary]')
    assert.ok(primary)
    assert.equal(primary.textContent, base.name)
    assert.equal(primary.title, `${expected} · Created Tue, 09/01`)
    assert.match(primary.className, /truncate/)
    assert.ok(view.getByText('Land Water Light · Dior Goodwin'))
    const status = view.container.querySelector<HTMLElement>('[data-job-status="quoted"]')!
    assert.match(status.style.background, /--lps-tone-teal-bg/)
    assert.equal(status.textContent, 'Quote')
    assert.equal(status.title, 'Quote')
    assert.equal(button.getAttribute('aria-current'), selected ? 'page' : null)
    assert.equal(button.querySelector('[data-focused-job-rail-dates]')?.textContent, 'Sun, 09/20')
    assert.doesNotMatch(button.textContent ?? '', /Long snippet|New web chat|Sep 1, 2:00 PM|Unread in team web chat/)
    assert.ok(button.querySelector('[title="Unread messages"]'))
    view.unmount()
  }
})


test('job schedule saves the customer expected delivery / installation date and fulfillment method', async () => {
  const writes: unknown[] = []
  globalThis.fetch = async (_url, init) => {
    writes.push(JSON.parse(String(init?.body)))
    return new Response('{}', { status: 200 })
  }
  const view = render(<FocusedJobRecord request={request({ expectedInstallDate: '2026-10-01', fulfillmentMethod: 'delivery' })}
    mobile={false} version={0} onSaved={() => undefined} />)
  fireEvent.click(view.getByRole('button', { name: 'Job details & notes' }))
  const date = view.getByLabelText('Expected delivery / installation date') as HTMLInputElement
  assert.equal(date.value, '2026-10-01')
  fireEvent.change(date, { target: { value: '2026-10-02' } })
  fireEvent.blur(date)
  await waitFor(() => assert.equal(writes.length, 1))
  await waitFor(() => assert.equal((view.getByLabelText('Pickup / Delivery') as HTMLSelectElement).disabled, false))
  fireEvent.change(view.getByLabelText('Pickup / Delivery'), { target: { value: 'pickup' } })
  await waitFor(() => assert.equal(writes.length, 2))
  assert.deepEqual(writes, [
    { table: 'job_requests', id: 19, column: 'expected_install_date', value: '2026-10-02' },
    { table: 'job_requests', id: 19, column: 'fulfillment_method', value: 'pickup' },
  ])
})


test('line table Tab saves edits, traverses cells and rows, and Shift+Tab reverses', async () => {
  const writes: unknown[] = []
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    if (init?.method === 'PATCH') writes.push(JSON.parse(String(init.body)))
    return { ok: true, json: async () => ({}) } as Response
  }) as typeof fetch
  const user = userEvent.setup({ document: dom.window.document })
  const view = render(<FocusedJobRecord
    request={request({ items: [sourcingItem, { ...sourcingItem, id: 52 }], itemCount: 2 })}
    mobile={false} version={0} onSaved={() => {}} />)
  const rows = view.container.querySelectorAll<HTMLElement>('[data-line-row]')
  const cells = Array.from(rows[0].children) as HTMLElement[]
  const demand = cells.findIndex((cell) => !!cell.querySelector('[title="Demand — what the customer asked for"]'))
  await user.click(cells[demand].querySelector('button')!)
  await user.clear(cells[demand].querySelector('input')!)
  await user.type(cells[demand].querySelector('input')!, '25')
  await user.tab()
  assert.equal(document.activeElement, cells[demand + 1].querySelector('input'))
  await waitFor(() => assert.deepEqual(writes, [{ table: 'job_request_items', id: 51, column: 'demanded_quantity', value: '25' }]))
  await user.tab({ shift: true })
  assert.equal(document.activeElement, cells[demand].querySelector('input'))
  for (let index = demand + 1; index < cells.length; index++) {
    await user.tab()
    assert.ok(cells[index].contains(document.activeElement), `Tab should reach cell ${index}`)
  }
  await user.tab()
  assert.ok(rows[1].firstElementChild!.contains(document.activeElement))
  await user.tab({ shift: true })
  assert.ok(cells.at(-1)!.contains(document.activeElement))
})
