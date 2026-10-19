import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { afterEach, beforeEach } from 'node:test'
import React, { useState } from 'react'
import { JSDOM } from 'jsdom'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  AccountRailActions, SupplierPortalList, fetchPartnerSuppliers, useBreakpointMenuReset,
  type PageId,
} from '../components/workspace/shell.tsx'

let dom: JSDOM

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/suppliers' })
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
  })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
})

afterEach(() => {
  cleanup()
  dom.window.close()
})

function Harness({ page = 'suppliers', navOpen = true }: { page?: PageId; navOpen?: boolean }) {
  const [open, setOpen] = useState(false)
  const [supplierOpen, setSupplierOpen] = useState(false)
  return (
    <AccountRailActions
      navOpen={navOpen}
      page={page}
      user="Chris"
      open={open}
      setOpen={setOpen}
      supplierOpen={supplierOpen}
      setSupplierOpen={setSupplierOpen}
      toggleSupplier={() => setSupplierOpen((value) => !value)}
      supplierList={(className, onSelect) => (
        <a href="/partner/7" target="_blank" rel="noreferrer" className={className} onClick={onSelect}>Oak Hill</a>
      )}
      signOut={() => undefined}
      railBtn={(active) => active ? 'active-row' : 'idle-row'}
    />
  )
}

test('rendered desktop Account disclosure exposes state, actions, nesting and launch dismissal', async () => {
  const user = userEvent.setup({ document })
  const view = render(<Harness />)
  const trigger = view.getByRole('button', { name: 'Account' })
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  assert.match(trigger.className, /min-h-11/)
  assert.match(trigger.textContent ?? '', /Account/)

  await user.click(trigger)
  assert.equal(trigger.getAttribute('aria-expanded'), 'true')
  assert.equal(trigger.getAttribute('aria-controls'), 'desktop-account-popover')
  assert.equal(trigger.getAttribute('aria-current'), 'true')
  assert.match(trigger.className, /active-row/)

  const popover = view.getByLabelText('Account actions')
  assert.match(popover.textContent ?? '', /Chris/)
  assert.match(popover.textContent ?? '', /Austin Plant Supply/)
  const actions = [
    ...within(popover).getAllByRole('link'),
    ...within(popover).getAllByRole('button'),
  ].sort((left, right) => left.compareDocumentPosition(right) & 2 ? 1 : -1)
  assert.deepEqual(actions.map((action) => action.textContent?.trim()), [
    'Know your Agents', 'Supplier view', 'Log out',
  ])
  for (const action of actions) assert.match(action.className, /min-h-11/)
  const agents = within(popover).getByRole('link', { name: 'Know your Agents' })
  assert.equal(agents.getAttribute('href'), '/agents')

  await user.click(within(popover).getByRole('button', { name: 'Supplier view' }))
  assert.match(popover.textContent ?? '', /stand-in until supplier sign-in exists/)
  const partner = within(popover).getByRole('link', { name: 'Oak Hill' })
  assert.equal(partner.getAttribute('href'), '/partner/7')
  assert.equal(partner.getAttribute('target'), '_blank')
  fireEvent.click(partner)
  assert.equal(view.queryByLabelText('Account actions'), null)
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
})

test('supplier portal shortcuts exclude non-partners eligible for emailed availability requests', async () => {
  const suppliers = await fetchPartnerSuppliers(undefined, async () => Response.json({ suppliers: [
    { id: 1, name: 'Austin Plant Supply', is_lps_partner: true },
    { id: 2, name: 'Grower by email', is_lps_partner: false },
  ] }))
  assert.deepEqual(suppliers.map(({ id }) => id), [1])
})

test('Escape closes account and nested Supplier view and restores trigger focus', async () => {
  const user = userEvent.setup({ document })
  const view = render(<Harness />)
  const trigger = view.getByRole('button', { name: 'Account' })
  await user.click(trigger)
  await user.click(view.getByRole('button', { name: 'Supplier view' }))
  view.getByRole('link', { name: 'Oak Hill' }).focus()
  await user.keyboard('{Escape}')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(view.queryByLabelText('Account actions'), null)
  assert.equal(document.activeElement, trigger)
})

test('outside dismissal is scoped safely and Agents is represented as an active descendant', async () => {
  const user = userEvent.setup({ document })
  const view = render(<Harness page="agents" />)
  const trigger = view.getByRole('button', { name: 'Account' })
  assert.equal(trigger.getAttribute('aria-current'), null)
  assert.match(trigger.className, /idle-row/)
  await user.click(trigger)
  const agents = view.getByRole('link', { name: 'Know your Agents' })
  assert.equal(agents.getAttribute('aria-current'), 'page')
  fireEvent.mouseDown(document.body)
  assert.equal(view.queryByLabelText('Account actions'), null)
})

test('source contracts keep desktop actions singular, mobile More equivalents and lazy supplier loading', () => {
  const shell = readFileSync(new URL('../components/workspace/shell.tsx', import.meta.url), 'utf8')
  const railBottom = shell.slice(shell.indexOf('railBottom='), shell.indexOf('moreTop='))
  const moreBottom = shell.slice(shell.indexOf('moreBottom='), shell.indexOf('mobileBarLeft='))

  assert.match(railBottom, /<AccountRailActions/)
  assert.doesNotMatch(railBottom, /href="\/agents"|Supplier view/)
  assert.match(moreBottom, /href="\/agents"[\s\S]*Know your Agents/)
  assert.match(moreBottom, /toggleSupplierView[\s\S]*Supplier view/)
  assert.match(moreBottom, /Austin Plant Supply[\s\S]*Log out/)
  assert.match(shell, /fetcher\('\/api\/availability-requests\/suppliers', \{ signal \}\)/)
  assert.match(shell, /supplierLoadState === 'idle'\) loadPartnerSuppliers\(\)/)
  assert.match(shell, /href=\{`\/partner\/\$\{supplier\.id\}`\}[\s\S]*target="_blank"/)
  assert.doesNotMatch(shell, /role="menu(?:item)?"/)
})

function BreakpointHarness({ mobile }: { mobile: boolean }) {
  const [account, setAccount] = useState(true)
  const [supplier, setSupplier] = useState(true)
  useBreakpointMenuReset(mobile, setAccount, setSupplier)
  return <div>{String(account)} / {String(supplier)}</div>
}

test('both breakpoint directions clear account and nested supplier state', () => {
  const view = render(<BreakpointHarness mobile={false} />)
  assert.equal(view.container.textContent, 'true / true')
  view.rerender(<BreakpointHarness mobile />)
  assert.equal(view.container.textContent, 'false / false')
  view.unmount()

  const reverse = render(<BreakpointHarness mobile />)
  assert.equal(reverse.container.textContent, 'true / true')
  reverse.rerender(<BreakpointHarness mobile={false} />)
  assert.equal(reverse.container.textContent, 'false / false')
})

test('collapsed trigger shows initials, expanded adds Account, both within 44px rail geometry', () => {
  // The word "Account" clipped to "Accour" in the 40px collapsed rail; the
  // initials disc carries it there, and the accessible name stays Account.
  const collapsed = render(<Harness navOpen={false} />)
  const compact = collapsed.getByRole('button', { name: 'Account' })
  assert.equal(compact.textContent?.trim(), 'C')
  assert.match(compact.className, /min-h-11/)
  assert.match(compact.className, /overflow-hidden/)
  collapsed.unmount()

  const expanded = render(<Harness />)
  const full = expanded.getByRole('button', { name: 'Account' })
  assert.match(full.textContent ?? '', /CAccount/)
  assert.match(full.className, /min-h-11/)
})

test('supplier failures are distinct from empty and Retry remains accessible', async () => {
  await assert.rejects(
    fetchPartnerSuppliers(undefined, async () => new Response('{}', { status: 503 })),
    /Supplier list request failed/,
  )
  await assert.rejects(
    fetchPartnerSuppliers(undefined, async () => { throw new TypeError('network down') }),
    /network down/,
  )

  let retries = 0
  const view = render(
    <SupplierPortalList state="error" suppliers={[]} retry={() => { retries += 1 }} className="partner" onSelect={() => undefined} />,
  )
  const alert = view.getByRole('alert')
  assert.match(alert.textContent ?? '', /Couldn’t load LPS Partners/)
  assert.doesNotMatch(alert.textContent ?? '', /No LPS Partners yet/)
  await userEvent.setup({ document }).click(within(alert).getByRole('button', { name: 'Retry' }))
  assert.equal(retries, 1)

  view.rerender(<SupplierPortalList state="loaded" suppliers={[]} retry={() => undefined} className="partner" onSelect={() => undefined} />)
  assert.match(view.container.textContent ?? '', /No LPS Partners yet/)
  assert.equal(view.queryByRole('alert'), null)
  view.rerender(<SupplierPortalList state="loaded" suppliers={[{ id: 9, name: 'Cedar' }]} retry={() => undefined} className="partner" onSelect={() => undefined} />)
  assert.equal(view.getByRole('link', { name: 'Cedar' }).getAttribute('target'), '_blank')
})
