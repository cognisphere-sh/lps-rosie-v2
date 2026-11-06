import assert from 'node:assert/strict'
import test from 'node:test'
import React, { useState } from 'react'
import { JSDOM } from 'jsdom'

import { PartnerShareMenu } from '../components/workspace/partner-share-menu'
import type { ARDetail } from './availability'
import type { Order } from './orders'

for (const kind of ['order', 'request'] as const) {
  test(`${kind} share menu copies both URLs and priced plant lines, prints, and supports keyboard dismissal`, async () => {
    const dom = new JSDOM('', { url: 'https://lps.example' })
    for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
      HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true })) {
      Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
    }
    const { render, fireEvent, cleanup, waitFor } = await import('@testing-library/react/pure')
    const originalFetch = globalThis.fetch
    const writes: Array<{ url: string; body: unknown }> = []
    const copies: string[] = []
    let failCopy = false
    let failPublish = false
    let prints = 0
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => {
      if (failCopy) throw new Error('Clipboard unavailable. Please try again.')
      copies.push(text)
    } } })
    window.print = () => { prints++ }
    globalThis.fetch = (async (input, init) => {
      writes.push({ url: String(input), body: JSON.parse(String(init?.body)) })
      return failPublish ? Response.json({ error: 'Could not publish' }, { status: 403 }) : Response.json({ publicToken: 'public-token' })
    }) as typeof fetch
    const path = kind === 'order' ? 'orders/69' : 'requests/107'
    const publicPath = kind === 'order' ? 'orders' : 'availability'
    const items = [
      { name: 'Live Oak', size: '30 G', quantity: 12, demandedQuantity: 12, availableQuantity: 4, unitPrice: 125 },
      { name: 'Rose', size: null, quantity: 0, demandedQuantity: null, availableQuantity: null, unitPrice: null },
      { name: 'Sage', size: '1 G', quantity: 1, demandedQuantity: 1, availableQuantity: 1, unitPrice: 0 },
    ].map((item, id) => ({ ...item, id, total: null, status: 'pending', noteForSupplier: null, noteFromSupplier: null }))
    function Fixture({ closed = false }: { closed?: boolean }) {
      const [publicToken, setPublicToken] = useState<string | null>(null)
      const order: Order = { id: 69, supplierId: 1, supplierName: 'Grower', status: 'new', closed, publicToken, items,
        fulfillmentMethod: null, confirmationDate: null, additionalDetails: null, changeLog: null, noteFromSupplier: null,
        availabilityRequestId: null, createdAt: '2026-11-03' }
      const request: ARDetail = { id: 107, supplierId: 1, supplierName: 'Grower', status: closed ? 'closed' : 'new', publicToken, items,
        jobRequestId: null, jobName: null, customer: null, shipping: null, shareCustomerDetails: false, itemCount: 3, answeredCount: 0,
        noteForSupplier: null, submittedAt: null, createdAt: '2026-11-03' }
      return kind === 'order' ? <PartnerShareMenu order={order} onPublicToken={setPublicToken} />
        : <PartnerShareMenu request={request} onPublicToken={setPublicToken} />
    }
    try {
      const view = render(<Fixture />)
      const trigger = view.getByRole('button', { name: 'Share' })
      const open = () => fireEvent.click(trigger)
      const select = (name: string) => fireEvent.click(view.getByRole('menuitem', { name }))
      open()
      assert.equal(writes.length, 0, 'Opening Share must not publish')
      assert.deepEqual(view.getAllByRole('menuitem').map(item => item.textContent), ['Copy public URL', 'Copy private URL', 'Copy text', 'Print PDF'])
      assert.equal(view.getByRole('menu').parentElement, document.body, 'Menu escapes the header clipping')
      assert.equal(document.activeElement, view.getByRole('menuitem', { name: 'Copy public URL' }))
      fireEvent.keyDown(view.getByRole('menu'), { key: 'End' })
      assert.equal(document.activeElement, view.getByRole('menuitem', { name: 'Print PDF' }))
      fireEvent.keyDown(view.getByRole('menu'), { key: 'ArrowDown' })
      assert.equal(document.activeElement, view.getByRole('menuitem', { name: 'Copy public URL' }))
      select('Copy private URL')
      await waitFor(() => assert.ok(view.queryByRole('menu') === null))
      assert.equal(copies.at(-1), `https://lps.example/partner/1/${path}`)
      assert.equal(writes.length, 0)
      open(); select('Copy text')
      await waitFor(() => assert.ok(view.queryByRole('menu') === null))
      assert.equal(copies.at(-1), `12 x 30 G Live Oak $125.00\n${kind === 'order' ? '0' : '—'} x — Rose —\n1 x 1 G Sage $0.00`)
      open(); select('Copy public URL')
      await waitFor(() => assert.ok(view.queryByRole('menu') === null))
      assert.deepEqual(writes, [{ url: `/api/partner/1/${path}`, body: { isPublic: true } }])
      assert.equal(copies.at(-1), `https://lps.example/public/${publicPath}/public-token`)
      open(); select('Copy public URL')
      await waitFor(() => assert.ok(view.queryByRole('menu') === null))
      assert.equal(writes.length, 1, 'Reuse an existing public URL')
      open(); select('Copy private URL')
      await waitFor(() => assert.ok(view.queryByRole('menu') === null))
      assert.equal(writes.length, 1, 'Copying private URL does not revoke the public link')
      open(); select('Print PDF')
      assert.equal(prints, 1)
      assert.equal(view.queryByRole('menu'), null)
      open(); fireEvent.keyDown(view.getByRole('menu'), { key: 'Escape' })
      assert.equal(view.queryByRole('menu'), null)
      assert.equal(document.activeElement, trigger)
      open(); fireEvent.pointerDown(document.body)
      assert.equal(view.queryByRole('menu'), null)
      failCopy = true
      open(); select('Copy text')
      await view.findByRole('alert')
      assert.match(view.getByRole('alert').textContent!, /Clipboard unavailable/)
      cleanup()
      failCopy = false; failPublish = true
      const failed = render(<Fixture />)
      fireEvent.click(failed.getByRole('button', { name: 'Share' }))
      fireEvent.click(failed.getByRole('menuitem', { name: 'Copy public URL' }))
      assert.match((await failed.findByRole('alert')).textContent!, /Could not publish/)
      cleanup()
      const closed = render(<Fixture closed />)
      fireEvent.click(closed.getByRole('button', { name: 'Share' }))
      assert.equal((closed.getByRole('menuitem', { name: 'Copy public URL' }) as HTMLButtonElement).disabled, true)
      assert.equal((closed.getByRole('menuitem', { name: 'Copy private URL' }) as HTMLButtonElement).disabled, false)
      assert.equal((closed.getByRole('menuitem', { name: 'Print PDF' }) as HTMLButtonElement).disabled, false)
    } finally { cleanup(); globalThis.fetch = originalFetch; dom.window.close() }
  })
}
