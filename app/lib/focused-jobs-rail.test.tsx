import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import React, { useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, fireEvent, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JSDOM } from 'jsdom'

import { FocusedJobsRailLayout } from '../components/workspace/focused-jobs-rail.tsx'
import { FOCUSED_JOBS_RAIL_STORE, jobInboxLayout } from './job-inbox.ts'

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
    KeyboardEvent: win.KeyboardEvent,
    getComputedStyle: win.getComputedStyle,
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(callback, 0),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
})

afterEach(() => {
  cleanup()
  dom.window.close()
})

function railElement(container: HTMLElement): HTMLElement {
  const rail = container.querySelector<HTMLElement>('#focused-jobs-rail')
  assert.ok(rail)
  return rail
}

function Harness({ desktop = true, mobile = false, onBack = () => undefined }: { desktop?: boolean; mobile?: boolean; onBack?: () => void }) {
  const [draft, setDraft] = useState('kept')
  return (
    <FocusedJobsRailLayout
      desktop={desktop}
      mobile={mobile}
      onBack={onBack}
      rail={<div><span data-testid="rail-state">{draft}</span><button type="button" onClick={() => setDraft('unchanged state')}>Change rail state</button></div>}
    >
      <main><button type="button">Detail action</button></main>
    </FocusedJobsRailLayout>
  )
}

test('rendered desktop rail persists collapse without navigation or unmounting state and transfers focus', async () => {
  const user = userEvent.setup({ document })
  let backs = 0
  const view = render(<Harness onBack={() => { backs++ }} />)
  const section = view.getByRole('region', { name: 'Active job inbox' })
  await user.click(view.getByRole('button', { name: 'Change rail state' }))
  assert.equal(view.getByTestId('rail-state').textContent, 'unchanged state')

  const back = view.getByRole('button', { name: 'Back to All jobs' })
  const collapse = view.getByRole('button', { name: 'Collapse active jobs' })
  assert.equal(collapse.getAttribute('aria-expanded'), 'true')
  assert.equal(collapse.getAttribute('aria-controls'), section.id)
  assert.equal(back.getAttribute('title'), null)
  assert.equal(back.getAttribute('aria-label'), 'Back to All jobs')
  assert.match(back.className, /size-11/)
  assert.match(collapse.className, /size-11/)
  assert.equal(window.location.href, 'http://localhost/jobs?jr=27')

  await user.click(collapse)
  await new Promise((resolve) => setTimeout(resolve, 0))
  const expand = view.getByRole('button', { name: 'Expand active jobs' })
  assert.equal(document.activeElement, expand)
  assert.equal(expand.getAttribute('aria-expanded'), 'false')
  assert.equal(expand.getAttribute('aria-controls'), section.id)
  assert.match(expand.className, /size-11/)
  assert.match(expand.parentElement?.className ?? '', /w-11/)
  assert.equal(section.getAttribute('aria-hidden'), 'true')
  assert.equal(section.hasAttribute('inert'), true)
  assert.match(section.className, /hidden/)
  assert.equal(view.getByTestId('rail-state').textContent, 'unchanged state')
  assert.equal(window.localStorage.getItem(FOCUSED_JOBS_RAIL_STORE), '0')
  assert.equal(window.location.href, 'http://localhost/jobs?jr=27')

  await user.click(expand)
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(document.activeElement, view.getByRole('button', { name: 'Collapse active jobs' }))
  assert.equal(view.getByTestId('rail-state').textContent, 'unchanged state')
  assert.equal(window.localStorage.getItem(FOCUSED_JOBS_RAIL_STORE), '1')
  await user.click(view.getByRole('button', { name: 'Back to All jobs' }))
  assert.equal(backs, 1)
})

test('SSR and client pre-effect markup are the same neutral hidden shell, never wrong 292px geometry', () => {
  const saved = {
    window: globalThis.window,
    self: globalThis.self,
    document: globalThis.document,
    navigator: globalThis.navigator,
  }
  for (const key of Object.keys(saved) as (keyof typeof saved)[]) delete (globalThis as Record<string, unknown>)[key]
  const ssr = renderToStaticMarkup(<Harness />)
  Object.assign(globalThis, saved)
  const clientPreEffect = renderToStaticMarkup(<Harness />)
  assert.equal(clientPreEffect, ssr)
  assert.match(ssr, /data-rail-state="unresolved"/)
  assert.match(ssr, /aria-hidden="true"/)
  assert.match(ssr, /inert=""/)
  assert.match(ssr, /class="[^"]*hidden/)
  assert.doesNotMatch(ssr, /Collapse active jobs|Expand active jobs/)
})

test('stored collapsed preference resolves before visible render and survives an immediate remount', () => {
  window.localStorage.setItem(FOCUSED_JOBS_RAIL_STORE, '0')
  const first = render(<Harness />)
  assert.ok(first.getByRole('button', { name: 'Expand active jobs' }))
  const firstRail = railElement(first.container)
  assert.equal(firstRail.dataset.railState, 'collapsed')
  assert.equal(first.queryByRole('button', { name: 'Collapse active jobs' }), null)
  first.unmount()

  const remount = render(<Harness />)
  assert.ok(remount.getByRole('button', { name: 'Expand active jobs' }))
  assert.equal(railElement(remount.container).dataset.railState, 'collapsed')
  assert.equal(remount.queryByRole('button', { name: 'Collapse active jobs' }), null)
})

test('absent or throwing storage read defaults expanded; throwing writes keep in-memory toggles working', async () => {
  const expanded = render(<Harness />)
  assert.ok(expanded.getByRole('button', { name: 'Collapse active jobs' }))
  expanded.unmount()

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem() { throw new Error('blocked read') },
      setItem() { throw new Error('blocked write') },
    },
  })
  const fallback = render(<Harness />)
  assert.ok(fallback.getByRole('button', { name: 'Collapse active jobs' }))
  await userEvent.setup({ document }).click(fallback.getByRole('button', { name: 'Collapse active jobs' }))
  assert.ok(fallback.getByRole('button', { name: 'Expand active jobs' }))
})

test('collapsed inert rail is skipped by Tab and arbitrary descendant focus transfers to expand', async () => {
  const user = userEvent.setup({ document })
  const view = render(<Harness />)
  const descendant = view.getByRole('button', { name: 'Change rail state' })
  descendant.focus()
  assert.equal(document.activeElement, descendant)
  fireEvent.click(view.getByRole('button', { name: 'Collapse active jobs' }))
  await new Promise((resolve) => setTimeout(resolve, 0))
  const expand = view.getByRole('button', { name: 'Expand active jobs' })
  assert.equal(document.activeElement, expand)
  assert.equal(railElement(view.container).hasAttribute('inert'), true)
  const focusOrder = [...view.container.querySelectorAll<HTMLButtonElement>('button')]
    .filter((button) => !button.closest('[inert]') && !button.closest('.hidden'))
    .map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim())
  assert.deepEqual(focusOrder, ['Expand active jobs', 'Detail action'])
})

test('899px mobile has no rail geometry or storage access; exact 900px desktop restores 44px collapsed edge', () => {
  let reads = 0
  let writes = 0
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem() { reads++; return '0' },
      setItem() { writes++ },
    },
  })
  const width899 = jobInboxLayout(899)
  const mobile = render(<Harness desktop={width899 === 'desktop'} mobile={width899 === 'mobile'} />)
  assert.equal(mobile.queryByRole('button', { name: /active jobs/i }), null)
  assert.equal(reads, 0)
  assert.equal(writes, 0)
  assert.match(railElement(mobile.container).className, /hidden/)
  mobile.unmount()

  const width900 = jobInboxLayout(900)
  const desktop = render(<Harness desktop={width900 === 'desktop'} mobile={width900 === 'mobile'} />)
  const expand = desktop.getByRole('button', { name: 'Expand active jobs' })
  assert.match(expand.parentElement?.className ?? '', /w-11/)
  assert.match(railElement(desktop.container).className, /min-\[900px\]:w-\[292px\]/)
  assert.equal(reads, 1)
})

test('presentation toggles cause no fetch, history/navigation, reselection or mobile storage write', async () => {
  let fetches = 0
  let pushes = 0
  let replaces = 0
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: () => { fetches++; return Promise.reject(new Error('unexpected')) } })
  const originalPush = window.history.pushState.bind(window.history)
  const originalReplace = window.history.replaceState.bind(window.history)
  window.history.pushState = (...args) => { pushes++; return originalPush(...args) }
  window.history.replaceState = (...args) => { replaces++; return originalReplace(...args) }
  const view = render(<Harness />)
  await userEvent.setup({ document }).click(view.getByRole('button', { name: 'Change rail state' }))
  const stateBefore = view.getByTestId('rail-state').textContent
  await userEvent.setup({ document }).click(view.getByRole('button', { name: 'Collapse active jobs' }))
  await userEvent.setup({ document }).click(view.getByRole('button', { name: 'Expand active jobs' }))
  assert.equal(view.getByTestId('rail-state').textContent, stateBefore)
  assert.equal(window.location.href, 'http://localhost/jobs?jr=27')
  assert.deepEqual({ fetches, pushes, replaces }, { fetches: 0, pushes: 0, replaces: 0 })
})
