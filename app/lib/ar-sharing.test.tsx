import assert from 'node:assert/strict'
import test from 'node:test'
import React, { useState } from 'react'
import { JSDOM } from 'jsdom'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { ARSharing } from '../components/workspace/ar-sharing'

for (const endpoint of ['/api/availability-requests/1', '/api/partner/7/requests/1']) {
test(`Share menu publishes, copies, and revokes through ${endpoint}`, async () => {
  const dom = new JSDOM('<html><body></body></html>', { url: 'https://lps.example' })
  const previous = Object.getOwnPropertyDescriptors(globalThis)
  const copied: string[] = []
  const writes: boolean[] = []
  let fail = false
  let clipboardFails = false
  Object.defineProperty(dom.window.navigator, 'clipboard', { value: { writeText: async (s: string) => { if (clipboardFails) throw new Error('clipboard denied'); copied.push(s) } } })
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  globalThis.fetch = async (url, init) => {
    assert.equal(url, endpoint)
    const { isPublic } = JSON.parse(String(init?.body))
    writes.push(isPublic)
    return Response.json(fail ? { error: 'Save failed' } : { publicToken: isPublic ? 'new-token' : null }, { status: fail ? 400 : 200 })
  }
  function Sharing() {
    const [token, setToken] = useState<string | null>(null)
    return <ARSharing id={1} token={token} closed={false} onChange={setToken} endpoint={endpoint} />
  }
  try {
    const view = render(<Sharing />)
    assert.equal(view.queryByRole('button', { name: 'Make public' }), null)
    fireEvent.click(view.getByRole('button', { name: 'Share' }))
    assert.deepEqual(writes, [])
    fireEvent.click(view.getByRole('button', { name: 'Make public' }))
    await waitFor(() => assert.ok(view.getByRole('button', { name: 'Make private' })))
    assert.deepEqual(copied, ['https://lps.example/public/availability/new-token'])
    await waitFor(() => assert.ok(view.getByRole('button', { name: 'Copied!' })))
    await waitFor(() => assert.ok(view.getByRole('button', { name: 'Copy public URL' })), { timeout: 3000 })
    fireEvent.click(view.getByRole('button', { name: 'Copy public URL' }))
    assert.equal((view.getByRole('button', { name: 'Copying…' }) as HTMLButtonElement).disabled, true)
    await waitFor(() => assert.ok(view.getByRole('button', { name: 'Copied!' })))
    assert.equal(copied.length, 2)
    clipboardFails = true
    fireEvent.click(view.getByRole('button', { name: 'Copied!' }))
    await waitFor(() => assert.match(view.getByRole('status').textContent ?? '', /Could not copy automatically/))
    assert.equal(view.queryByRole('button', { name: 'Copied!' }), null)
    assert.ok(view.getByRole('textbox', { name: 'Public request URL' }))
    fireEvent.click(view.getByRole('button', { name: 'Make private' }))
    await waitFor(() => assert.ok(view.getByRole('button', { name: 'Make public' })))
    assert.equal(view.queryByRole('textbox'), null)
    fail = true
    fireEvent.click(view.getByRole('button', { name: 'Make public' }))
    await waitFor(() => assert.equal(view.getByRole('alert').textContent, 'Save failed'))
    assert.equal(view.queryByRole('textbox'), null)
    assert.deepEqual(writes, [true, false, true])
    fireEvent.keyDown(view.getByRole('button', { name: 'Make public' }), { key: 'Escape' })
    assert.equal(view.queryByRole('region', { name: 'Request sharing' }), null)
    assert.equal(document.activeElement, view.getByRole('button', { name: 'Share' }))
    view.unmount()
    const closed = render(<ARSharing id={1} token={null} closed onChange={() => { throw new Error('unexpected write') }} />)
    fireEvent.click(closed.getByRole('button', { name: 'Share' }))
    assert.equal((closed.getByRole('button', { name: 'Make public' }) as HTMLButtonElement).disabled, true)
  } finally {
    cleanup()
    await new Promise(resolve => setTimeout(resolve, 30))
    dom.window.close()
    for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'fetch']) {
      if (previous[key]) Object.defineProperty(globalThis, key, previous[key])
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})

}
