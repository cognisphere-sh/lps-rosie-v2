import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { JSDOM } from 'jsdom'

import { PWAUpdateBanner } from '../components/pwa/update-banner.tsx'

let dom: JSDOM
let served: string | null
let visibility: 'visible' | 'hidden'

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })
const show = async () => {
  visibility = 'visible'
  await act(async () => { document.dispatchEvent(new dom.window.Event('visibilitychange')) })
  await flush()
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/requests' })
  const win = dom.window
  served = 'build-a'
  visibility = 'visible'
  Object.defineProperty(win.document, 'visibilityState', { configurable: true, get: () => visibility })
  for (const [key, value] of Object.entries({
    window: win, self: win, document: win.document, navigator: win.navigator, HTMLElement: win.HTMLElement,
    Node: win.Node, getComputedStyle: win.getComputedStyle,
    fetch: async () => ({ json: async () => ({ buildId: served }) }),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
})

afterEach(() => { cleanup(); dom.window.close() })

test('a resumed page offers a reload once the server runs a newer build', async () => {
  const view = render(<PWAUpdateBanner />)
  await flush()
  await show()
  assert.equal(view.queryByRole('status'), null, 'same build: no offer')

  served = 'build-b' // deployed while the app sat in the background
  visibility = 'hidden'
  await show()
  assert.match(view.getByRole('status').textContent ?? '', /new version/i)
})

test('dev servers (no build id) never trigger the offer', async () => {
  served = null
  const view = render(<PWAUpdateBanner />)
  await flush()
  served = 'build-b'
  await show()
  // The first real id becomes the baseline rather than a "change".
  assert.equal(view.queryByRole('status'), null)
})
