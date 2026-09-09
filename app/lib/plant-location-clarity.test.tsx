import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { afterEach, beforeEach } from 'node:test'
import React from 'react'
import { JSDOM } from 'jsdom'
import { cleanup, render } from '@testing-library/react'

import {
  PLANT_GROUP_LOCATION_CUE_BYTES,
  PLANT_GROUP_LOCATION_CUE_MAX_UNITS,
  PlantLocationCue,
  boundPlantGroupLocation,
  plantGroupLocationSummary,
  plantLocationFacts,
} from '../components/workspace/plant-table.tsx'
import type { PlantRow, SupplierRow } from './rows.ts'

let dom: JSDOM

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/plants' })
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
})

afterEach(() => {
  cleanup()
  dom.window.close()
})

const company = (city: string | null, state: string | null): SupplierRow => ({
  id: 1,
  ref: { id: 1, headBranchId: 1, latitude: null, longitude: null, is_active: true, address: null },
  values: { name: 'Lake Tree Growers', city, state },
  sourceLinks: [],
  contacts: [],
})

const graphemes = (value: string) => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)]

const plant = (overrides: Partial<PlantRow> = {}): PlantRow => ({
  id: 'inventory-1',
  supplierId: 2,
  stockLocation: { name: 'Lake Tree Growers — Georgia Farm', city: 'Athens', state: 'GA' },
  values: { name: 'Cherry Laurel', size: '15 G', branch: 'Lake Tree Growers — Georgia Farm' },
  sourcePath: null,
  ...overrides,
})

test('match-specific stock location outranks and distinguishes supplier location', () => {
  const facts = plantLocationFacts(plant(), company('Tampa', 'FL'))
  assert.deepEqual(facts, {
    primaryLabel: 'Stock location',
    primary: 'Lake Tree Growers — Georgia Farm · Athens, GA',
    supplier: 'Tampa, FL',
  })
  assert.match(plantGroupLocationSummary([plant()], company('Tampa', 'FL')), /Athens, GA/)
  assert.doesNotMatch(JSON.stringify(facts), /delivery|distance|freight|source/i)
})

test('head stock, supplier-only and wholly missing evidence stay honestly distinct', () => {
  const headStock = plant({
    supplierId: 1,
    stockLocation: { name: 'Lake Tree Growers', city: 'Tampa', state: 'FL' },
  })
  assert.deepEqual(plantLocationFacts(headStock, company('Tampa', 'FL')), {
    primaryLabel: 'Stock location', primary: 'Lake Tree Growers · Tampa, FL', supplier: null,
  })

  const noStock = plant({ supplierId: null, stockLocation: null, values: { name: 'Cherry Laurel', branch: null } })
  assert.deepEqual(plantLocationFacts(noStock, company('Savannah', 'GA')), {
    primaryLabel: 'Supplier location', primary: 'Savannah, GA', supplier: null,
  })
  assert.deepEqual(plantLocationFacts(noStock, company(null, null)), {
    primaryLabel: 'Location', primary: 'not recorded', supplier: null,
  })

  const branchOnly = plant({ stockLocation: null, sourcePath: '/imports/georgia-stock.xlsx' })
  assert.equal(plantLocationFacts(branchOnly, company(null, null)).primary, 'Lake Tree Growers — Georgia Farm')
  const sourceOnly = plant({
    supplierId: null,
    stockLocation: null,
    values: { name: 'Cherry Laurel', branch: null },
    sourcePath: '/imports/atlanta-ga.xlsx',
  })
  assert.deepEqual(plantLocationFacts(sourceOnly, company(null, null)), {
    primaryLabel: 'Location', primary: 'not recorded', supplier: null,
  })
})

test('collapsed mobile summary dedupes, preserves order and stays bounded across 300 distinct locations', () => {
  const extremeCity = `${'A\u0301'.repeat(100)} 北美苗圃 with an intentionally extreme locality name`
  const distinct = [
    plant({ id: 'first', stockLocation: { name: 'First farm', city: '  Athens\n Heights  ', state: ' ga ' } }),
    plant({ id: 'extreme', stockLocation: { name: 'Second farm', city: extremeCity, state: 'ZZ' } }),
    plant({ id: 'third', stockLocation: { name: 'Third farm', city: 'Zürich', state: 'ZH' } }),
    ...Array.from({ length: 297 }, (_, index) => plant({
      id: `location-${index}`,
      stockLocation: { name: `Farm ${index}`, city: `City ${String(index).padStart(3, '0')}`, state: 'ST' },
    })),
  ]
  assert.equal(distinct.length, 300)
  const rows = [
    distinct[0],
    plant({ id: 'duplicate', stockLocation: { name: 'Duplicate farm', city: 'ATHENS   HEIGHTS', state: 'GA' } }),
    distinct[1],
    distinct[2],
    plant({ id: 'unicode-duplicate', stockLocation: { name: 'Duplicate farm', city: 'Zu\u0308RICH', state: 'zh' } }),
    ...distinct.slice(3),
  ]
  const normalizedExtreme = `${extremeCity}, ZZ`
  const boundedExtreme = boundPlantGroupLocation(normalizedExtreme)
  const summary = plantGroupLocationSummary(rows, company('Tampa', 'FL'))

  assert.equal(
    summary,
    `Match locations: Athens Heights, ga · ${boundedExtreme} · Zürich, ZH · +297 more locations`,
  )
  assert.equal(summary.match(/Athens Heights/gu)?.length, 1)
  assert.ok(graphemes(boundedExtreme).length <= PLANT_GROUP_LOCATION_CUE_MAX_UNITS)
  assert.ok(new TextEncoder().encode(boundedExtreme).length <= PLANT_GROUP_LOCATION_CUE_BYTES)
  assert.ok(graphemes(summary).length <= 160)
  assert.ok(new TextEncoder().encode(summary).length <= 256)
  assert.ok(boundedExtreme.endsWith('…'))
  assert.doesNotMatch(boundedExtreme, /A(?!\u0301)/u)

  const expanded = render(<PlantLocationCue row={distinct[1]} company={company('Tampa', 'FL')} />)
  assert.ok(expanded.container.textContent?.includes(normalizedExtreme))
  assert.doesNotMatch(expanded.container.textContent ?? '', /more locations/)
})

test('Segmenter fallback truncates only between complete whitespace-delimited tokens', () => {
  const original = Object.getOwnPropertyDescriptor(Intl, 'Segmenter')
  Object.defineProperty(Intl, 'Segmenter', { configurable: true, writable: true, value: undefined })
  try {
    assert.equal(boundPlantGroupLocation('Athens GA'), 'Athens GA')
    assert.equal(boundPlantGroupLocation('Peachtree Corners Municipality With Extraordinarily Long Name'), 'Peachtree Corners…')

    const boundary = '12345678901234567890123456'
    assert.equal(boundPlantGroupLocation(`${boundary} 🇺🇸`), `${boundary}…`)
    assert.equal(boundPlantGroupLocation(`${boundary} 👨‍👩‍👧‍👦`), `${boundary}…`)
    assert.equal(boundPlantGroupLocation(`${boundary} Cafe\u0301`), `${boundary}…`)
    assert.equal(boundPlantGroupLocation(`${boundary} ✊🏽 ✈️`), `${boundary}…`)
    assert.equal(boundPlantGroupLocation('Cafe\u0301 District'), 'Cafe\u0301 District')
    assert.equal(boundPlantGroupLocation('👨‍👩‍👧‍👦'.repeat(20)), '…')

    const byteBound = boundPlantGroupLocation(`${'界'.repeat(15)} ${'市'.repeat(10)}`)
    assert.equal(byteBound, `${'界'.repeat(15)}…`)
    assert.ok(new TextEncoder().encode(byteBound).length <= PLANT_GROUP_LOCATION_CUE_BYTES)
  } finally {
    if (original) Object.defineProperty(Intl, 'Segmenter', original)
    else Reflect.deleteProperty(Intl, 'Segmenter')
  }
})

test('long Unicode cues wrap without truncation or horizontal-overflow masking at every supported width', () => {
  const long = plant({
    stockLocation: {
      name: 'Vivero São José — 北美苗圃 / Lake Tree Growers Georgia Production Farm with a deliberately long name',
      city: 'Peachtree Corners with a deliberately long municipality',
      state: 'GA',
    },
  })
  for (const width of [320, 390, 480, 900, 1280]) {
    const view = render(
      <div style={{ width }}>
        <PlantLocationCue row={long} company={company('St. Petersburg', 'FL')} />
      </div>,
    )
    const cue = view.container.querySelector('[data-plant-location-cue]') as HTMLElement
    assert.match(cue.textContent ?? '', /Stock location:/)
    assert.match(cue.textContent ?? '', /北美苗圃/)
    assert.match(cue.textContent ?? '', /GA/)
    assert.match(cue.textContent ?? '', /Supplier location: St\. Petersburg, FL/)
    assert.match(cue.className, /flex-wrap/)
    assert.match(cue.innerHTML, /whitespace-normal/)
    assert.match(cue.innerHTML, /break-words/)
    assert.doesNotMatch(cue.className + cue.innerHTML, /truncate|overflow-x|whitespace-nowrap/)
    view.unmount()
  }
})

test('rendered supplier fallback and missing copy are explicit', () => {
  const noStock = plant({ supplierId: null, stockLocation: null, values: { name: 'Cherry Laurel', branch: null } })
  const supplierView = render(<PlantLocationCue row={noStock} company={company('Macon', 'GA')} />)
  assert.equal(supplierView.getByText(/Supplier location:/).parentElement?.textContent, 'Supplier location: Macon, GA')
  supplierView.unmount()

  const missingView = render(<PlantLocationCue row={noStock} company={company(null, null)} />)
  assert.ok(missingView.getByText('Location not recorded'))
})

test('Plant Search mounts the cue in mobile rows, collapsed groups and every desktop inventory row', () => {
  const page = readFileSync(new URL('../app/plants/page.tsx', import.meta.url), 'utf8')
  const table = readFileSync(new URL('../components/workspace/plant-table.tsx', import.meta.url), 'utf8')
  const queries = readFileSync(new URL('./queries.ts', import.meta.url), 'utf8')
  const route = readFileSync(new URL('../app/api/plants/route.ts', import.meta.url), 'utf8')

  assert.match(page, /data-plant-group-location-summary/)
  assert.match(page, /plantGroupLocationSummary\(g\.plants, g\.company\)/)
  assert.match(page, /<PlantLocationCue row=\{p\} company=\{g\.company\}/)
  assert.match(page, /<PlantRowLine[\s\S]+?company=\{g\.company\}/)
  assert.match(table, /company && \([\s\S]+?<PlantLocationCue/)
  assert.match(queries, /stockLocation: \{ name: record\.name, city: record\.city, state: record\.state \}/)
  assert.doesNotMatch(route, /state.*(?:default|automatic)|(?:default|automatic).*state/i)
  assert.doesNotMatch(page, /delivery|distance|freight|miles/i)
})
