import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import React, { useState } from 'react'
import { JSDOM } from 'jsdom'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { SupplierFilters } from '../components/workspace/supplier-filters.tsx'
import { Toolbar } from '../components/workspace/toolbar.tsx'
import type { ColFilters } from './table-config.ts'

let dom: JSDOM

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/suppliers' })
  const win = dom.window
  const globals = {
    window: win,
    document: win.document,
    navigator: win.navigator,
    HTMLElement: win.HTMLElement,
    Node: win.Node,
    MouseEvent: win.MouseEvent,
    KeyboardEvent: win.KeyboardEvent,
    getComputedStyle: win.getComputedStyle,
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    IS_REACT_ACT_ENVIRONMENT: true,
  }
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  Object.defineProperty(win.HTMLElement.prototype, 'inert', { configurable: true, writable: true, value: false })
  Object.defineProperty(win.HTMLElement.prototype, 'getClientRects', {
    configurable: true,
    value() { return [{ width: 1, height: 1 }] },
  })
  // React's legacy input-event fallback probes these IE hooks in JSDOM.
  Object.defineProperty(win.HTMLElement.prototype, 'attachEvent', { configurable: true, value() {} })
  Object.defineProperty(win.HTMLElement.prototype, 'detachEvent', { configurable: true, value() {} })
})

afterEach(() => {
  cleanup()
  dom.window.close()
})

const OPTIONS: Record<string, string[]> = {
  city: ['Austin', 'Dallas'],
  category: ['Grower', 'Wholesale Supplier'],
  state: ['TX', 'LA'],
}

function Harness({ mobile = false }: { mobile?: boolean }) {
  const [filters, setFilters] = useState<ColFilters>({})
  return (
    <SupplierFilters
      mobile={mobile}
      filters={filters}
      options={(key) => OPTIONS[key] ?? []}
      onFilter={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
    />
  )
}

function ToolbarHarness() {
  const [query, setQuery] = useState('broad')
  const [filters, setFilters] = useState<ColFilters>({ city: ['Austin'], name: 'oak' })
  const [page, setPage] = useState(3)
  return (
    <Toolbar
      placeholder="Search name, contact, email, city…"
      query={query}
      onQuery={(value) => { setQuery(value); setPage(1) }}
      controls={<SupplierFilters mobile={false} filters={filters} options={(key) => OPTIONS[key] ?? []} onFilter={(key, value) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1) }} />}
      hasFilters={!!query || Object.keys(filters).length > 0}
      onClear={() => { setQuery(''); setFilters({}); setPage(1) }}
      summary="50/1336 Companies"
      pagination={{ page, pageCount: 27, onPage: setPage }}
    />
  )
}

test('desktop popover applies searchable/multiple/exclusive state and closes accessibly', async () => {
  const user = userEvent.setup({ document })
  const view = render(<Harness />)
  const trigger = view.getByRole('button', { name: 'Filters' })
  await user.click(trigger)

  const dialog = view.getByRole('dialog', { name: 'Supplier filters' })
  const name = within(dialog).getByRole('textbox', { name: 'Name contains' })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(document.activeElement, name)
  await user.type(name, 'oak')

  const city = within(dialog).getByRole('button', { name: 'All cities' })
  await user.click(city)
  const citySearch = within(dialog).getByRole('textbox', { name: 'Search cities…' })
  await user.type(citySearch, 'Aus')
  assert.equal(within(dialog).queryByRole('button', { name: 'Dallas' }), null)
  const austin = within(dialog).getByRole('button', { name: 'Austin' })
  await user.click(austin)
  assert.notEqual(document.activeElement, trigger, 'selecting inside must not flicker focus to Filters')

  await user.click(within(dialog).getByRole('button', { name: 'LPS Partners' }))
  await user.click(within(dialog).getByRole('button', { name: 'Not partners' }))
  assert.equal(within(dialog).getByRole('button', { name: 'LPS Partners' }).getAttribute('aria-pressed'), 'false')
  assert.equal(within(dialog).getByRole('button', { name: 'Not partners' }).getAttribute('aria-pressed'), 'true')

  await user.keyboard('{Escape}')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(view.queryByRole('dialog'), null)
  assert.equal(document.activeElement, trigger)
  const active = view.getByLabelText('Active supplier filters')
  assert.match(active.textContent ?? '', /Name: oak/)
  assert.match(active.textContent ?? '', /City: Austin/)
  assert.match(active.textContent ?? '', /Partner: Not partners/)

  await user.click(trigger)
  fireEvent.mouseDown(document.body)
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(view.queryByRole('dialog'), null)
  assert.equal(document.activeElement, trigger)
})

test('rendered toolbar clears broad and advanced state and resets paging on any new criterion', async () => {
  const user = userEvent.setup({ document })
  const view = render(<ToolbarHarness />)
  const search = view.getByRole('textbox', { name: 'Search name, contact, email, city…' })
  assert.equal((search as HTMLInputElement).value, 'broad')
  assert.match(view.getByLabelText('Active supplier filters').textContent ?? '', /City: Austin/)
  assert.match(view.getByLabelText('Active supplier filters').textContent ?? '', /Name: oak/)
  assert.match(view.container.textContent ?? '', /50\/1336 Companies/)
  assert.match(view.container.textContent ?? '', /Page 3 of 27/)

  await user.click(view.getByRole('button', { name: 'Clear all' }))
  assert.equal((search as HTMLInputElement).value, '')
  assert.equal(view.queryByLabelText('Active supplier filters'), null)
  assert.equal(view.queryByRole('button', { name: 'Clear all' }), null)
  assert.match(view.container.textContent ?? '', /Page 1 of 27/)

  await user.click(view.getByRole('button', { name: 'Next page' }))
  assert.match(view.container.textContent ?? '', /Page 2 of 27/)
  await user.type(search, 'Dallas')
  assert.match(view.container.textContent ?? '', /Page 1 of 27/)

  await user.click(view.getByRole('button', { name: 'Next page' }))
  await user.click(view.getByRole('button', { name: 'Filters' }))
  await user.type(view.getByRole('textbox', { name: 'Name contains' }), 'oak')
  assert.match(view.container.textContent ?? '', /Page 1 of 27/)
})

test('mobile sheet traps focus, isolates background and restores everything on close/unmount', async () => {
  const user = userEvent.setup({ document })
  const background = document.createElement('button')
  background.textContent = 'Background action'
  document.body.appendChild(background)
  const view = render(<Harness mobile />)
  const appRoot = view.container
  const trigger = view.getByRole('button', { name: 'Filters' })
  await user.click(trigger)
  await new Promise((resolve) => setTimeout(resolve, 0))

  const dialog = view.getByRole('dialog', { name: 'Supplier filters' })
  assert.equal(dialog.getAttribute('aria-modal'), 'true')
  assert.equal(appRoot.inert, true)
  assert.equal(appRoot.getAttribute('aria-hidden'), 'true')
  assert.equal(background.inert, true)
  assert.equal(document.body.style.overflow, 'hidden')
  assert.equal(document.activeElement, within(dialog).getByRole('textbox', { name: 'Name contains' }))

  const close = within(dialog).getByRole('button', { name: 'Close supplier filters' })
  close.focus()
  await user.keyboard('{Shift>}{Tab}{/Shift}')
  assert.equal(document.activeElement, within(dialog).getByRole('button', { name: 'Not partners' }))
  await user.tab()
  assert.equal(document.activeElement, close)

  await user.click(close)
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(document.activeElement, trigger)
  assert.equal(appRoot.inert, false)
  assert.equal(appRoot.hasAttribute('aria-hidden'), false)
  assert.equal(background.inert, false)
  assert.equal(document.body.style.overflow, '')

  await user.click(trigger)
  await new Promise((resolve) => setTimeout(resolve, 0))
  view.unmount()
  assert.equal(appRoot.inert, false)
  assert.equal(background.inert, false)
  assert.equal(document.body.style.overflow, '')
  background.remove()
})
