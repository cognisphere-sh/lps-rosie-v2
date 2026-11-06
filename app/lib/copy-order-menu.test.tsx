import assert from 'node:assert/strict'
import test from 'node:test'
import React, { useState } from 'react'
import { JSDOM } from 'jsdom'

import { CopyOrderMenu } from '../components/workspace/copy-order-menu'
import type { Order } from './orders'

for (const supplierId of [undefined, 7]) {
  test(`${supplierId == null ? 'job' : 'partner'} order menu uses its sharing endpoint and preserves visibility on failures`, async () => {
    const dom = new JSDOM('', { url: 'https://lps.example' })
    for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
      HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true })) {
      Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
    }
    const { render, fireEvent, cleanup, waitFor } = await import('@testing-library/react/pure')
    const originalFetch = globalThis.fetch
    const originalClipboardItem = globalThis.ClipboardItem
    const writes: Array<{ url: string; body: unknown }> = []
    const copies: string[] = []
    const htmlCopies: Array<Record<string, Blob>> = []
    let failSharing = false
    let failCopy = false
    let printed = 0
    Object.defineProperty(globalThis, 'ClipboardItem', { configurable: true, writable: true, value: class {
      constructor(readonly data: Record<string, Blob>) { htmlCopies.push(data) }
    } })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      write: async () => { if (failCopy) throw new Error('Clipboard unavailable') },
      writeText: async (value: string) => { copies.push(value) },
    } })
    globalThis.fetch = (async (input, init) => {
      const body = JSON.parse(String(init?.body))
      writes.push({ url: String(input), body })
      return failSharing ? Response.json({ error: 'Sharing failed. Please try again.' }, { status: 403 })
        : Response.json({ publicToken: body.isPublic ? 'public-token' : null })
    }) as typeof fetch
    function Fixture({ canShare = true, closed = false }: { canShare?: boolean; closed?: boolean }) {
      const [publicToken, setPublicToken] = useState<string | null>(null)
      const order: Order = { id: 42, supplierId: 7, supplierName: 'Grower', status: 'new', publicToken, items: [],
        fulfillmentMethod: null, confirmationDate: null, additionalDetails: null, changeLog: null, noteFromSupplier: null,
        availabilityRequestId: null, createdAt: '', jobNames: ['Courtyard'] }
      return <CopyOrderMenu order={order} supplierId={supplierId} canShare={canShare} closed={closed}
        onPublicToken={setPublicToken} onPrint={() => { printed++ }} />
    }
    try {
      const view = render(<Fixture />)
      const trigger = view.getByRole('button', { name: 'Copy order O-42' })
      const open = () => fireEvent.click(trigger)
      const visibility = () => view.getByRole('switch', { name: 'Public order link' }) as HTMLButtonElement
      open()
      assert.equal(view.getByRole('menu').parentElement, document.body)
      assert.equal(document.activeElement, visibility())
      assert.equal(writes.length, 0)
      fireEvent.keyDown(view.getByRole('menu'), { key: 'End' })
      assert.equal(document.activeElement, view.getByRole('menuitem', { name: 'Print' }))
      fireEvent.keyDown(view.getByRole('menu'), { key: 'ArrowDown' })
      assert.equal(document.activeElement, visibility())
      fireEvent.click(visibility())
      assert.equal(visibility().disabled, true, 'no repeated sharing writes while saving')
      assert.equal((view.getByRole('menuitem', { name: 'Copy HTML' }) as HTMLButtonElement).disabled, true)
      await waitFor(() => assert.equal(visibility().getAttribute('aria-checked'), 'true'))
      assert.deepEqual(writes, [{ url: supplierId == null ? '/api/orders/42' : '/api/partner/7/orders/42', body: { isPublic: true } }])
      fireEvent.click(view.getByRole('menuitem', { name: 'Copy HTML' }))
      await waitFor(() => assert.ok(!view.queryByRole('menu')))
      assert.match(await htmlCopies[0]['text/html'].text(), /href="https:\/\/lps.example\/public\/orders\/public-token"/)
      assert.match(await htmlCopies[0]['text/plain'].text(), /^Courtyard: https:\/\/lps.example\/public\/orders\/public-token\n/)
      assert.equal(document.activeElement, trigger)
      open()
      failSharing = true
      fireEvent.click(visibility())
      assert.match((await view.findByRole('alert')).textContent!, /Sharing failed/)
      assert.equal(visibility().getAttribute('aria-checked'), 'true', 'failed revocation leaves the link public')
      failSharing = false
      fireEvent.click(visibility())
      await waitFor(() => assert.equal(visibility().getAttribute('aria-checked'), 'false'))
      fireEvent.click(view.getByRole('menuitem', { name: 'Copy link' }))
      await waitFor(() => assert.ok(!view.queryByRole('menu')))
      assert.equal(copies.at(-1), 'https://lps.example/partner/7/orders/42')
      failSharing = true
      open()
      fireEvent.click(visibility())
      await view.findByRole('alert')
      assert.equal(visibility().getAttribute('aria-checked'), 'false', 'failed publication leaves the link private')
      failCopy = true
      fireEvent.click(view.getByRole('menuitem', { name: 'Copy HTML' }))
      await waitFor(() => assert.match(view.getByRole('alert').textContent!, /Could not copy order/))
      fireEvent.keyDown(view.getByRole('menu'), { key: 'Escape' })
      assert.ok(!view.queryByRole('menu'))
      assert.equal(document.activeElement, trigger)
      open()
      fireEvent.pointerDown(document.body)
      assert.ok(!view.queryByRole('menu'))
      view.rerender(<Fixture canShare={false} />)
      open()
      assert.equal(visibility().disabled, true)
      fireEvent.click(view.getByRole('menuitem', { name: 'Print' }))
      assert.equal(printed, 1, 'read-only viewers can print')
      view.rerender(<Fixture closed />)
      open()
      assert.equal(visibility().disabled, true)
      assert.equal((view.getByRole('menuitem', { name: 'Copy text' }) as HTMLButtonElement).disabled, false)
    } finally {
      cleanup()
      globalThis.fetch = originalFetch
      globalThis.ClipboardItem = originalClipboardItem
      dom.window.close()
    }
  })
}
