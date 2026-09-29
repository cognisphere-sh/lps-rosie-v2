import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import React from 'react'
import { JSDOM } from 'jsdom'
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ARLineTable, LineStatusPicker } from '../components/workspace/availability.tsx'
import type { ARItem } from './availability.ts'

let dom: JSDOM

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/partner/4/requests/9' })
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

const item = (changes: Partial<ARItem> = {}): ARItem => ({
  id: 19,
  name: 'Live Oak',
  size: '30 G',
  demandedQuantity: 12,
  status: null,
  availableQuantity: null,
  unitPrice: 12.5,
  noteForSupplier: null,
  noteFromSupplier: null,
  ...changes,
})

test('portal picker opens a themed listbox with unanswered plus the five canonical answers in order', async () => {
  const user = userEvent.setup({ document })
  const patches: Array<[number, Record<string, string>]> = []
  const view = render(
    <ARLineTable
      items={[item({ status: 'arriving_soon' })]}
      editable
      design="portal"
      onPatch={async (id, changes) => { patches.push([id, changes]) }}
    />,
  )

  const trigger = view.getByRole('button', { name: 'Line status, Arriving Soon' })
  assert.equal(trigger.getAttribute('aria-haspopup'), 'listbox')
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  assert.equal(view.queryByRole('combobox'), null)

  await user.click(trigger)
  const listbox = view.getByRole('listbox', { name: 'Line status' })
  assert.match(listbox.className, /bg-popover/)
  assert.match(listbox.className, /fixed/)
  const options = within(listbox).getAllByRole('option')
  assert.deepEqual(
    options.map((option) => option.children[1]?.textContent),
    ['Available', 'Unavailable', 'Diff Sz/Qnty/Sub', 'Can Order', 'Arriving Soon', 'Pending'],
  )
  assert.equal(within(listbox).getByRole('option', { name: 'Arriving Soon' }).getAttribute('aria-selected'), 'true')
  assert.match(within(listbox).getByRole('option', { name: 'Unavailable' }).className, /min-h-9/)

  await user.click(within(listbox).getByRole('option', { name: 'Pending' }))
  assert.deepEqual(patches, [[19, { status: '' }]])
  assert.equal(view.queryByRole('listbox'), null)
  assert.equal(document.activeElement, trigger)
})

test('portal picker supports arrow, Enter and Escape while preserving direct Available behavior', async () => {
  const user = userEvent.setup({ document })
  const patches: Array<[number, Record<string, string>]> = []
  const view = render(
    <LineStatusPicker
      item={item()}
      editable
      portal
      onPatch={async (id, changes) => { patches.push([id, changes]) }}
    />,
  )
  const trigger = view.getByRole('button', { name: 'Line status, Pending' })
  trigger.focus()
  await user.keyboard('{ArrowDown}')
  const available = view.getByRole('option', { name: 'Available' })
  assert.equal(document.activeElement, available)
  await user.keyboard('{Enter}')
  assert.deepEqual(patches, [[19, { status: 'available', available_quantity: '12' }]])
  assert.equal(document.activeElement, trigger)

  await user.click(trigger)
  await user.keyboard('{Escape}')
  assert.equal(view.queryByRole('listbox'), null)
  assert.equal(document.activeElement, trigger)
})

test('portal picker keeps follow-up answers in the existing dialog and payload path', async () => {
  const user = userEvent.setup({ document })
  const patches: Array<[number, Record<string, string>]> = []
  const view = render(
    <LineStatusPicker
      item={item()}
      editable
      portal
      onPatch={async (id, changes) => { patches.push([id, changes]) }}
    />,
  )

  await user.click(view.getByRole('button', { name: 'Line status, Pending' }))
  await user.click(view.getByRole('option', { name: 'Can Order' }))
  assert.equal(view.queryByLabelText('Price per unit'), null)
  await user.type(view.getByLabelText('ETA / notes'), 'Ready next week')
  await user.click(view.getByRole('button', { name: 'Save answer' }))
  assert.deepEqual(patches, [[19, { status: 'can_order', note_from_supplier: 'Ready next week' }]])
})

test('Tab and Shift+Tab skip disabled, ancestor-hidden/inert controls and failed focus candidates', async () => {
  const user = userEvent.setup({ document })
  const view = render(
    <>
      <button type="button">Before status</button>
      <div hidden><button type="button">Hidden before</button></div>
      <div inert><button type="button">Inert before</button></div>
      <div aria-hidden="true"><button type="button">Aria-hidden before</button></div>
      <fieldset disabled><button type="button">Fieldset-disabled before</button></fieldset>
      <button type="button" disabled>Disabled before</button>
      <button type="button" data-refuses-focus="before">Refuses focus before</button>
      <LineStatusPicker item={item()} editable portal onPatch={async () => {}} />
      <button type="button" data-refuses-focus="after">Refuses focus after</button>
      <button type="button" disabled>Disabled after</button>
      <fieldset disabled><button type="button">Fieldset-disabled after</button></fieldset>
      <div aria-hidden="true"><button type="button">Aria-hidden after</button></div>
      <div inert><button type="button">Inert after</button></div>
      <div hidden><button type="button">Hidden after</button></div>
      <button type="button">After status</button>
    </>,
  )
  const trigger = view.getByRole('button', { name: 'Line status, Pending' })
  const before = view.getByRole('button', { name: 'Before status' })
  const after = view.getByRole('button', { name: 'After status' })
  for (const candidate of document.querySelectorAll<HTMLElement>('[data-refuses-focus]')) {
    Object.defineProperty(candidate, 'focus', { configurable: true, value() {} })
  }
  assert.equal(document.querySelector<HTMLButtonElement>('fieldset button')?.matches(':disabled'), true)

  await user.click(trigger)
  await user.keyboard('{Tab}')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(view.queryByRole('listbox'), null)
  assert.equal(document.activeElement, after)

  await user.click(trigger)
  await user.keyboard('{Shift>}{Tab}{/Shift}')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(view.queryByRole('listbox'), null)
  assert.equal(document.activeElement, before)
})

test('Tab boundaries close the portal and release focus deterministically', async () => {
  const user = userEvent.setup({ document })
  const forward = render(<LineStatusPicker item={item()} editable portal onPatch={async () => {}} />)
  const forwardTrigger = forward.getByRole('button', { name: 'Line status, Pending' })
  await user.click(forwardTrigger)
  await user.keyboard('{Tab}')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(forward.queryByRole('listbox'), null)
  assert.equal(document.activeElement, document.body)
  forward.unmount()

  const backward = render(<LineStatusPicker item={item()} editable portal onPatch={async () => {}} />)
  const backwardTrigger = backward.getByRole('button', { name: 'Line status, Pending' })
  await user.click(backwardTrigger)
  await user.keyboard('{Shift>}{Tab}{/Shift}')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(backward.queryByRole('listbox'), null)
  assert.equal(document.activeElement, document.body)
})

test('buffered typeahead reaches multi-character matches and repeated letters cycle matches', async () => {
  const user = userEvent.setup({ document })
  const view = render(<LineStatusPicker item={item()} editable portal onPatch={async () => {}} />)
  const trigger = view.getByRole('button', { name: 'Line status, Pending' })

  await user.click(trigger)
  await user.keyboard('ar')
  assert.equal(document.activeElement, view.getByRole('option', { name: 'Arriving Soon' }))

  await user.keyboard('{Escape}')
  await user.click(trigger)
  await user.keyboard('a')
  assert.equal(document.activeElement, view.getByRole('option', { name: 'Available' }))
  await user.keyboard('a')
  assert.equal(document.activeElement, view.getByRole('option', { name: 'Arriving Soon' }))

  await new Promise((resolve) => setTimeout(resolve, 550))
  await user.keyboard('a')
  assert.equal(document.activeElement, view.getByRole('option', { name: 'Available' }))
})

test('ArrowUp wraps and Home, End and Space operate the focused choice', async () => {
  const user = userEvent.setup({ document })
  const view = render(<LineStatusPicker item={item()} editable portal onPatch={async () => {}} />)
  const trigger = view.getByRole('button', { name: 'Line status, Pending' })
  trigger.focus()

  await user.keyboard('{ArrowUp}')
  assert.equal(document.activeElement, view.getByRole('option', { name: 'Arriving Soon' }))
  await user.keyboard('{Home}')
  assert.equal(document.activeElement, view.getByRole('option', { name: 'Available' }))
  await user.keyboard('{End}')
  assert.equal(document.activeElement, view.getByRole('option', { name: 'Pending' }))
  await user.keyboard('{ArrowUp}')
  assert.equal(document.activeElement, view.getByRole('option', { name: 'Arriving Soon' }))
  await user.keyboard(' ')
  assert.equal(view.queryByRole('listbox'), null)
  assert.ok(view.getByRole('button', { name: 'Save answer' }))
})

test('pointer and touch dismissal, repeated opening and portal clicks do not reach the row', async () => {
  const user = userEvent.setup({ document })
  let rowClicks = 0
  const patches: Array<[number, Record<string, string>]> = []
  const view = render(
    <>
      <div onClick={() => { rowClicks += 1 }}>
        <LineStatusPicker
          item={item()}
          editable
          portal
          onPatch={async (id, changes) => { patches.push([id, changes]) }}
        />
      </div>
      <button type="button">Outside picker</button>
    </>,
  )
  const trigger = view.getByRole('button', { name: 'Line status, Pending' })
  const outside = view.getByRole('button', { name: 'Outside picker' })

  await user.click(trigger)
  assert.equal(rowClicks, 0)
  fireEvent.pointerDown(outside, { pointerType: 'touch' })
  assert.equal(view.queryByRole('listbox'), null)

  await user.click(trigger)
  await user.click(trigger)
  assert.equal(view.queryByRole('listbox'), null)
  await user.click(trigger)
  await user.click(view.getByRole('option', { name: 'Available' }))
  assert.equal(rowClicks, 0)
  assert.deepEqual(patches, [[19, { status: 'available', available_quantity: '12' }]])
})

test('portalled surface repositions above or below, clamps to the viewport, and cleans up on unmount', async () => {
  const user = userEvent.setup({ document })
  const view = render(<LineStatusPicker item={item()} editable portal onPatch={async () => {}} />)
  const trigger = view.getByRole('button', { name: 'Line status, Pending' })
  const add = document.addEventListener.bind(document)
  const remove = document.removeEventListener.bind(document)
  let pointerAdds = 0
  let pointerRemoves = 0
  document.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
    if (type === 'pointerdown') pointerAdds += 1
    add(type, listener, options)
  }) as typeof document.addEventListener
  document.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => {
    if (type === 'pointerdown') pointerRemoves += 1
    remove(type, listener, options)
  }) as typeof document.removeEventListener
  let rect = { left: 100, top: 100, right: 220, bottom: 132, width: 120, height: 32 }
  Object.defineProperty(trigger, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ ...rect, x: rect.left, y: rect.top, toJSON: () => ({}) }),
  })
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 500 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 500 })

  await user.click(trigger)
  let listbox = view.getByRole('listbox', { name: 'Line status' })
  assert.equal(listbox.parentElement, document.body)
  assert.match(listbox.className, /z-\[100\]/)
  assert.equal(listbox.style.left, '100px')
  assert.equal(listbox.style.top, '138px')
  assert.equal(listbox.style.width, '196px')
  assert.equal(listbox.style.maxHeight, '228px')
  assert.match(listbox.className, /overflow-y-auto/)

  fireEvent.pointerDown(document.body)
  rect = { left: 210, top: 450, right: 330, bottom: 482, width: 120, height: 32 }
  await user.click(trigger)
  listbox = view.getByRole('listbox', { name: 'Line status' })
  assert.equal(listbox.style.left, '210px')
  assert.equal(listbox.style.top, '216px')

  const assertInsideViewport = () => {
    const left = Number.parseFloat(listbox.style.left)
    const top = Number.parseFloat(listbox.style.top)
    const width = Number.parseFloat(listbox.style.width)
    const height = Number.parseFloat(listbox.style.maxHeight)
    assert.ok(left >= 8)
    assert.ok(top >= 8)
    assert.ok(left + width <= window.innerWidth - 8)
    assert.ok(top + height <= window.innerHeight - 8)
  }

  rect = { left: 200, top: 5, right: 320, bottom: 37, width: 120, height: 32 }
  window.innerWidth = 180
  window.innerHeight = 180
  await act(async () => {
    fireEvent(window, new dom.window.Event('resize'))
    await new Promise((resolve) => setTimeout(resolve, 5))
  })
  assert.equal(listbox.style.left, '8px')
  assert.equal(listbox.style.top, '8px')
  assert.equal(listbox.style.width, '164px')
  assert.equal(listbox.style.maxHeight, '164px')
  assertInsideViewport()

  rect = { left: -40, top: 90, right: 460, bottom: 122, width: 500, height: 32 }
  window.innerWidth = 300
  window.innerHeight = 180
  await act(async () => {
    fireEvent(window, new dom.window.Event('resize'))
    await new Promise((resolve) => setTimeout(resolve, 5))
  })
  assert.equal(listbox.style.width, '284px')
  assertInsideViewport()

  rect = { left: 10, top: 50, right: 130, bottom: 82, width: 120, height: 32 }
  window.innerWidth = 500
  window.innerHeight = 500
  await act(async () => {
    fireEvent.scroll(window)
    await new Promise((resolve) => setTimeout(resolve, 5))
  })
  assert.equal(listbox.style.left, '10px')
  assert.equal(listbox.style.top, '88px')

  rect = { left: -40, top: 90, right: 460, bottom: 122, width: 500, height: 32 }
  window.innerWidth = 300
  window.innerHeight = 180
  await act(async () => {
    fireEvent(window, new dom.window.Event('resize'))
    await new Promise((resolve) => setTimeout(resolve, 5))
  })
  const unavailable = view.getByRole('option', { name: 'Arriving Soon' })
  let scrollCalls = 0
  Object.defineProperty(unavailable, 'scrollIntoView', {
    configurable: true,
    value: () => { scrollCalls += 1 },
  })
  await user.keyboard('{End}{ArrowUp}{ArrowUp}{ArrowDown}')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(document.activeElement, unavailable)
  assert.ok(scrollCalls >= 1)
  await user.keyboard(' ')
  assert.equal(view.queryByRole('listbox'), null)
  assert.ok(view.getByRole('button', { name: 'Save answer' }))

  view.unmount()
  assert.equal(document.querySelector('[role="listbox"]'), null)
  assert.ok(pointerAdds >= 2)
  assert.equal(pointerRemoves, pointerAdds)
  fireEvent.pointerDown(document.body)
  fireEvent(window, new dom.window.Event('resize'))
  fireEvent.scroll(window)
  assert.equal(document.querySelector('[role="listbox"]'), null)
  document.addEventListener = add
  document.removeEventListener = remove
})

test('close, rapid reopen and unmount cancel stale focus and position animation frames', async () => {
  const callbacks = new Map<number, FrameRequestCallback>()
  const cancelled = new Set<number>()
  let nextFrame = 1
  const request = (callback: FrameRequestCallback) => {
    const id = nextFrame++
    callbacks.set(id, callback)
    return id
  }
  const cancel = (id: number) => {
    cancelled.add(id)
    callbacks.delete(id)
  }
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, writable: true, value: request })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, writable: true, value: cancel })
  Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, writable: true, value: request })
  Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, writable: true, value: cancel })

  const user = userEvent.setup({ document })
  const view = render(
    <>
      <LineStatusPicker item={item()} editable portal onPatch={async () => {}} />
      <button type="button">Stable outside focus</button>
    </>,
  )
  const trigger = view.getByRole('button', { name: 'Line status, Pending' })
  const outside = view.getByRole('button', { name: 'Stable outside focus' })

  await user.click(trigger)
  const firstOpenFrames = [...callbacks.keys()]
  assert.ok(firstOpenFrames.length > 0)
  await user.click(trigger)
  assert.equal(callbacks.size, 0)
  assert.ok(firstOpenFrames.every((id) => cancelled.has(id)))
  outside.focus()
  assert.equal(document.activeElement, outside)

  await user.click(trigger)
  const reopenedFrames = [...callbacks.entries()]
  assert.ok(reopenedFrames.length > 0)
  await act(async () => {
    for (const [id, callback] of reopenedFrames) {
      callbacks.delete(id)
      callback(0)
    }
  })
  assert.equal(document.activeElement, view.getByRole('option', { name: 'Pending' }))

  await user.click(trigger)
  await user.click(trigger)
  const unmountFrames = [...callbacks.keys()]
  assert.ok(unmountFrames.length > 0)
  outside.focus()
  view.unmount()
  assert.equal(callbacks.size, 0)
  assert.ok(unmountFrames.every((id) => cancelled.has(id)))
  assert.equal(document.activeElement, document.body)
})

test('admin line picker remains the existing native select', () => {
  const view = render(<LineStatusPicker item={item()} editable onPatch={async () => {}} />)
  const select = view.getByRole('combobox', { name: 'Line status' })
  assert.deepEqual(
    within(select).getAllByRole('option').map((option) => option.textContent),
    ['Available', 'Unavailable', 'Diff Sz/Qnty/Sub', 'Can Order', 'Arriving Soon', 'Pending'],
  )
})

test('desktop admin and supplier lines render the ask and the reply once in the note column', () => {
  const noteForSupplier = 'Single trunk only.\nNo substitutes.'
  const noteFromSupplier = 'Ready next week.\nCall ahead.'
  for (const design of ['default', 'portal'] as const) {
    const view = render(<ARLineTable items={[item({ noteForSupplier, noteFromSupplier })]} design={design} editable={false} />)
    assert.ok(view.getByText('Note'))
    const plantCell = view.getByText(item().name).parentElement!
    const ask = view.getByTitle(noteForSupplier, { normalizer: (value) => value })
    const reply = view.getByTitle(noteFromSupplier, { normalizer: (value) => value })
    assert.equal(plantCell.contains(ask) || plantCell.contains(reply), false)
    assert.equal(ask.textContent, noteForSupplier)
    assert.equal(reply.textContent, noteFromSupplier)
    // LPS's ask is always shown whole; the portal clamps the reply to one line.
    assert.match(ask.className, /whitespace-pre-wrap/)
    if (design === 'portal') assert.match(reply.className, /truncate/)
    else {
      assert.match(reply.className, /whitespace-pre-wrap/)
      assert.doesNotMatch(reply.className, /truncate|line-clamp/)
    }
    view.unmount()
  }
})

test('admins edit the ask through details; supplier replies go through answers', async () => {
  const user = userEvent.setup({ document })
  for (const admin of [true, false]) {
    const patches: Array<[number, Record<string, string>]> = []
    const details: Array<[number, Record<string, string>]> = []
    const view = render(<ARLineTable items={[item({ noteForSupplier: 'Single trunk only.' })]} editable
      onPatch={async (id, changes) => { patches.push([id, changes]) }}
      onPatchDetails={admin ? async (id, changes) => { details.push([id, changes]) } : undefined} />)
    const ask = view.queryByRole('textbox', { name: 'Line 19 note for supplier' })
    if (admin) {
      assert.ok(ask)
      assert.equal(ask.tagName, 'TEXTAREA')
      await user.type(ask, '\nNo substitutes.')
      await user.tab()
      assert.deepEqual(details, [[19, { note_for_supplier: 'Single trunk only.\nNo substitutes.' }]])
    } else {
      assert.equal(ask, null, 'Suppliers read the ask; they cannot edit it')
      assert.ok(view.getByTitle('Single trunk only.'))
    }
    const reply = view.getByRole('textbox', { name: 'Line 19 supplier reply' })
    assert.equal(reply.tagName, 'TEXTAREA')
    assert.match(reply.className, /field-sizing:content/)
    await user.type(reply, 'Ready\nnext week.')
    await user.tab()
    assert.deepEqual(patches, [[19, { note_from_supplier: 'Ready\nnext week.' }]])
    if (!admin) assert.deepEqual(details, [])
    view.unmount()
  }
})

for (const portal of [false, true]) {
  for (const recommend of [false, true]) {
    test(`unavailable asks about a substitute before notes (portal=${portal}, recommend=${recommend})`, async () => {
      const user = userEvent.setup({ document })
      const patches: Array<[number, Record<string, string>]> = []
      const view = render(<LineStatusPicker item={item({ availableQuantity: 12, noteFromSupplier: 'Existing note' })}
        editable portal={portal} onPatch={async (id, changes) => { patches.push([id, changes]) }} />)
      if (portal) {
        await user.click(view.getByRole('button', { name: 'Line status, Pending' }))
        await user.click(view.getByRole('option', { name: 'Unavailable' }))
      } else {
        await user.selectOptions(view.getByRole('combobox'), 'unavailable')
      }
      assert.ok(view.getByText('Would you like to recommend a substitute?'))
      assert.equal(view.queryByRole('textbox'), null)
      assert.deepEqual(patches, [])
      await user.click(view.getByRole('button', { name: recommend ? 'Yes' : 'No' }))
      if (recommend) {
        assert.deepEqual(patches, [])
        const notes = view.getByPlaceholderText('Substitutes welcome — Name, Size @ price $/unit')
        assert.equal(document.activeElement, notes)
        await user.clear(notes)
        await user.type(notes, 'Red Oak, 30 G @ $25/unit')
        await user.click(view.getByRole('button', { name: 'Save answer' }))
        // Unavailable always zeroes quantity and price.
        assert.deepEqual(patches, [[19, { status: 'unavailable', available_quantity: '0', unit_price: '0', note_from_supplier: 'Red Oak, 30 G @ $25/unit' }]])
      } else {
        assert.deepEqual(patches, [[19, { status: 'unavailable', available_quantity: '0', unit_price: '0' }]])
      }
      assert.equal(view.queryByText('Would you like to recommend a substitute?'), null)
      assert.equal(view.queryByRole('textbox'), null)
    })
  }
}

test('diff_size_qty_sub collects the size and price offered, prefilled from the line', async () => {
  const user = userEvent.setup({ document })
  const patches: Array<Record<string, string>> = []
  const view = render(<LineStatusPicker item={item()} editable onPatch={async (_id, changes) => { patches.push(changes) }} />)
  await user.selectOptions(view.getByRole('combobox'), 'diff_size_qty_sub')
  const size = view.getByLabelText('Size you have') as HTMLInputElement
  const price = view.getByLabelText('Price $/unit') as HTMLInputElement
  assert.equal(size.value, '30 G')
  assert.equal(price.value, '12.5')
  await user.clear(size)
  await user.type(size, '45 G')
  await user.clear(price)
  await user.type(price, '40')
  await user.type(view.getByLabelText('What instead'), 'Only 45 G')
  await user.click(view.getByRole('button', { name: 'Save answer' }))
  assert.deepEqual(patches, [{
    status: 'diff_size_qty_sub', note_from_supplier: 'Only 45 G', available_quantity: '12', size: '45 G', unit_price: '40',
  }])
})

for (const status of ['can_order', 'arriving_soon']) {
  test(`${status} collects details without changing the existing price`, async () => {
    const user = userEvent.setup({ document })
    const patches: Array<Record<string, string>> = []
    const view = render(<LineStatusPicker item={item()} editable onPatch={async (_id, changes) => { patches.push(changes) }} />)
    await user.selectOptions(view.getByRole('combobox'), status)
    assert.equal(view.queryByLabelText('Price $/unit'), null)
    await user.click(view.getByRole('button', { name: 'Save answer' }))
    assert.equal(patches.length, 1)
    assert.equal(patches[0].status, status)
    assert.equal(Object.hasOwn(patches[0], 'unit_price'), false)
  })
}
