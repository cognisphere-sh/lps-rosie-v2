import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { afterEach, beforeEach } from 'node:test'
import React, { useState } from 'react'
import { JSDOM } from 'jsdom'
import { cleanup, fireEvent, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { MultiFilter } from '../components/workspace/table-parts.tsx'

let dom: JSDOM

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/plants' })
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

function CultivarHarness() {
  const [selected, setSelected] = useState<string[]>([])
  return (
    <MultiFilter
      allLabel="Cultivar: Any"
      selectionLabel="Cultivar"
      accessibleName="Cultivar"
      options={['Natchez', 'Tuscarora', 'Muskogee']}
      selected={selected}
      onChange={setSelected}
      buttonClassName="min-h-11 px-2 text-[12px]"
      filterPlaceholder="Filter cultivars…"
      restoreFocusOnClose
    />
  )
}

const settleFocus = () => new Promise((resolve) => setTimeout(resolve, 0))

test('Cultivar trigger is a labelled 44px toggle that keeps the dropdown open while selecting', async () => {
  const user = userEvent.setup({ document })
  const view = render(<CultivarHarness />)
  let trigger = view.getByRole('button', { name: 'Cultivar' })

  assert.match(trigger.className, /min-h-11/)
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  await user.click(trigger)
  assert.equal(trigger.getAttribute('aria-expanded'), 'true')

  await user.type(view.getByRole('textbox', { name: 'Filter cultivars…' }), 't')
  assert.equal(view.queryByRole('button', { name: 'Muskogee' }), null)
  await user.click(view.getByRole('button', { name: 'Natchez' }))
  trigger = view.getByRole('button', { name: 'Cultivar, 1 selected' })
  assert.equal(trigger.getAttribute('aria-expanded'), 'true')
  assert.equal(view.getByRole('button', { name: 'Natchez' }).getAttribute('aria-pressed'), 'true')

  await user.clear(view.getByRole('textbox', { name: 'Filter cultivars…' }))
  await user.click(view.getByRole('button', { name: 'Tuscarora' }))
  trigger = view.getByRole('button', { name: 'Cultivar, 2 selected' })
  assert.equal(trigger.getAttribute('aria-expanded'), 'true')
  assert.equal(view.queryByRole('button', { name: /Done|Apply/i }), null)

  await user.click(view.getByRole('button', { name: 'Clear selection' }))
  trigger = view.getByRole('button', { name: 'Cultivar' })
  assert.equal(trigger.getAttribute('aria-expanded'), 'true')
})

test('Cultivar closes from its trigger, Escape, and dismissal and restores trigger focus', async () => {
  const user = userEvent.setup({ document })
  const view = render(<CultivarHarness />)
  const trigger = view.getByRole('button', { name: 'Cultivar' })

  await user.click(trigger)
  await user.click(trigger)
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  assert.equal(document.activeElement, trigger)

  await user.click(trigger)
  view.getByRole('textbox', { name: 'Filter cultivars…' }).focus()
  await user.keyboard('{Escape}')
  await settleFocus()
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  assert.equal(document.activeElement, trigger)

  await user.click(trigger)
  view.getByRole('textbox', { name: 'Filter cultivars…' }).focus()
  fireEvent.mouseDown(document.body)
  await settleFocus()
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  assert.equal(document.activeElement, trigger)
})

test('Plant Search wires the toggle to the existing shared Cultivar column filter', () => {
  const page = readFileSync(new URL('../app/plants/page.tsx', import.meta.url), 'utf8')
  const label = page.indexOf('allLabel="Cultivar"')
  const start = page.lastIndexOf('<MultiFilter', label)
  const cultivar = page.slice(start, page.indexOf('/>', start) + 2)

  assert.ok(label >= 0)
  assert.ok(start >= 0)
  assert.match(cultivar, /accessibleName="Cultivar"/)
  assert.match(cultivar, /buttonClassName="min-h-11/)
  assert.match(cultivar, /aria|restoreFocusOnClose/)
  assert.match(cultivar, /selected=\{cultivarFilter\}/)
  assert.match(cultivar, /setColFilter\('cultivar', next\)/)
  assert.doesNotMatch(cultivar, /Done|Apply/)
})
