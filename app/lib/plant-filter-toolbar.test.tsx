import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { afterEach, beforeEach } from 'node:test'
import React, { useRef, useState } from 'react'
import { renderToString } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { act, cleanup, render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  PLANT_ADVANCED_FILTER_KEYS,
  PLANT_QUICK_FILTER_MIN_WIDTH,
  PlantAdvancedFilters,
  plantFiltersAreCompact,
  usePlantFilterContainer,
} from '../components/workspace/plant-filters.tsx'
import { MultiFilter } from '../components/workspace/table-parts.tsx'
import { PageControls, Toolbar } from '../components/workspace/toolbar.tsx'

let dom: JSDOM
let resizeObservers: MockResizeObserver[]

class MockResizeObserver {
  private target: Element | null = null

  constructor(private readonly callback: ResizeObserverCallback) {
    resizeObservers.push(this)
  }

  observe(target: Element) {
    this.target = target
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
      sizeOptions={['1 G']}
      selectedSizes={[]}
      onSizes={() => {}}
      cultivarOptions={['Natchez']}
      cultivars={[]}
      onCultivars={() => {}}
      cultivarOpen={false}
      onCultivarOpenChange={() => {}}
      categoryOptions={['Grower']}
      categories={[]}
      onCategories={() => {}}
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
  assert.match(compactCopy.className, /@min-\[900px\]:hidden/)
  assert.equal(compactCopy.hasAttribute('aria-hidden'), false)

  await user.click(view.getByRole('button', { name: 'Clear all' }))
  assert.equal(cleared, 1)
  await user.keyboard('{Escape}')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  assert.equal(document.activeElement, trigger)
})

const LONG_GEOMETRY_OPTIONS = {
  Size: 'Specimen container size with an intentionally long descriptive label',
  Cultivar: 'Cultivar with an exceptionally long registered trade name that must remain readable',
  'Supplier type': 'Supplier category with a very long operational description for the buying team',
  State: 'State or growing region with a deliberately extended display name',
  Company: 'Company with a substantially long legal trading name and nursery division suffix',
} as const

function AdvancedGeometryHarness() {
  const [cultivarOpen, setCultivarOpen] = useState(false)
  return (
    <PlantAdvancedFilters
      companyOptions={[LONG_GEOMETRY_OPTIONS.Company]}
      companies={[]}
      onCompanies={() => {}}
      plantFilters={{}}
      onPlantFilter={() => {}}
      sizeOptions={[LONG_GEOMETRY_OPTIONS.Size]}
      selectedSizes={[]}
      onSizes={() => {}}
      cultivarOptions={[LONG_GEOMETRY_OPTIONS.Cultivar]}
      cultivars={[]}
      onCultivars={() => {}}
      cultivarOpen={cultivarOpen}
      onCultivarOpenChange={setCultivarOpen}
      categoryOptions={[LONG_GEOMETRY_OPTIONS['Supplier type']]}
      categories={[]}
      onCategories={() => {}}
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
    { container: 390, columns: 1, names: ['Size', 'Cultivar', 'Supplier type', 'State', 'Company'] as const },
    { container: 514, columns: 2, names: ['Size', 'Cultivar', 'Supplier type', 'State', 'Company'] as const },
    { container: 658, columns: 3, names: ['Size', 'Cultivar', 'Supplier type', 'State', 'Company'] as const },
    { container: 900, columns: 3, names: ['Company'] as const },
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

      // At 900px the compact quartet is CSS-hidden, so Company occupies the
      // first advanced-grid cell. At compact widths DOM order equals grid order.
      const gridIndex = geometry.container >= 900 ? 0 : visibleIndex
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

function ResponsiveToolbarHarness() {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const wideFiltersRef = useRef<HTMLDivElement>(null)
  const compact = usePlantFilterContainer(toolbarRef)
  const [sizes, setSizes] = useState<string[]>([])
  const [cultivars, setCultivars] = useState<string[]>([])
  const [cultivarOpen, setCultivarOpen] = useState(false)

  return (
    <Toolbar
      toolbarRef={toolbarRef}
      containerResponsive
      placeholder="Plant Search"
      query="thuja"
      onQuery={() => {}}
      controls={
        <>
          <div ref={wideFiltersRef} data-plant-wide-filters className="hidden @min-[900px]:contents">
            <MultiFilter allLabel="Size: Any" accessibleName="Size" options={['1 G']} selected={sizes} onChange={setSizes} />
            <div data-plant-cultivar>
              <MultiFilter
                allLabel="Cultivar: Any"
                accessibleName="Cultivar"
                options={['Natchez']}
                selected={cultivars}
                onChange={setCultivars}
                open={cultivarOpen}
                onOpenChange={setCultivarOpen}
                restoreFocusOnClose
              />
            </div>
            <button type="button">Supplier type</button>
            <button type="button">State</button>
          </div>
          <PlantAdvancedFilters
            companyOptions={['Oak Hill']}
            companies={[]}
            onCompanies={() => {}}
            plantFilters={{}}
            onPlantFilter={() => {}}
            sizeOptions={['1 G']}
            selectedSizes={sizes}
            onSizes={setSizes}
            cultivarOptions={['Natchez']}
            cultivars={cultivars}
            onCultivars={setCultivars}
            cultivarOpen={cultivarOpen}
            onCultivarOpenChange={setCultivarOpen}
            categoryOptions={['Grower']}
            categories={[]}
            onCategories={() => {}}
            stateOptions={['TX']}
            states={[]}
            onStates={() => {}}
            compactForFocus={compact}
            focusSourceRef={wideFiltersRef}
            activeCount={sizes.length}
            onClear={() => setSizes([])}
          />
        </>
      }
      rightActions={<button type="button">Notifications</button>}
      hasFilters={sizes.length > 0}
      onClear={() => setSizes([])}
      showClear={false}
      summary="17 Companies: 47/47 Plants"
    />
  )
}

test('SSR markup delegates wide-first visibility to CSS without JS aria or tabbability patches', () => {
  const markup = renderToString(<ResponsiveToolbarHarness />)
  assert.match(markup, /@container relative flex-nowrap/)
  assert.match(markup, /data-plant-wide-filters="true" class="hidden @min-\[900px\]:contents"/)
  assert.doesNotMatch(markup, /data-plant-wide-filters[^>]+aria-hidden/)
  assert.doesNotMatch(markup, /data-plant-wide-filters[^>]+tabindex/)
})

test('actual container transitions fold quick filters without losing dialog, focus, state, summary or action', async () => {
  const user = userEvent.setup({ document })
  const view = render(<ResponsiveToolbarHarness />)
  const wide = view.container.querySelector('[data-plant-wide-filters]')!

  assert.equal(wide.hasAttribute('aria-hidden'), false)
  assert.match(wide.className, /hidden @min-\[900px\]:contents/)
  assert.equal(view.container.querySelector('[data-plant-compact-filters]'), null)
  assert.ok(view.getByText('17 Companies: 47/47 Plants'))
  assert.ok(view.getByRole('button', { name: 'Notifications' }))

  await user.click(view.getByRole('button', { name: 'More filters' }))
  assert.equal(view.getByRole('button', { name: 'More filters' }).getAttribute('aria-expanded'), 'true')
  const compact = view.container.querySelector('[data-plant-compact-filters]')!
  assert.equal(compact.hasAttribute('aria-hidden'), false)
  assert.match(compact.className, /contents @min-\[900px\]:hidden/)
  for (const name of ['Size', 'Cultivar', 'Supplier type', 'State']) {
    assert.ok(within(compact as HTMLElement).getByRole('button', { name }))
  }
  await user.click(within(compact as HTMLElement).getByRole('button', { name: 'Size' }))
  await user.click(within(compact as HTMLElement).getByRole('button', { name: '1 G' }))

  await resizeContainer(900)
  assert.equal(wide.hasAttribute('aria-hidden'), false)
  assert.equal(compact.hasAttribute('aria-hidden'), false)
  assert.equal(view.getByRole('button', { name: 'More filters, 1 active' }).getAttribute('aria-expanded'), 'true')
  const wideSize = within(wide as HTMLElement).getByRole('button', { name: 'Size, 1 selected' })
  assert.ok(wideSize)
  for (const name of ['Cultivar', 'Supplier type', 'State']) {
    assert.ok(within(wide as HTMLElement).getByRole('button', { name }))
  }
  const wideOrder = [
    view.getByRole('textbox', { name: 'Plant Search' }),
    wideSize,
    within(wide as HTMLElement).getByRole('button', { name: 'Cultivar' }),
    within(wide as HTMLElement).getByRole('button', { name: 'Supplier type' }),
    within(wide as HTMLElement).getByRole('button', { name: 'State' }),
    view.getByRole('button', { name: 'More filters, 1 active' }),
    view.getByText('17 Companies: 47/47 Plants'),
    view.getByRole('button', { name: 'Notifications' }),
  ]
  for (let index = 1; index < wideOrder.length; index += 1) {
    assert.ok(wideOrder[index - 1].compareDocumentPosition(wideOrder[index]) & Node.DOCUMENT_POSITION_FOLLOWING)
  }

  wideSize.focus()
  await resizeContainer(658)
  const trigger = view.getByRole('button', { name: 'More filters, 1 active' })
  assert.equal(document.activeElement, trigger)
  assert.equal(trigger.getAttribute('aria-expanded'), 'true')
  assert.equal(wide.hasAttribute('aria-hidden'), false)
  assert.equal(compact.hasAttribute('aria-hidden'), false)
  assert.ok(view.getByText('17 Companies: 47/47 Plants'))
  assert.ok(view.getByRole('button', { name: 'Notifications' }))

  await user.click(trigger)
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  await resizeContainer(1024)
  await resizeContainer(514)
  assert.equal(view.getByRole('button', { name: 'More filters, 1 active' }).getAttribute('aria-expanded'), 'false')
})

test('controlled Cultivar stays open and moves focus across both copies and crossing races', async () => {
  const user = userEvent.setup({ document })
  const view = render(<ResponsiveToolbarHarness />)
  const wide = view.container.querySelector('[data-plant-wide-filters]') as HTMLElement

  await resizeContainer(900)
  const wideCultivar = within(wide).getByRole('button', { name: 'Cultivar' })
  await user.click(wideCultivar)
  within(wide).getByRole('textbox', { name: 'Filter suppliers…' }).focus()

  await resizeContainer(658)
  await settleFocus()
  const compact = view.container.querySelector('[data-plant-compact-filters]') as HTMLElement
  const compactCultivar = within(compact).getByRole('button', { name: 'Cultivar' })
  assert.equal(compactCultivar.getAttribute('aria-expanded'), 'true')
  assert.equal(document.activeElement, compactCultivar)
  assert.ok(within(compact).getByRole('textbox', { name: 'Filter cultivars…' }))

  await resizeContainer(900)
  await settleFocus()
  assert.equal(wideCultivar.getAttribute('aria-expanded'), 'true')
  assert.equal(document.activeElement, wideCultivar)

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
  await resizeContainer(900)
  await settleFocus()
  assert.equal(wideCultivar.getAttribute('aria-expanded'), 'true')
  assert.equal(document.activeElement, wideCultivar)

  within(wide).getByRole('textbox', { name: 'Filter suppliers…' }).focus()
  await raceContainerWidths(658, 900, 514)
  await settleFocus()
  assert.equal(compactCultivarAgain.getAttribute('aria-expanded'), 'true')
  assert.equal(document.activeElement, compactCultivarAgain)

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

test('mobile, constrained and wide widths share the deterministic 900px container boundary', () => {
  assert.equal(PLANT_QUICK_FILTER_MIN_WIDTH, 900)
  for (const width of [390, 514, 658, 899]) assert.equal(plantFiltersAreCompact(width), true)
  for (const width of [900, 1024, 1200]) assert.equal(plantFiltersAreCompact(width), false)
})

test('pager renders as a compact footer control instead of consuming the top-row budget', () => {
  const view = render(<PageControls page={2} pageCount={3} onPage={() => {}} />)
  assert.ok(view.getByRole('button', { name: 'Previous page' }))
  assert.ok(view.getByText('Page 2 of 3'))
  assert.ok(view.getByRole('button', { name: 'Next page' }))
})

test('Plant Search source keeps the approved visible order and removes every table-head filter', () => {
  const page = readFileSync(new URL('../app/plants/page.tsx', import.meta.url), 'utf8')
  const controls = page.slice(page.indexOf('controls={'), page.indexOf('hasFilters={hasFilters}'))
  const ordered = [
    'allLabel="Size: Any"',
    'allLabel="Cultivar: Any"',
    'allLabel="Supplier type"',
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

test('container source contracts fit compact and wide rows without clipping or raw viewport decisions', () => {
  const page = readFileSync(new URL('../app/plants/page.tsx', import.meta.url), 'utf8')
  const controls = page.slice(page.indexOf('controls={'), page.indexOf('hasFilters={hasFilters}'))
  const filters = readFileSync(new URL('../components/workspace/plant-filters.tsx', import.meta.url), 'utf8')
  const toolbar = readFileSync(new URL('../components/workspace/toolbar.tsx', import.meta.url), 'utf8')
  const widths = [...controls.matchAll(/className="w-\[(\d+)px\]"/g)].slice(0, 4).map((match) => Number(match[1]))

  assert.deepEqual(widths, [82, 100, 108, 64])
  assert.match(page, /className="hidden @min-\[900px\]:contents"/)
  assert.match(filters, /className="contents @min-\[900px\]:hidden"/)
  assert.match(filters, /right-2[^"\n]+w-\[calc\(100cqw-1rem\)\] max-w-\[498px\][^"\n]+overflow-y-auto/)
  assert.doesNotMatch(filters, /max-w-\[498px\][^"\n]+overflow-x-hidden/)
  assert.equal((filters.match(/menuClassName="w-full min-w-0 max-w-full"/g) ?? []).length, 5)
  assert.doesNotMatch(filters, /menuClassName="[^"]*(?:100vw|w-max)/)
  assert.match(filters, /grid min-w-0 grid-cols-1[^"\n]+@\[480px\]:grid-cols-2 @\[640px\]:grid-cols-3/)
  assert.doesNotMatch(filters, /min-w-\[150px\]|max-\[620px\]:grid-cols|max-\[420px\]:grid-cols/)
  assert.doesNotMatch(page, /aria-hidden=\{compactQuickFilters\}/)
  assert.doesNotMatch(filters, /aria-hidden=\{!compact/)
  assert.equal((page.match(/open=\{cultivarOpen\}/g) ?? []).length, 1)
  assert.equal((filters.match(/open=\{cultivarOpen\}/g) ?? []).length, 1)
  assert.match(toolbar, /containerResponsive \? '@container relative flex-nowrap gap-1 px-2'/)
  assert.match(toolbar, /containerResponsive \? 'w-auto min-w-\[96px\] flex-1 md:w-auto'/)
  assert.doesNotMatch(toolbar, /containerResponsive[^\n]+overflow-x|containerResponsive[^\n]+overflow-hidden/)
  assert.doesNotMatch(page, /window\.innerWidth|matchMedia/)

  // Wide fixed budget: 16px toolbar padding + six 4px outer gaps + four
  // quick filters + 44px icon + 96px Search + 44px notification + 6px inner
  // gap. At the 900px container threshold, 316px remains for the summary.
  const wideFixed = 16 + (6 * 4) + widths.reduce((sum, width) => sum + width, 0) + 44 + 96 + 44 + 6
  assert.equal(900 - wideFixed, 316)
  assert.equal(1024 - wideFixed, 440)

  // Compact has only Search, icon and trailing cluster: even a 514px pane
  // reserves 300px for the summary after every fixed width and gap.
  const compactFixed = 16 + (2 * 4) + 44 + 96 + 44 + 6
  assert.equal(514 - compactFixed, 300)
  assert.equal(658 - compactFixed, 444)

  const surfaceBounds = (container: number) => {
    const width = Math.min(container - 16, 498)
    const right = container - 8
    return { width, left: right - width, right }
  }
  assert.deepEqual(surfaceBounds(390), { width: 374, left: 8, right: 382 })
  assert.deepEqual(surfaceBounds(514), { width: 498, left: 8, right: 506 })
  assert.deepEqual(surfaceBounds(658), { width: 498, left: 152, right: 650 })
  assert.deepEqual(surfaceBounds(900), { width: 498, left: 394, right: 892 })

  const fieldWidth = (container: number, columns: number) => {
    const inner = surfaceBounds(container).width - 26 // two borders + 24px padding
    return (inner - ((columns - 1) * 12)) / columns
  }
  assert.equal(fieldWidth(390, 1), 348)
  assert.equal(fieldWidth(514, 2), 230)
  assert.ok(fieldWidth(658, 3) >= 149)
  assert.ok(fieldWidth(900, 3) >= 149)
})
