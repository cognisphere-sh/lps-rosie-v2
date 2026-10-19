import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { afterEach, beforeEach } from 'node:test'
import React, { useRef, useState } from 'react'
import { renderToString } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  PLANT_ADVANCED_FILTER_KEYS,
  PLANT_QUICK_FILTER_MIN_WIDTH,
  PLANT_TOOLBAR_SELECT_CLASS,
  PlantAdvancedFilters,
  plantFiltersAreCompact,
  usePlantFilterContainer,
} from '../components/workspace/plant-filters.tsx'
import {
  PLANT_COMPANY_PANEL_MAX_WIDTH,
  PLANT_COMPANY_PANEL_MIN_WIDTH,
  PLANT_COMPANY_PANEL_WIDTH,
  usePlantCompanyPanelWidth,
} from '../components/workspace/plant-table.tsx'
import { MultiFilter } from '../components/workspace/table-parts.tsx'
import { PageControls, Toolbar } from '../components/workspace/toolbar.tsx'

let dom: JSDOM
let resizeObservers: MockResizeObserver[]

class MockResizeObserver {
  target: Element | null = null

  constructor(private readonly callback: ResizeObserverCallback) {
    resizeObservers.push(this)
  }

  observedBox: ResizeObserverBoxOptions | undefined

  observe(target: Element, options?: ResizeObserverOptions) {
    this.target = target
    this.observedBox = options?.box
  }

  disconnect() {
    this.target = null
  }

  emit(width: number) {
    if (!this.target) return
    this.callback([{
      target: this.target,
      contentRect: { width },
    } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
}

const resizeContainer = async (width: number) => {
  await act(async () => {
    for (const observer of resizeObservers) observer.emit(width)
  })
}

const raceContainerWidths = async (...widths: number[]) => {
  await act(async () => {
    for (const width of widths) {
      for (const observer of resizeObservers) observer.emit(width)
    }
  })
}

const settleFocus = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

function trackDocumentFilterListeners() {
  const active = new Map<string, Set<EventListenerOrEventListenerObject>>([
    ['mousedown', new Set()],
    ['keydown', new Set()],
  ])
  const originalAdd = document.addEventListener.bind(document) as (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => void
  const originalRemove = document.removeEventListener.bind(document) as (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ) => void
  document.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
    // Count only MultiFilter/useOutsideClose effects, not user-event or React's
    // own document delegation that may be installed lazily by a test action.
    if (new Error().stack?.includes('table-parts.tsx')) active.get(type)?.add(listener)
    originalAdd(type, listener, options)
  }) as typeof document.addEventListener
  document.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => {
    active.get(type)?.delete(listener)
    originalRemove(type, listener, options)
  }) as typeof document.removeEventListener
  return {
    count: (type: 'mousedown' | 'keydown') => active.get(type)?.size ?? 0,
    restore: () => {
      document.addEventListener = originalAdd as typeof document.addEventListener
      document.removeEventListener = originalRemove as typeof document.removeEventListener
    },
  }
}

beforeEach(() => {
  resizeObservers = []
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/plants' })
  const win = dom.window
  for (const [key, value] of Object.entries({
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
    ResizeObserver: MockResizeObserver,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  Object.defineProperty(win.HTMLElement.prototype, 'attachEvent', { configurable: true, value() {} })
  Object.defineProperty(win.HTMLElement.prototype, 'detachEvent', { configurable: true, value() {} })
})

afterEach(() => {
  cleanup()
  dom.window.close()
})

test('advanced Plant Search filter is an active 44px dialog trigger with all moved header filters', async () => {
  const user = userEvent.setup({ document })
  let cleared = 0
  const view = render(
    <PlantAdvancedFilters
      companyOptions={['Oak Hill']}
      companies={['Oak Hill']}
      onCompanies={() => {}}
      plantFilters={{ price: { min: '10' } }}
      onPlantFilter={() => {}}
      cultivarOptions={['Natchez']}
      cultivars={[]}
      onCultivars={() => {}}
      cultivarOpenOwner={null}
      onCultivarOpenOwnerChange={() => {}}
      stateOptions={['TX']}
      states={[]}
      onStates={() => {}}
      compactForFocus={false}
      activeCount={2}
      onClear={() => { cleared += 1 }}
    />,
  )

  const trigger = view.getByRole('button', { name: 'More filters, 2 active' })
  assert.match(trigger.className, /size-11/)
  assert.equal(trigger.getAttribute('title'), 'More filters')
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')

  await user.click(trigger)
  assert.equal(trigger.getAttribute('aria-expanded'), 'true')
  assert.ok(view.getByRole('dialog', { name: 'More filters' }))
  for (const label of ['Company', 'Full Name', 'Common name', 'Botanical name', 'Price', 'Quantity', 'Height', 'Width', 'Caliper', 'Notes', 'Internal notes']) {
    assert.ok(view.getByText(label, { selector: 'span' }))
  }
  assert.equal(view.queryByText('City'), null)
  const compactCopy = view.container.querySelector('[data-plant-compact-filters]')!
  assert.match(compactCopy.className, /@min-\[1024px\]:hidden/)
  assert.equal(compactCopy.hasAttribute('aria-hidden'), false)
  assert.equal(within(compactCopy as HTMLElement).queryByRole('button', { name: /^Size/ }), null)
  assert.equal(within(compactCopy as HTMLElement).queryByRole('button', { name: 'Supplier type' }), null)
  for (const name of ['Cultivar', 'State']) {
    assert.ok(within(compactCopy as HTMLElement).getByRole('button', { name }))
  }

  await user.click(view.getByRole('button', { name: 'Clear all' }))
  assert.equal(cleared, 1)
  await user.keyboard('{Escape}')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  assert.equal(document.activeElement, trigger)
})

const LONG_GEOMETRY_OPTIONS = {
  Cultivar: 'Cultivar with an exceptionally long registered trade name that must remain readable',
  State: 'State or growing region with a deliberately extended display name',
  Company: 'Company with a substantially long legal trading name and nursery division suffix',
} as const

function AdvancedGeometryHarness() {
  const [cultivarOpenOwner, setCultivarOpenOwner] = useState<'wide' | 'compact' | null>(null)
  return (
    <PlantAdvancedFilters
      companyOptions={[LONG_GEOMETRY_OPTIONS.Company]}
      companies={[]}
      onCompanies={() => {}}
      plantFilters={{}}
      onPlantFilter={() => {}}
      cultivarOptions={[LONG_GEOMETRY_OPTIONS.Cultivar]}
      cultivars={[]}
      onCultivars={() => {}}
      cultivarOpenOwner={cultivarOpenOwner}
      onCultivarOpenOwnerChange={setCultivarOpenOwner}
      stateOptions={[LONG_GEOMETRY_OPTIONS.State]}
      states={[]}
      onStates={() => {}}
      compactForFocus
      activeCount={0}
      onClear={() => {}}
    />
  )
}

const rect = (left: number, width: number, top = 0, height = 44) => ({
  x: left,
  y: top,
  left,
  right: left + width,
  top,
  bottom: top + height,
  width,
  height,
  toJSON: () => ({}),
})

test('rendered nested menus stay inside their actual grid cells with long reachable content', async () => {
  const user = userEvent.setup({ document })
  const cases = [
    { container: 390, columns: 1, names: ['Cultivar', 'State', 'Company'] as const },
    { container: 514, columns: 2, names: ['Cultivar', 'State', 'Company'] as const },
    { container: 658, columns: 3, names: ['Cultivar', 'State', 'Company'] as const },
    { container: 1024, columns: 3, names: ['Company'] as const },
  ]

  for (const geometry of cases) {
    const view = render(<AdvancedGeometryHarness />)
    await user.click(view.getByRole('button', { name: 'More filters' }))
    const surface = view.getByRole('dialog', { name: 'More filters' })
    const surfaceWidth = Math.min(geometry.container - 16, 498)
    const surfaceRight = geometry.container - 8
    const surfaceLeft = surfaceRight - surfaceWidth
    Object.defineProperty(surface, 'getBoundingClientRect', {
      configurable: true,
      value: () => rect(surfaceLeft, surfaceWidth),
    })

    const innerWidth = surfaceWidth - 26
    const fieldWidth = (innerWidth - ((geometry.columns - 1) * 12)) / geometry.columns
    for (const [visibleIndex, name] of geometry.names.entries()) {
      const trigger = within(surface).getByRole('button', { name })
      await user.click(trigger)
      const menu = trigger.parentElement?.querySelector('[data-multi-filter-menu]') as HTMLElement | null
      assert.ok(menu, `${name} menu renders at ${geometry.container}px`)
      assert.match(menu.className, /\bw-full\b/)
      assert.match(menu.className, /\bmin-w-0\b/)
      assert.match(menu.className, /\bmax-w-full\b/)

      // At 1024px the compact pair is CSS-hidden, so Company occupies the
      // first advanced-grid cell. At compact widths DOM order equals grid order.
      const gridIndex = geometry.container >= 1024 ? 0 : visibleIndex
      const column = gridIndex % geometry.columns
      const fieldLeft = surfaceLeft + 13 + (column * (fieldWidth + 12))
      const fieldRight = fieldLeft + fieldWidth
      const menuLeft = name === 'State' ? fieldRight - fieldWidth : fieldLeft
      Object.defineProperty(menu, 'getBoundingClientRect', {
        configurable: true,
        value: () => rect(menuLeft, fieldWidth, 44, 220),
      })

      const surfaceBounds = surface.getBoundingClientRect()
      const menuBounds = menu.getBoundingClientRect()
      assert.ok(menuBounds.left >= surfaceBounds.left)
      assert.ok(menuBounds.right <= surfaceBounds.right)
      assert.ok(menuBounds.width <= fieldWidth)

      const search = within(menu).getByRole('textbox')
      assert.match(search.className, /\bmin-w-0\b/)
      const option = within(menu).getByRole('button', { name: LONG_GEOMETRY_OPTIONS[name] })
      assert.equal(option.getAttribute('title'), LONG_GEOMETRY_OPTIONS[name])
      const optionLabel = option.querySelector('span:last-child') as HTMLElement
      assert.match(optionLabel.className, /\bmin-w-0\b/)
      assert.match(optionLabel.className, /\bwhitespace-normal\b/)
      assert.match(optionLabel.className, /\bbreak-words\b/)
      const naturalContentWidth = LONG_GEOMETRY_OPTIONS[name].length * 7 + 44
      const wrappedContentWidth = optionLabel.className.includes('break-words')
        ? fieldWidth
        : naturalContentWidth
      Object.defineProperties(menu, {
        clientWidth: { configurable: true, value: fieldWidth },
        scrollWidth: { configurable: true, value: wrappedContentWidth },
      })
      assert.ok(menu.scrollWidth <= menu.clientWidth)
      assert.doesNotMatch(menu.className, /overflow-x-hidden/)
      await user.click(trigger)
    }
    assert.doesNotMatch(surface.className, /overflow-x-hidden/)
    view.unmount()
  }
})

// Measured Inter 11px medium advances in the real toolbar: labels, and the
// rounded count token (8px padding + 8px per tabular digit).
const LABEL_WIDTH: Record<string, number> = { Size: 25, Cultivar: 42, Type: 27, 'Supplier type': 73, State: 30 }
const tokenWidth = (count: number) => 8 + 8 * String(count).length
// One-pixel borders + inline padding + label + gap + token + gap + 10px chevron.
const renderedFilterWidth = (label: string, count: number, inlinePadding: number) =>
  2 + inlinePadding + LABEL_WIDTH[label] + (count ? 4 + tokenWidth(count) : 0) + 4 + 10

function CompactLabelHarness({ count }: { count: number }) {
  const selected = Array.from({ length: count }, (_, index) => `Option ${index + 1}`)
  const options = Array.from({ length: Math.max(12, count) }, (_, index) => `Option ${index + 1}`)
  return (
    <div className="flex">
      <div data-label-track="size" className="w-[94px]">
        <MultiFilter
          allLabel="Size"
          selectionLabel="Size"
          compactCountLabel="Size"
          accessibleName="Size"
          truncateLabel={false}
          options={options}
          selected={selected}
          onChange={() => {}}
          buttonClassName={PLANT_TOOLBAR_SELECT_CLASS}
        />
      </div>
      <div data-label-track="type" className="w-[106px]">
        <MultiFilter
          allLabel="Type"
          selectionLabel="Type"
          compactCountLabel="Type"
          accessibleName="Supplier type"
          truncateLabel={false}
          options={options}
          selected={selected}
          onChange={() => {}}
          buttonClassName={PLANT_TOOLBAR_SELECT_CLASS}
        />
      </div>
    </div>
  )
}

test('compact Size and Type keep separate collision-free count tokens through realistic maximums', () => {
  for (const count of [0, 12, 999]) {
    const view = render(<CompactLabelHarness count={count} />)
    for (const [kind, visible, accessible] of [
      ['size', 'Size', 'Size'],
      ['type', 'Type', 'Supplier type'],
    ] as const) {
      const track = view.container.querySelector(`[data-label-track="${kind}"]`) as HTMLElement
      const button = within(track).getByRole('button')
      assert.match(button.className, /h-11/)
      assert.match(button.className, /gap-1/)
      assert.match(button.className, /(?:^| )px-2(?: |$)/)
      assert.match(button.className, /rounded-md/)
      assert.match(button.className, /border-input/)
      assert.match(button.className, /bg-background/)
      assert.match(button.className, /text-\[11px\]/)
      assert.match(button.className, /font-medium/)
      const trackWidth = kind === 'size' ? 94 : 106
      assert.match(track.className, new RegExp(`w-\\[${trackWidth}px\\]`))
      assert.equal(button.getAttribute('aria-label'), count ? `${accessible}, ${count} selected` : accessible)
      assert.doesNotMatch(button.textContent ?? '', / · |selected/)

      if (count) {
        const label = button.querySelector('[data-filter-count-label]') as HTMLElement
        const token = button.querySelector('[data-filter-count]') as HTMLElement
        assert.equal(label.textContent, visible)
        assert.equal(token.textContent, String(count))
        assert.match(label.className, /whitespace-nowrap/)
        assert.match(token.className, /flex-none/)
        assert.match(token.className, /tabular-nums/)
        const renderedWidth = renderedFilterWidth(visible, count, 16)
        assert.ok(renderedWidth <= trackWidth, `${visible} + ${count} token + chevron fits ${trackWidth}px (${renderedWidth}px)`)
      } else {
        assert.equal(button.querySelector('[data-filter-count]'), null)
        assert.equal(button.textContent, visible)
      }
    }
    view.unmount()
  }
})

function ContainerModeProbe({
  width,
  panelWidth = PLANT_COMPANY_PANEL_WIDTH,
  summary = '17 Companies: 47/47 Plants',
}: {
  width: number
  panelWidth?: number
  summary?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const compact = usePlantFilterContainer(ref, panelWidth, summary)
  return (
    <div
      ref={(node) => {
        if (node) Object.defineProperty(node, 'clientWidth', { configurable: true, value: width })
        ref.current = node
      }}
      data-container-mode={compact === null ? 'unresolved' : compact ? 'compact' : 'wide'}
      className="@container"
    />
  )
}

test('initial content-box measurement and exact observer widths agree at every required outer width', async () => {
  for (const width of [390, 514, 658, 899, 900, 1024, 1280]) {
    const view = render(<ContainerModeProbe width={width} />)
    await act(async () => {})
    const probe = view.container.querySelector('[data-container-mode]') as HTMLElement
    assert.equal(probe.getAttribute('data-container-mode'), width < 1024 ? 'compact' : 'wide')
    const observer = resizeObservers.at(-1)!
    assert.equal(observer.target, probe)
    assert.equal(observer.observedBox, 'content-box')
    await resizeContainer(width === 1024 ? 900 : 1024)
    assert.equal(probe.getAttribute('data-container-mode'), width === 1024 ? 'compact' : 'wide')
    view.unmount()
  }
})

function ResponsiveToolbarHarness({
  panelWidth = PLANT_COMPANY_PANEL_WIDTH,
  summary = '17 Companies: 47/47 Plants',
  showAction = true,
  initialCounts = {},
}: {
  panelWidth?: number
  summary?: string
  showAction?: boolean
  initialCounts?: Partial<Record<'size' | 'cultivar' | 'type' | 'state', number>>
} = {}) {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const quickFiltersRef = useRef<HTMLDivElement>(null)
  const compactMode = usePlantFilterContainer(toolbarRef, panelWidth, summary)
  const compact = compactMode ?? true
  const forceCompact = compactMode === true
  const values = (label: string, count = 0) => Array.from({ length: count }, (_, index) => `${label} ${index + 1}`)
  const [sizes, setSizes] = useState<string[]>(() => values('Size', initialCounts.size))
  const [cultivars, setCultivars] = useState<string[]>(() => values('Cultivar', initialCounts.cultivar))
  const [types, setTypes] = useState<string[]>(() => values('Type', initialCounts.type))
  const [states, setStates] = useState<string[]>(() => values('State', initialCounts.state))
  const [cultivarOpenOwner, setCultivarOpenOwner] = useState<'wide' | 'compact' | null>(null)
  const activeCount = [sizes, cultivars, types, states].filter((selected) => selected.length > 0).length
  const clearAll = () => {
    setSizes([])
    setCultivars([])
    setTypes([])
    setStates([])
  }

  return (
    <Toolbar
      toolbarRef={toolbarRef}
      containerResponsive
      wideSearchWidth={panelWidth}
      forceCompact={forceCompact}
      placeholder="Plant Search"
      query="thuja"
      onQuery={() => {}}
      controls={
        <>
          <div ref={quickFiltersRef} data-plant-quick-filters className="contents">
            <div
              data-visual-track="size"
              className={forceCompact ? 'w-[94px] flex-none @min-[1024px]:w-[82px] @min-[1024px]:!w-[94px]' : 'w-[94px] flex-none @min-[1024px]:w-[82px]'}
            >
              <MultiFilter
                allLabel="Size"
                compactCountLabel="Size"
                accessibleName="Size"
                options={[...new Set(['1 G', ...sizes])]}
                selected={sizes}
                onChange={setSizes}
                buttonClassName={PLANT_TOOLBAR_SELECT_CLASS}
              />
            </div>
            <div
              data-plant-folded-filter
              data-plant-cultivar
              data-visual-track="cultivar"
              className={forceCompact ? 'hidden w-[107px] flex-none @min-[1024px]:block @min-[1024px]:!hidden' : 'hidden w-[107px] flex-none @min-[1024px]:block'}
            >
              <MultiFilter
                allLabel="Cultivar"
                compactCountLabel="Cultivar"
                accessibleName="Cultivar"
                options={[...new Set(['Natchez', ...cultivars])]}
                selected={cultivars}
                onChange={setCultivars}
                open={cultivarOpenOwner === 'wide'}
                onOpenChange={(next) => setCultivarOpenOwner(next ? 'wide' : null)}
                restoreFocusOnClose
                buttonClassName={PLANT_TOOLBAR_SELECT_CLASS}
              />
            </div>
            <div
              data-visual-track="type"
              className={forceCompact ? 'w-[106px] flex-none @min-[1024px]:w-[102px] @min-[1024px]:!w-[106px]' : 'w-[106px] flex-none @min-[1024px]:w-[102px]'}
            >
              <MultiFilter
                allLabel="Type"
                wideAllLabel="Supplier type"
                accessibleName="Supplier type"
                options={[...new Set(['Grower', ...types])]}
                selected={types}
                onChange={setTypes}
                compactCountLabel="Type"
                buttonClassName={PLANT_TOOLBAR_SELECT_CLASS}
              />
            </div>
            <div
              data-plant-folded-filter
              data-visual-track="state"
              className={forceCompact ? 'hidden w-[87px] flex-none @min-[1024px]:block @min-[1024px]:!hidden' : 'hidden w-[87px] flex-none @min-[1024px]:block'}
            >
              <MultiFilter
                allLabel="State"
                accessibleName="State"
                options={[...new Set(['TX', ...states])]}
                selected={states}
                onChange={setStates}
                compactCountLabel="State"
                buttonClassName={PLANT_TOOLBAR_SELECT_CLASS}
              />
            </div>
          </div>
          <PlantAdvancedFilters
            companyOptions={['Oak Hill']}
            companies={[]}
            onCompanies={() => {}}
            plantFilters={{}}
            onPlantFilter={() => {}}
            cultivarOptions={['Natchez']}
            cultivars={cultivars}
            onCultivars={setCultivars}
            cultivarOpenOwner={cultivarOpenOwner}
            onCultivarOpenOwnerChange={setCultivarOpenOwner}
            stateOptions={['TX']}
            states={states}
            onStates={setStates}
            compactForFocus={compact}
            focusSourceRef={quickFiltersRef}
            activeCount={activeCount}
            onClear={clearAll}
          />
        </>
      }
      rightActions={showAction ? <button type="button">Notifications</button> : undefined}
      hasFilters={activeCount > 0}
      onClear={clearAll}
      showClear={false}
      summary={summary}
    />
  )
}

// Filter buttons are labels (11px medium, sized by the fit budget); the search
// box holds typed text, so it reads at the same 14px as every other search.
const assertUnifiedToolbarChrome = (element: HTMLElement, textControl: false | 'label' | 'search' = false) => {
  assert.match(element.className, /h-11|size-11/)
  assert.match(element.className, /rounded-md/)
  assert.match(element.className, /border/)
  assert.match(element.className, /border-input/)
  assert.match(element.className, /bg-background/)
  assert.match(element.className, /shadow-none/)
  assert.match(element.className, /outline-none/)
  assert.match(element.className, /focus-visible:border-ring/)
  assert.match(element.className, /focus-visible:ring-\[3px\]/)
  if (textControl) {
    assert.match(element.className, /(?:^| )px-2(?: |$)/)
    if (textControl === 'search') {
      assert.match(element.className, /text-\[14px\]/)
      assert.doesNotMatch(element.className, /text-\[11px\]/)
    } else {
      assert.match(element.className, /text-\[11px\]/)
      assert.match(element.className, /font-medium/)
    }
  }
}

const filterButton = (scope: HTMLElement, accessibleName: string) => within(scope).getByRole(
  'button',
  { name: new RegExp(`^${accessibleName}(?:,|$)`) },
)

const assertFilterContentFits = (
  button: HTMLElement,
  visibleLabel: string,
  accessibleName: string,
  count: number,
  trackWidth: number,
  inlinePadding = 16,
) => {
  assertUnifiedToolbarChrome(button, 'label')
  assert.equal(button.getAttribute('aria-label'), count ? `${accessibleName}, ${count} selected` : accessibleName)
  assert.doesNotMatch(button.textContent ?? '', / · |selected/)
  const token = button.querySelector('[data-filter-count]') as HTMLElement | null
  const label = button.querySelector('[data-filter-count-label]') as HTMLElement | null
  if (!count) {
    assert.equal(token, null)
    const renderedWidth = renderedFilterWidth(visibleLabel, 0, inlinePadding)
    assert.ok(renderedWidth <= trackWidth, `${visibleLabel} + chevron fits ${trackWidth}px (${renderedWidth}px)`)
    return
  }
  assert.equal(label?.textContent, visibleLabel)
  assert.equal(token?.textContent, String(count))
  assert.match(label?.className ?? '', /flex-none|whitespace-nowrap/)
  assert.match(token?.className ?? '', /flex-none/)
  assert.match(token?.className ?? '', /tabular-nums/)
  const renderedWidth = renderedFilterWidth(visibleLabel, count, inlinePadding)
  assert.ok(renderedWidth <= trackWidth, `${visibleLabel} + ${count} token + chevron fits ${trackWidth}px (${renderedWidth}px)`)
}

test('rendered toolbar has collision-free 0, two-digit and maximum counts in every responsive state', async () => {
  const scenarios = [
    { counts: {}, expected: { size: 0, cultivar: 0, type: 0, state: 0 } },
    { counts: { size: 12, cultivar: 12, type: 12, state: 12 }, expected: { size: 12, cultivar: 12, type: 12, state: 12 } },
    { counts: { size: 99, cultivar: 999, type: 99, state: 50 }, expected: { size: 99, cultivar: 999, type: 99, state: 50 } },
  ] as const

  for (const { counts, expected } of scenarios) {
    const view = render(<ResponsiveToolbarHarness showAction={false} initialCounts={counts} />)
    const container = view.container.querySelector('[data-responsive-toolbar-container]') as HTMLElement
    const row = view.container.querySelector('[data-responsive-toolbar-row]') as HTMLElement
    const quick = view.container.querySelector('[data-plant-quick-filters]') as HTMLElement
    const search = view.getByRole('textbox', { name: 'Plant Search' })
    const more = view.getByRole('button', { name: /^More filters/ })

    assert.equal(row.querySelector('[data-toolbar-trailing]'), null, 'no empty summary/action flex item')
    assert.equal(row.children.length, 3, 'Search, display:contents filters, and Filters are the only DOM children')
    assert.match(row.className, /flex-nowrap/)
    assert.match(row.className, /items-center/)
    assert.match(row.className, /gap-1/)
    // Phones (container < 600px) wrap once: Search alone, then the filters.
    assert.match(row.className, /@max-\[599px\]:flex-wrap/)
    assert.match(search.parentElement!.className, /@max-\[599px\]:basis-full/)
    assert.match(search.className, /@max-\[599px\]:text-\[16px\]/)
    assert.doesNotMatch(row.className.replace('@max-[599px]:flex-wrap', ''), /flex-wrap|overflow-x/)
    assert.doesNotMatch(container.className, /overflow-x/)
    assertUnifiedToolbarChrome(search, 'search')
    assertUnifiedToolbarChrome(more)
    for (const track of quick.querySelectorAll<HTMLElement>('[data-visual-track]')) {
      assert.match(track.className, /flex-none/, 'fixed filter tracks cannot shrink into their label/token/chevron budget')
    }

    for (const width of [320, 390, 480, 600, 900]) {
      await resizeContainer(width)
      assert.equal(container.getAttribute('data-responsive-compact'), 'true', `${width}px stays folded`)
      const activeTracks = Array.from(quick.children).filter((child) => !child.hasAttribute('data-plant-folded-filter'))
      assert.equal(1 + activeTracks.length + 1, 4, `${width}px has exactly Search + Size + Type + Filters`)
      // Phones wrap Search onto its own row; Size and Type split the second row beside Filters.
      const phoneShare = (width - 16 - (2 * 4) - 44) / 2
      const sizeTrack = width < 600 ? phoneShare : 94
      const typeTrack = width < 600 ? phoneShare : 106
      // The unselected Type label reads "Supplier type" from a 900px container.
      const typeLabel = expected.type || width < 900 ? 'Type' : 'Supplier type'
      assertFilterContentFits(filterButton(quick, 'Size'), 'Size', 'Size', expected.size, sizeTrack)
      assertFilterContentFits(filterButton(quick, 'Supplier type'), typeLabel, 'Supplier type', expected.type, typeTrack)
      for (const folded of quick.querySelectorAll<HTMLElement>('[data-plant-folded-filter]')) {
        assert.match(folded.className, /hidden/)
      }
      if (width >= 600) {
        const singleRowWidth = 16 + 84 + 94 + 106 + 44 + (3 * 4)
        assert.ok(singleRowWidth <= width, `${width}px fits ${singleRowWidth}px of single-row controls`)
      }
    }

    await resizeContainer(1280)
    assert.equal(container.hasAttribute('data-responsive-compact'), false)
    assert.equal(1 + quick.children.length + 1, 6, 'wide layout has Search + four selectors + Filters')
    // Wide quick selectors trim their padding to 6px (px-1.5) to keep the fit budget.
    for (const name of ['Size', 'Cultivar', 'Supplier type', 'State']) {
      assert.match(filterButton(quick, name).className, /@min-\[1024px\]:px-1\.5/)
    }
    assertFilterContentFits(filterButton(quick, 'Size'), 'Size', 'Size', expected.size, 82, 12)
    assertFilterContentFits(filterButton(quick, 'Cultivar'), 'Cultivar', 'Cultivar', expected.cultivar, 107, 12)
    assertFilterContentFits(filterButton(quick, 'Supplier type'), expected.type ? 'Type' : 'Supplier type', 'Supplier type', expected.type, 102, 12)
    assertFilterContentFits(filterButton(quick, 'State'), 'State', 'State', expected.state, 87, 12)
    assertUnifiedToolbarChrome(search, 'search')
    assertUnifiedToolbarChrome(more)
    view.unmount()
  }
})

test('ResizeObserver watches the same unpadded content-box element that owns CSS container queries', () => {
  const view = render(<ResponsiveToolbarHarness />)
  const container = view.container.querySelector('[data-responsive-toolbar-container]')
  const row = view.container.querySelector('[data-responsive-toolbar-row]')
  assert.ok(container)
  assert.ok(row)
  assert.equal(resizeObservers.length, 1)
  assert.equal(resizeObservers[0].target, container)
  assert.equal(resizeObservers[0].observedBox, 'content-box')
  assert.match(container.className, /@container/)
  assert.doesNotMatch(container.className, /px-|py-/)
  assert.match(row.className, /px-2/)
})

test('SSR markup delegates folded-filter visibility to one unpadded CSS container', () => {
  const markup = renderToString(<ResponsiveToolbarHarness />)
  assert.match(markup, /data-responsive-toolbar-container="true" class="@container relative flex-none border-b/)
  assert.match(markup, /data-responsive-toolbar-row="true" class="flex flex-nowrap items-center gap-1 px-2 py-2\.5 @max-\[599px\]:flex-wrap @max-\[599px\]:gap-y-2 @min-\[1024px\]:px-4"/)
  assert.match(markup, /data-plant-quick-filters="true" class="contents"/)
  assert.equal((markup.match(/data-plant-folded-filter="true"/g) ?? []).length, 2)
  assert.match(markup, /data-plant-folded-filter="true"[^>]+class="hidden w-\[107px\] flex-none @min-\[1024px\]:block"/)
  assert.doesNotMatch(markup, /data-plant-(?:quick-filters|folded-filter)[^>]+aria-hidden/)
  assert.doesNotMatch(markup, /data-plant-(?:quick-filters|folded-filter)[^>]+tabindex/)
  assert.doesNotMatch(markup.match(/data-responsive-toolbar-container[^>]+/)?.[0] ?? '', /px-|py-/)
})

test('actual container transitions keep Size and Supplier type visible while folding Cultivar and State', async () => {
  const user = userEvent.setup({ document })
  const view = render(<ResponsiveToolbarHarness />)
  const quick = view.container.querySelector('[data-plant-quick-filters]') as HTMLElement
  const size = within(quick).getByRole('button', { name: 'Size' })
  const supplierType = within(quick).getByRole('button', { name: 'Supplier type' })

  assert.equal(quick.hasAttribute('aria-hidden'), false)
  assert.equal(view.container.querySelector('[data-plant-compact-filters]'), null)
  assert.equal(view.getAllByRole('button', { name: 'Size' }).length, 1)
  assert.equal(view.getAllByRole('button', { name: 'Supplier type' }).length, 1)
  assert.ok(view.getByText('17 Companies: 47/47 Plants'))
  assert.ok(view.getByRole('button', { name: 'Notifications' }))

  await user.click(size)
  await user.click(view.getByRole('button', { name: '1 G' }))
  await user.click(view.getByRole('button', { name: 'More filters, 1 active' }))
  const compact = view.container.querySelector('[data-plant-compact-filters]') as HTMLElement
  assert.match(compact.className, /contents @min-\[1024px\]:hidden/)
  for (const name of ['Cultivar', 'State']) assert.ok(within(compact).getByRole('button', { name }))
  assert.equal(within(compact).queryByRole('button', { name: /^Size/ }), null)
  assert.equal(within(compact).queryByRole('button', { name: 'Supplier type' }), null)
  assert.equal(view.getAllByRole('button', { name: 'Size, 1 selected' }).length, 1)
  assert.equal(view.getAllByRole('button', { name: 'Supplier type' }).length, 1)

  await resizeContainer(1024)
  const wideSize = within(quick).getByRole('button', { name: 'Size, 1 selected' })
  const wideCultivar = within(quick).getByRole('button', { name: 'Cultivar' })
  const wideState = within(quick).getByRole('button', { name: 'State' })
  const wideOrder = [
    view.getByRole('textbox', { name: 'Plant Search' }),
    wideSize,
    wideCultivar,
    supplierType,
    wideState,
    view.getByRole('button', { name: 'More filters, 1 active' }),
    view.getByText('17 Companies: 47/47 Plants'),
    view.getByRole('button', { name: 'Notifications' }),
  ]
  for (let index = 1; index < wideOrder.length; index += 1) {
    assert.ok(wideOrder[index - 1].compareDocumentPosition(wideOrder[index]) & Node.DOCUMENT_POSITION_FOLLOWING)
  }

  wideSize.focus()
  await resizeContainer(658)
  assert.equal(document.activeElement, wideSize)
  assert.ok(view.getByText('17 Companies: 47/47 Plants'))
  assert.ok(view.getByRole('button', { name: 'Notifications' }))

  await resizeContainer(1024)
  wideState.focus()
  await resizeContainer(899)
  const trigger = view.getByRole('button', { name: 'More filters, 1 active' })
  assert.equal(document.activeElement, trigger)
  assert.equal(trigger.getAttribute('aria-expanded'), 'true')

  await user.click(trigger)
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  await resizeContainer(1024)
  await resizeContainer(514)
  assert.equal(view.getByRole('button', { name: 'More filters, 1 active' }).getAttribute('aria-expanded'), 'false')
})

test('controlled Cultivar stays open and moves focus across both copies and crossing races', async () => {
  const user = userEvent.setup({ document })
  const view = render(<ResponsiveToolbarHarness />)
  const wide = view.container.querySelector('[data-plant-quick-filters]') as HTMLElement

  await resizeContainer(1024)
  const wideCultivar = within(wide).getByRole('button', { name: 'Cultivar' })
  await user.click(wideCultivar)
  within(wide).getByRole('textbox', { name: 'Filter suppliers…' }).focus()
  assert.equal(view.getAllByRole('textbox', { name: /Filter (?:suppliers|cultivars)…/ }).length, 1)
  assert.equal(view.container.querySelectorAll('[data-multi-filter-menu]').length, 1)

  await resizeContainer(658)
  await settleFocus()
  const compact = view.container.querySelector('[data-plant-compact-filters]') as HTMLElement
  const compactCultivar = within(compact).getByRole('button', { name: 'Cultivar' })
  assert.equal(compactCultivar.getAttribute('aria-expanded'), 'true')
  assert.equal(wideCultivar.getAttribute('aria-expanded'), 'false')
  assert.equal(document.activeElement, compactCultivar)
  assert.ok(within(compact).getByRole('textbox', { name: 'Filter cultivars…' }))
  assert.equal(view.getAllByRole('textbox', { name: /Filter (?:suppliers|cultivars)…/ }).length, 1)
  assert.equal(view.container.querySelectorAll('[data-multi-filter-menu]').length, 1)

  await resizeContainer(1024)
  await settleFocus()
  assert.equal(wideCultivar.getAttribute('aria-expanded'), 'true')
  assert.equal(compactCultivar.getAttribute('aria-expanded'), 'false')
  assert.equal(document.activeElement, wideCultivar)
  assert.equal(view.getAllByRole('textbox', { name: /Filter (?:suppliers|cultivars)…/ }).length, 1)
  assert.equal(view.container.querySelectorAll('[data-multi-filter-menu]').length, 1)

  await user.click(wideCultivar)
  assert.equal(wideCultivar.getAttribute('aria-expanded'), 'false')
  await resizeContainer(658)
  if (!view.queryByRole('dialog', { name: 'More filters' })) {
    await user.click(view.getByRole('button', { name: 'More filters' }))
  }
  const compactAgain = view.container.querySelector('[data-plant-compact-filters]') as HTMLElement
  const compactCultivarAgain = within(compactAgain).getByRole('button', { name: 'Cultivar' })
  await user.click(compactCultivarAgain)
  within(compactAgain).getByRole('textbox', { name: 'Filter cultivars…' }).focus()
  await resizeContainer(1024)
  await settleFocus()
  assert.equal(wideCultivar.getAttribute('aria-expanded'), 'true')
  assert.equal(document.activeElement, wideCultivar)

  within(wide).getByRole('textbox', { name: 'Filter suppliers…' }).focus()
  await raceContainerWidths(658, 1024, 514)
  await settleFocus()
  assert.equal(compactCultivarAgain.getAttribute('aria-expanded'), 'true')
  assert.equal(wideCultivar.getAttribute('aria-expanded'), 'false')
  assert.equal(document.activeElement, compactCultivarAgain)
  assert.equal(view.getAllByRole('textbox', { name: /Filter (?:suppliers|cultivars)…/ }).length, 1)
  assert.equal(view.container.querySelectorAll('[data-multi-filter-menu]').length, 1)

  Object.defineProperty(compactCultivarAgain, 'getClientRects', {
    configurable: true,
    value: () => [{ width: 1, height: 1 }],
  })
  compactCultivarAgain.focus()
  await user.keyboard('{Escape}')
  await settleFocus()
  assert.equal(compactCultivarAgain.getAttribute('aria-expanded'), 'false')
  assert.equal(document.activeElement, compactCultivarAgain)
  assert.ok(view.getByRole('dialog', { name: 'More filters' }))
  await resizeContainer(1024)
  await resizeContainer(514)
  assert.equal(compactCultivarAgain.getAttribute('aria-expanded'), 'false')
  assert.equal(view.container.querySelectorAll('[id="plant-filters-title"]').length, 1)
})

test('Cultivar owns exactly one menu and one additional outside/Escape listener set across transfers', async () => {
  const user = userEvent.setup({ document })
  const view = render(<ResponsiveToolbarHarness />)
  await resizeContainer(658)
  const listeners = trackDocumentFilterListeners()
  try {
    await user.click(view.getByRole('button', { name: 'More filters' }))
    const dialogListenerCounts = {
      mousedown: listeners.count('mousedown'),
      keydown: listeners.count('keydown'),
    }
    const compact = view.container.querySelector('[data-plant-compact-filters]') as HTMLElement
    await user.click(within(compact).getByRole('button', { name: 'Cultivar' }))
    assert.equal(listeners.count('mousedown'), dialogListenerCounts.mousedown + 1)
    assert.equal(listeners.count('keydown'), dialogListenerCounts.keydown + 1)
    assert.equal(view.getAllByRole('textbox', { name: 'Filter cultivars…' }).length, 1)
    assert.equal(view.container.querySelectorAll('[data-multi-filter-menu]').length, 1)

    await resizeContainer(1024)
    await settleFocus()
    assert.equal(listeners.count('mousedown'), dialogListenerCounts.mousedown + 1)
    assert.equal(listeners.count('keydown'), dialogListenerCounts.keydown + 1)
    assert.equal(view.getAllByRole('textbox', { name: 'Filter suppliers…' }).length, 1)
    assert.equal(view.queryByRole('textbox', { name: 'Filter cultivars…' }), null)
    assert.equal(view.container.querySelectorAll('[data-multi-filter-menu]').length, 1)

    await raceContainerWidths(900, 1024, 1280, 514)
    await settleFocus()
    assert.equal(listeners.count('mousedown'), dialogListenerCounts.mousedown + 1)
    assert.equal(listeners.count('keydown'), dialogListenerCounts.keydown + 1)
    assert.equal(view.getAllByRole('textbox', { name: 'Filter cultivars…' }).length, 1)
    assert.equal(view.container.querySelectorAll('[data-multi-filter-menu]').length, 1)

    await raceContainerWidths(1024, 900, 514, 1280)
    await settleFocus()
    assert.equal(listeners.count('mousedown'), dialogListenerCounts.mousedown + 1)
    assert.equal(listeners.count('keydown'), dialogListenerCounts.keydown + 1)
    assert.equal(view.getAllByRole('textbox', { name: 'Filter suppliers…' }).length, 1)
    assert.equal(view.container.querySelectorAll('[data-multi-filter-menu]').length, 1)

    await raceContainerWidths(900, 1024, 658)
    await settleFocus()
    assert.equal(listeners.count('mousedown'), dialogListenerCounts.mousedown + 1)
    assert.equal(listeners.count('keydown'), dialogListenerCounts.keydown + 1)
    assert.equal(view.getAllByRole('textbox', { name: 'Filter cultivars…' }).length, 1)
    assert.equal(view.container.querySelectorAll('[data-multi-filter-menu]').length, 1)

    const activeCultivar = within(view.container.querySelector('[data-plant-compact-filters]') as HTMLElement)
      .getByRole('button', { name: 'Cultivar' })
    Object.defineProperty(activeCultivar, 'getClientRects', {
      configurable: true,
      value: () => [{ width: 82, height: 44 }],
    })
    activeCultivar.focus()
    await act(async () => {
      activeCultivar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    await settleFocus()
    assert.equal(listeners.count('mousedown'), dialogListenerCounts.mousedown)
    assert.equal(listeners.count('keydown'), dialogListenerCounts.keydown)
    assert.ok(view.getByRole('dialog', { name: 'More filters' }))
    assert.equal(view.container.querySelectorAll('[data-multi-filter-menu]').length, 0)
    view.unmount()
    assert.equal(listeners.count('mousedown'), 0)
    assert.equal(listeners.count('keydown'), 0)
  } finally {
    listeners.restore()
  }
})

test('generation-aware focus scheduling drops stale crossings, close races and unmounted callbacks', async () => {
  let nextFrame = 1
  const frames = new Map<number, FrameRequestCallback>()
  const cancelled = new Set<number>()
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    const id = nextFrame
    nextFrame += 1
    frames.set(id, callback)
    return id
  }) as typeof requestAnimationFrame
  globalThis.cancelAnimationFrame = ((id: number) => {
    cancelled.add(id)
  }) as typeof cancelAnimationFrame
  const activeFrameCount = () => [...frames.keys()].filter((id) => !cancelled.has(id)).length
  const flushEveryFrame = async () => {
    const pending = [...frames.entries()]
    frames.clear()
    cancelled.clear()
    await act(async () => {
      for (const [, callback] of pending) callback(Date.now())
    })
  }

  const user = userEvent.setup({ document })

  // Each resize is its own committed React update; no frame flushes between
  // them. Even if a cancelled browser callback were to run, generation and
  // current mode/owner checks permit only the latest wide transfer to focus.
  const crossings = render(<ResponsiveToolbarHarness />)
  await resizeContainer(1024)
  const crossingWide = within(crossings.container.querySelector('[data-plant-quick-filters]') as HTMLElement)
    .getByRole('button', { name: 'Cultivar' })
  await user.click(crossingWide)
  await resizeContainer(899)
  const crossingCompact = within(crossings.container.querySelector('[data-plant-compact-filters]') as HTMLElement)
    .getByRole('button', { name: 'Cultivar' })
  const crossingAttempts: string[] = []
  Object.defineProperty(crossingWide, 'focus', { configurable: true, value: () => crossingAttempts.push('wide') })
  Object.defineProperty(crossingCompact, 'focus', { configurable: true, value: () => crossingAttempts.push('compact') })
  await resizeContainer(1024)
  await resizeContainer(899)
  await resizeContainer(1024)
  assert.equal(activeFrameCount(), 1)
  await flushEveryFrame()
  assert.deepEqual(crossingAttempts, ['wide'])
  crossings.unmount()

  // Closing the compact surface before its transfer frame flushes cancels that
  // focus and schedules only the still-valid advanced-trigger return.
  const closing = render(<ResponsiveToolbarHarness />)
  await resizeContainer(1024)
  const closingWide = within(closing.container.querySelector('[data-plant-quick-filters]') as HTMLElement)
    .getByRole('button', { name: 'Cultivar' })
  await user.click(closingWide)
  await resizeContainer(899)
  const closingCompact = within(closing.container.querySelector('[data-plant-compact-filters]') as HTMLElement)
    .getByRole('button', { name: 'Cultivar' })
  const closingAdvanced = closing.getByRole('button', { name: 'More filters' })
  const closingAttempts: string[] = []
  Object.defineProperty(closingCompact, 'focus', { configurable: true, value: () => closingAttempts.push('compact') })
  Object.defineProperty(closingAdvanced, 'focus', { configurable: true, value: () => closingAttempts.push('advanced') })
  await user.click(closingAdvanced)
  closingAttempts.length = 0
  assert.equal(activeFrameCount(), 1)
  await flushEveryFrame()
  assert.deepEqual(closingAttempts, ['advanced'])
  closing.unmount()

  // Unmount invalidates and cancels the pending owner-transfer generation.
  const unmounting = render(<ResponsiveToolbarHarness />)
  await resizeContainer(1024)
  const unmountWide = within(unmounting.container.querySelector('[data-plant-quick-filters]') as HTMLElement)
    .getByRole('button', { name: 'Cultivar' })
  await user.click(unmountWide)
  await resizeContainer(899)
  const unmountCompact = within(unmounting.container.querySelector('[data-plant-compact-filters]') as HTMLElement)
    .getByRole('button', { name: 'Cultivar' })
  const unmountAttempts: string[] = []
  Object.defineProperty(unmountCompact, 'focus', { configurable: true, value: () => unmountAttempts.push('compact') })
  assert.equal(activeFrameCount(), 1)
  unmounting.unmount()
  assert.equal(activeFrameCount(), 0)
  await flushEveryFrame()
  assert.deepEqual(unmountAttempts, [])
})

test('simultaneous outside dismissal discards stale advanced focus before Cultivar reopens', async () => {
  let nextFrame = 1
  const frames = new Map<number, FrameRequestCallback>()
  const cancelled = new Set<number>()
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    const id = nextFrame
    nextFrame += 1
    frames.set(id, callback)
    return id
  }) as typeof requestAnimationFrame
  globalThis.cancelAnimationFrame = ((id: number) => {
    cancelled.add(id)
  }) as typeof cancelAnimationFrame
  const flushEveryFrame = async () => {
    const pending = [...frames.values()]
    frames.clear()
    cancelled.clear()
    await act(async () => {
      for (const callback of pending) callback(Date.now())
    })
  }

  const user = userEvent.setup({ document })
  const view = render(<ResponsiveToolbarHarness />)
  await resizeContainer(658)
  await user.click(view.getByRole('button', { name: 'More filters' }))
  const compactCultivar = within(view.container.querySelector('[data-plant-compact-filters]') as HTMLElement)
    .getByRole('button', { name: 'Cultivar' })
  await user.click(compactCultivar)
  await resizeContainer(1024)
  // Leave the valid wide-transfer frame queued. The outside dismissal below
  // must cancel it, and the test later invokes that cancelled callback too.

  const wideCultivar = within(view.container.querySelector('[data-plant-quick-filters]') as HTMLElement)
    .getByRole('button', { name: 'Cultivar' })
  Object.defineProperty(wideCultivar, 'getClientRects', {
    configurable: true,
    value: () => [{ width: 100, height: 44 }],
  })
  const more = view.getByRole('button', { name: 'More filters' })
  const focusAttempts: string[] = []
  Object.defineProperty(wideCultivar, 'focus', { configurable: true, value: () => focusAttempts.push('cultivar') })
  Object.defineProperty(more, 'focus', { configurable: true, value: () => focusAttempts.push('more') })

  // One real pointer-down reaches both document-level outside handlers: More
  // closes with a provisional return intent while wide Cultivar clears owner.
  await act(async () => {
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  })
  assert.equal(view.queryByRole('dialog', { name: 'More filters' }), null)
  assert.equal(wideCultivar.getAttribute('aria-expanded'), 'false')
  assert.ok(cancelled.size >= 1, 'the now-mismatched advanced return frame is cancelled')

  await user.click(wideCultivar)
  focusAttempts.length = 0
  assert.equal(wideCultivar.getAttribute('aria-expanded'), 'true')
  assert.equal(view.queryByRole('dialog', { name: 'More filters' }), null)
  await flushEveryFrame() // deliberately invokes cancelled callbacks too
  assert.doesNotMatch(focusAttempts.join(','), /more/)
  assert.equal(wideCultivar.getAttribute('aria-expanded'), 'true')
})

test('base 1024px branch and content-aware overflow threshold are deterministic', () => {
  const summary = '17 Companies: 47/47 Plants'
  assert.equal(PLANT_QUICK_FILTER_MIN_WIDTH, 1024)
  for (const width of [390, 514, 658, 899, 900]) {
    assert.equal(plantFiltersAreCompact(width, PLANT_COMPANY_PANEL_WIDTH, summary), true)
  }
  for (const width of [1024, 1200, 1280]) {
    assert.equal(plantFiltersAreCompact(width, PLANT_COMPANY_PANEL_WIDTH, summary), false)
  }
})

test('pager renders as a compact footer control instead of consuming the top-row budget', () => {
  const view = render(<PageControls page={2} pageCount={3} onPage={() => {}} />)
  assert.ok(view.getByRole('button', { name: 'Previous page' }))
  assert.ok(view.getByText('Page 2 of 3'))
  assert.ok(view.getByRole('button', { name: 'Next page' }))
})

function LivePanelWidthHarness({ summary = '17 Companies: 47/47 Plants' }: { summary?: string } = {}) {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const { panelWidth, startPanelResize } = usePlantCompanyPanelWidth()
  const compactMode = usePlantFilterContainer(toolbarRef, panelWidth, summary)
  return (
    <>
      <Toolbar
        toolbarRef={toolbarRef}
        containerResponsive
        wideSearchWidth={panelWidth}
        forceCompact={compactMode === true}
        placeholder="Plant Search"
        query="thuja"
        onQuery={() => {}}
        rightActions={<button type="button">Notifications</button>}
        hasFilters={false}
        onClear={() => {}}
        showClear={false}
        summary={summary}
      />
      <div data-company-track style={{ width: panelWidth, minWidth: panelWidth }}>
        <button type="button" onMouseDown={startPanelResize}>Resize Company</button>
      </div>
    </>
  )
}

test('live Company resize drives the same rendered wide Search track at min, default and max', async () => {
  const view = render(<LivePanelWidthHarness />)
  await resizeContainer(1280)
  const search = view.getByRole('textbox', { name: 'Plant Search' }).parentElement as HTMLElement
  const company = view.container.querySelector('[data-company-track]') as HTMLElement
  const resize = view.getByRole('button', { name: 'Resize Company' })
  const assertSharedWidth = (expected: number) => {
    assert.equal(company.style.width, `${expected}px`)
    assert.equal(search.style.getPropertyValue('--toolbar-wide-search-width'), `${expected}px`)
  }

  assertSharedWidth(PLANT_COMPANY_PANEL_WIDTH)
  fireEvent.mouseDown(resize, { clientX: 100 })
  fireEvent.mouseMove(document, { clientX: -1000 })
  fireEvent.mouseUp(document)
  assertSharedWidth(PLANT_COMPANY_PANEL_MIN_WIDTH)

  fireEvent.mouseDown(resize, { clientX: 100 })
  fireEvent.mouseMove(document, { clientX: 100 + (PLANT_COMPANY_PANEL_WIDTH - PLANT_COMPANY_PANEL_MIN_WIDTH) })
  fireEvent.mouseUp(document)
  assertSharedWidth(PLANT_COMPANY_PANEL_WIDTH)
  await resizeContainer(1024)
  assert.equal(view.container.querySelector('[data-responsive-toolbar-container]')?.hasAttribute('data-responsive-compact'), false)
  await resizeContainer(1280)

  fireEvent.mouseDown(resize, { clientX: 100 })
  fireEvent.mouseMove(document, { clientX: 2000 })
  fireEvent.mouseUp(document)
  assertSharedWidth(PLANT_COMPANY_PANEL_MAX_WIDTH)

  await resizeContainer(1024)
  assert.equal(view.container.querySelector('[data-responsive-toolbar-container]')?.getAttribute('data-responsive-compact'), 'true')
  await resizeContainer(1280)
  assert.equal(view.container.querySelector('[data-responsive-toolbar-container]')?.hasAttribute('data-responsive-compact'), false)
})

test('content-aware fit covers long exact summaries, live panel widths and rapid container races', async () => {
  const ordinary = '17 Companies: 47/47 Plants'
  const long = '300 Companies: 300/12,345 Plants'
  const larger = '12,345 Companies: 98,765/1,234,567 Plants'
  const summaries = [ordinary, long, larger]
  const panels = [PLANT_COMPANY_PANEL_MIN_WIDTH, PLANT_COMPANY_PANEL_WIDTH, PLANT_COMPANY_PANEL_MAX_WIDTH]
  const expected = new Map<number, boolean[][]>([
    [900, [[true, true, true], [true, true, true], [true, true, true]]],
    [1024, [[false, false, false], [false, true, true], [true, true, true]]],
    [1280, [[false, false, false], [false, false, false], [false, false, false]]],
  ])
  for (const [container, rows] of expected) {
    assert.deepEqual(
      panels.map((panel) => summaries.map((summary) => plantFiltersAreCompact(container, panel, summary))),
      rows,
      `${container}px fit matrix`,
    )
  }

  const view = render(<ContainerModeProbe width={1024} panelWidth={PLANT_COMPANY_PANEL_MAX_WIDTH} summary={long} />)
  await act(async () => {})
  const probe = view.container.querySelector('[data-container-mode]') as HTMLElement
  assert.equal(probe.getAttribute('data-container-mode'), 'compact')
  await raceContainerWidths(1280, 900, 1024, 1280)
  assert.equal(probe.getAttribute('data-container-mode'), 'wide')
  await raceContainerWidths(1024, 1280, 900, 1024)
  assert.equal(probe.getAttribute('data-container-mode'), 'compact')
})

test('wide Search uses the authoritative Company-panel track and leaves a clipping-safe summary budget', async () => {
  const view = render(<ResponsiveToolbarHarness />)
  await resizeContainer(1024)
  const search = view.getByRole('textbox', { name: 'Plant Search' }).parentElement as HTMLElement
  const row = view.container.querySelector('[data-responsive-toolbar-row]') as HTMLElement
  assert.equal(search.getAttribute('data-toolbar-search'), 'true')
  assert.equal(search.style.getPropertyValue('--toolbar-wide-search-width'), `${PLANT_COMPANY_PANEL_WIDTH}px`)
  assert.match(search.className, /@min-\[1024px\]:ml-px/)
  assert.match(search.className, /@min-\[1024px\]:w-\[var\(--toolbar-wide-search-width\)\]/)
  assert.match(search.className, /@min-\[1024px\]:flex-none/)
  assert.match(row.className, /@min-\[1024px\]:px-4/)

  // The result card starts at mx-4 (16px); its one-pixel border puts the
  // Company track at 17px. Wide toolbar px-4 + ml-px yields the same edges.
  const companyTrack = rect(16 + 1, PLANT_COMPANY_PANEL_WIDTH)
  const searchTrack = rect(16 + 1, PLANT_COMPANY_PANEL_WIDTH)
  assert.equal(searchTrack.left, companyTrack.left)
  assert.equal(searchTrack.right, companyTrack.right)

  const wideWidths = [82, 107, 102, 87]
  const fixedWithoutSummary = 32 + 1 + (6 * 4) + PLANT_COMPANY_PANEL_WIDTH +
    wideWidths.reduce((sum, width) => sum + width, 0) + 44 + 44 + 6
  const summaryWidth = '17 Companies: 47/47 Plants'.length * 6.5
  assert.ok(summaryWidth <= 1024 - fixedWithoutSummary)
  assert.equal(plantFiltersAreCompact(899, PLANT_COMPANY_PANEL_WIDTH, '17 Companies: 47/47 Plants'), true)
  assert.equal(plantFiltersAreCompact(900, PLANT_COMPANY_PANEL_WIDTH, '17 Companies: 47/47 Plants'), true)
  assert.equal(plantFiltersAreCompact(1024, PLANT_COMPANY_PANEL_WIDTH, '17 Companies: 47/47 Plants'), false)
})

test('Plant Search source keeps the approved visible order and removes every table-head filter', () => {
  const page = readFileSync(new URL('../app/plants/page.tsx', import.meta.url), 'utf8')
  const controls = page.slice(page.indexOf('controls={'), page.indexOf('hasFilters={hasFilters}'))
  const ordered = [
    'allLabel="Size"',
    'allLabel="Cultivar"',
    'allLabel="Type"',
    'allLabel="State"',
    '<PlantAdvancedFilters',
  ].map((token) => controls.indexOf(token))

  assert.ok(ordered.every((position) => position >= 0))
  assert.deepEqual([...ordered].sort((a, b) => a - b), ordered)
  assert.doesNotMatch(controls, /cities|City/)
  assert.match(page, /<PlantHeaderRow[^>]+showFilters=\{false\}/)
  assert.doesNotMatch(page, /allLabel="All companies"/)
  assert.match(page, /Companies: \$\{shownPlants\.toLocaleString\('en-US'\)\}\/\$\{total\.toLocaleString\('en-US'\)\} Plants/)
  assert.doesNotMatch(page.slice(page.indexOf('<Toolbar'), page.indexOf('/>', page.indexOf('<Toolbar'))), /pagination=/)
  assert.match(page, /data-plant-pagination="footer"/)
  assert.match(page, /pageCount > 1/)
  assert.equal(page.match(/\{resultPager\}/g)?.length, 2)
  assert.deepEqual(PLANT_ADVANCED_FILTER_KEYS, [
    'name', 'common_name', 'botanical_name', 'price', 'qty', 'h', 'w', 'cal', 'notes', 'internal_notes',
  ])
})

test('container source contracts fit the exact compact and wide rows without clipping or viewport JS', () => {
  const page = readFileSync(new URL('../app/plants/page.tsx', import.meta.url), 'utf8')
  const controls = page.slice(page.indexOf('controls={'), page.indexOf('hasFilters={hasFilters}'))
  const filters = readFileSync(new URL('../components/workspace/plant-filters.tsx', import.meta.url), 'utf8')
  const toolbar = readFileSync(new URL('../components/workspace/toolbar.tsx', import.meta.url), 'utf8')
  const tableParts = readFileSync(new URL('../components/workspace/table-parts.tsx', import.meta.url), 'utf8')
  const plantTable = readFileSync(new URL('../components/workspace/plant-table.tsx', import.meta.url), 'utf8')

  assert.match(plantTable, /export const PLANT_COMPANY_PANEL_MIN_WIDTH = 200/)
  assert.match(plantTable, /export const PLANT_COMPANY_PANEL_WIDTH = 292/)
  assert.match(plantTable, /export const PLANT_COMPANY_PANEL_MAX_WIDTH = 480/)
  assert.match(plantTable, /export function usePlantCompanyPanelWidth\(\)/)
  assert.match(page, /usePlantCompanyPanelWidth\(\)/)
  assert.match(page, /wideSearchWidth=\{panelW\}/)
  assert.match(page, /forceCompact=\{forceCompactToolbar\}/)
  assert.match(page, /className="mx-4 mb-4 mt-3[^"\n]+border border-border/)
  assert.ok((page.match(/style=\{\{ width: panelW, minWidth: panelW \}\}/g) ?? []).length >= 2)
  assert.match(controls, /data-plant-quick-filters[^>]+className="contents"/)
  assert.equal((controls.match(/data-plant-folded-filter/g) ?? []).length, 2)
  assert.equal((controls.match(/hidden w-\[\d+px\] flex-none @min-\[1024px\]:block/g) ?? []).length, 2)
  assert.match(controls, /w-\[94px\] flex-none @max-\[599px\]:flex-1 @min-\[1024px\]:w-\[82px\]/)
  assert.match(controls, /hidden w-\[107px\] flex-none @min-\[1024px\]:block/)
  assert.match(controls, /w-\[106px\] flex-none @max-\[599px\]:flex-1 @min-\[1024px\]:w-\[102px\]/)
  assert.match(controls, /hidden w-\[87px\] flex-none @min-\[1024px\]:block/)
  assert.equal((controls.match(/@min-\[1024px\]:!hidden/g) ?? []).length, 2)
  assert.equal((controls.match(/@min-\[1024px\]:!w-\[94px\]/g) ?? []).length, 1)
  assert.equal((controls.match(/@min-\[1024px\]:!w-\[106px\]/g) ?? []).length, 1)
  assert.equal((controls.match(/compactCountLabel="(?:Size|Cultivar|Type|State)"/g) ?? []).length, 4)
  assert.match(controls, /wideAllLabel="Supplier type"/)
  assert.equal((controls.match(/truncateLabel=\{false\}/g) ?? []).length, 4)
  assert.equal((controls.match(/buttonClassName=\{PLANT_TOOLBAR_SELECT_CLASS\}/g) ?? []).length, 4)
  assert.match(filters, /PLANT_TOOLBAR_SELECT_CLASS = 'h-11 gap-1 rounded-md border-input bg-background px-2 @min-\[1024px\]:px-1\.5 \[\[data-responsive-compact\]_&\]:px-2 text-\[11px\] font-medium shadow-none[^'\n]+dark:bg-background'/)
  assert.match(filters, /PLANT_TOOLBAR_SELECT_CLASS[^\n]+focus-visible:border-ring[^\n]+focus-visible:ring-\[3px\]/)
  assert.match(filters, /size-11[^'\n]+rounded-md[^'\n]+border-input[^'\n]+bg-background[^'\n]+shadow-none/)
  assert.match(filters, /cn\('contents @min-\[1024px\]:hidden', compactForFocus && '@min-\[1024px\]:!contents'\)/)
  assert.match(filters, /right-2[^"\n]+w-\[calc\(100cqw-1rem\)\] max-w-\[498px\][^"\n]+overflow-y-auto/)
  assert.doesNotMatch(filters, /max-w-\[498px\][^"\n]+overflow-x-hidden/)
  assert.equal((filters.match(/menuClassName="w-full min-w-0 max-w-full"/g) ?? []).length, 3)
  assert.doesNotMatch(filters, /menuClassName="[^"]*(?:100vw|w-max)/)
  assert.equal((controls.match(/menuClassName="w-max min-w-full max-w-\[240px\]"/g) ?? []).length, 4)
  assert.match(filters, /grid min-w-0 grid-cols-1[^"\n]+@\[480px\]:grid-cols-2 @\[640px\]:grid-cols-3/)
  assert.doesNotMatch(filters, /min-w-\[150px\]|max-\[620px\]:grid-cols|max-\[420px\]:grid-cols/)
  assert.doesNotMatch(page, /aria-hidden=\{compactQuickFilters\}/)
  assert.doesNotMatch(filters, /aria-hidden=\{!compact/)
  assert.equal((page.match(/open=\{cultivarOpenOwner === 'wide'\}/g) ?? []).length, 1)
  assert.equal((filters.match(/open=\{cultivarOpenOwner === 'compact'\}/g) ?? []).length, 1)
  assert.match(filters, /setWidth\(node\.clientWidth\)/)
  assert.match(filters, /export const PLANT_WIDE_TOOLBAR_CHROME_WIDTH = 529/)
  assert.match(filters, /panelWidth \+ PLANT_WIDE_TOOLBAR_CHROME_WIDTH \+ estimatePlantSummaryWidth\(summary\)/)
  assert.match(filters, /observer\.observe\(node, \{ box: 'content-box' \}\)/)
  assert.doesNotMatch(filters, /getBoundingClientRect\(\)\.width/)
  assert.match(toolbar, /data-responsive-toolbar-container/)
  assert.match(toolbar, /className="@container relative flex-none border-b border-border bg-card"/)
  assert.match(toolbar, /data-responsive-toolbar-row/)
  assert.match(toolbar, /\(!containerResponsive \|\| rightActions \|\| \(pagination && pagination\.pageCount > 1\)\)/)
  assert.match(toolbar, /data-toolbar-trailing/)
  assert.match(tableParts, /data-filter-count-label/)
  assert.match(tableParts, /data-filter-count/)
  assert.match(tableParts, /tabular-nums/)
  assert.doesNotMatch(tableParts, /`\$\{compactCountLabel\} · \$\{selected\.length\}`/)
  assert.match(toolbar, /@min-\[1024px\]:px-4/)
  assert.match(toolbar, /@min-\[1024px\]:ml-px @min-\[1024px\]:w-\[var\(--toolbar-wide-search-width\)\]/)
  assert.match(toolbar, /forceCompact && '@min-\[1024px\]:!ml-0[^']+!w-auto[^']+!flex-1'/)
  assert.match(toolbar, /forceCompact && '@min-\[1024px\]:!px-2'/)
  assert.match(toolbar, /containerResponsive \? 'w-auto min-w-\[84px\] flex-1 md:w-auto @max-\[599px\]:basis-full'/)
  assert.doesNotMatch(toolbar, /containerResponsive[^\n]+overflow-x|containerResponsive[^\n]+overflow-hidden/)
  assert.doesNotMatch(page, /window\.innerWidth|matchMedia/)

  const wideWidths = [82, 107, 102, 87]
  const wideFixedWithoutSummary = 32 + 1 + (6 * 4) + PLANT_COMPANY_PANEL_WIDTH +
    wideWidths.reduce((sum, width) => sum + width, 0) + 44 + 44 + 6
  assert.equal(wideFixedWithoutSummary, PLANT_COMPANY_PANEL_WIDTH + 529)
  assert.equal(1024 - wideFixedWithoutSummary, 203)
  assert.ok('17 Companies: 47/47 Plants'.length * 6.5 <= 1024 - wideFixedWithoutSummary)

  // From a 600px container the compact row is one line: Search · Size · Type ·
  // Filters · action. Four gaps and inner-row padding leave Search >= 84px
  // beside the 94px Size and 106px Type tracks (8px padding, 3-digit tokens).
  const compactFixedWithoutSearch = 16 + (4 * 4) + 94 + 106 + 44 + 44
  assert.equal(600 - compactFixedWithoutSearch, 280)
  for (const width of [600, 658, 899, 900, 1024]) {
    assert.ok(width - compactFixedWithoutSearch >= 84)
  }
  // Below 600px Search wraps to its own row; Size and Type share the second
  // row beside Filters, keeping >= 126px each at 320px.
  assert.equal((320 - 16 - (2 * 4) - 44) / 2, 126)

  const surfaceBounds = (container: number) => {
    const width = Math.min(container - 16, 498)
    const right = container - 8
    return { width, left: right - width, right }
  }
  assert.deepEqual(surfaceBounds(390), { width: 374, left: 8, right: 382 })
  assert.deepEqual(surfaceBounds(514), { width: 498, left: 8, right: 506 })
  assert.deepEqual(surfaceBounds(658), { width: 498, left: 152, right: 650 })
  assert.deepEqual(surfaceBounds(899), { width: 498, left: 393, right: 891 })
  assert.deepEqual(surfaceBounds(900), { width: 498, left: 394, right: 892 })
  assert.deepEqual(surfaceBounds(1024), { width: 498, left: 518, right: 1016 })

  const fieldWidth = (container: number, columns: number) => {
    const inner = surfaceBounds(container).width - 26
    return (inner - ((columns - 1) * 12)) / columns
  }
  assert.equal(fieldWidth(390, 1), 348)
  assert.equal(fieldWidth(514, 2), 230)
  assert.ok(fieldWidth(658, 3) >= 149)
  assert.ok(fieldWidth(1024, 3) >= 149)
})
