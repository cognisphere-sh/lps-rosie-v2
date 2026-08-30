import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { cleanup, render, waitFor } from '@testing-library/react'

import { Cell } from '../components/workspace/table-parts.tsx'
import {
  DEFAULT_HIDDEN, SUPPLIER_COLS, SUPPLIER_VISIBLE, TABLE_COLS,
} from './columns.ts'
import {
  applyStoredLayoutMigrations, migrateStoredSupplierCategoryWidth, migrateStoredSupplierDefault,
  normalizeStoredTableConfig, normalizeStoredTableLayouts, parseStoredTableLayouts,
  resizedColumnWidth, resolvedColumnWidth,
  SUPPLIER_CATEGORY_WIDTH_MIGRATION_KEY, SUPPLIER_DEFAULT_MIGRATION_KEY,
  useTableConfig, type TableConfig,
} from './table-config.ts'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const visible = (config: TableConfig) =>
  config.order.filter((key) => !config.hidden.includes(key))

const EXPECTED = [
  'name', 'category', 'state', 'inventory_sources', 'item_count', 'website', 'primary_contact_name',
]

test('fresh Suppliers defaults and picker definitions lead with the seven requested columns', () => {
  assert.deepEqual(SUPPLIER_VISIBLE, EXPECTED)
  assert.deepEqual(SUPPLIER_COLS.slice(0, EXPECTED.length).map((column) => column.key), EXPECTED)
  assert.deepEqual(
    SUPPLIER_COLS.filter((column) => !DEFAULT_HIDDEN.suppliers.includes(column.key)).map((column) => column.key),
    EXPECTED,
  )
  assert.equal(SUPPLIER_COLS.find((column) => column.key === 'item_count')?.width, 84)
  const category = SUPPLIER_COLS.find((column) => column.key === 'category')!
  assert.equal(category.width, 160)
  assert.equal(category.minWidth, 160)
  assert.deepEqual(new Set(SUPPLIER_COLS.map((column) => column.key)).size, SUPPLIER_COLS.length)
})

test('legacy Suppliers layout adopts the rollout once while preserving widths and safe extra order', () => {
  const customers = {
    order: ['name', 'email'], hidden: ['email'], widths: { name: 333 },
  }
  const legacy = {
    suppliers: {
      order: [
        'name', 'notes', 'category', 'city', 'website', 'primary_contact_email',
        'state', 'inventory_sources', 'item_count', 'primary_contact_name',
      ],
      hidden: ['notes', 'created_at'],
      widths: { name: 260, item_count: 72, city: 175 },
    },
    customers,
  }

  const migrated = migrateStoredSupplierDefault(legacy)
  assert.deepEqual(visible(migrated.suppliers!), EXPECTED)
  assert.deepEqual(migrated.suppliers!.order.slice(0, EXPECTED.length), EXPECTED)
  assert.deepEqual(
    migrated.suppliers!.order.slice(EXPECTED.length, EXPECTED.length + 3),
    ['notes', 'city', 'primary_contact_email'],
  )
  assert.deepEqual(migrated.suppliers!.widths, legacy.suppliers.widths)
  assert.strictEqual(migrated.customers, customers)
  assert.deepEqual(legacy.suppliers.hidden, ['notes', 'created_at'])
})

test('supplier migration is idempotent and version-gated so later preferences are not forced again', () => {
  const once = migrateStoredSupplierDefault({
    suppliers: { order: ['city', ...EXPECTED], hidden: ['website'], widths: { website: 222 } },
  })
  const twice = migrateStoredSupplierDefault(once)
  assert.deepEqual(twice, once)

  const laterPreference = {
    suppliers: { order: ['city', ...EXPECTED], hidden: ['website'], widths: { website: 222 } },
  }
  assert.strictEqual(
    applyStoredLayoutMigrations(laterPreference, { caliper: false, suppliers: false }),
    laterPreference,
  )

  const tableConfig = source('lib/table-config.ts')
  assert.equal(SUPPLIER_DEFAULT_MIGRATION_KEY, 'lps.tables.v1.suppliers-seven-column-default-v1')
  assert.match(
    tableConfig,
    /const migrateSuppliers = !window\.localStorage\.getItem\(SUPPLIER_DEFAULT_MIGRATION_KEY\)/,
  )
  assert.match(
    tableConfig,
    /if \(migrateSuppliers\) window\.localStorage\.setItem\(SUPPLIER_DEFAULT_MIGRATION_KEY, '1'\)/,
  )
  assert.match(
    tableConfig,
    /window\.localStorage\.setItem\(SUPPLIER_CATEGORY_WIDTH_MIGRATION_KEY, '1'\)/,
  )
})

test('category width migration repairs only undersized saved Supplier widths', () => {
  const customers = { order: ['name'], hidden: [], widths: { name: 244 } }
  const narrow = {
    suppliers: {
      order: ['state', 'category', 'name'], hidden: ['website'],
      widths: { name: 280, category: 128, state: 104 },
    },
    customers,
  }
  const migrated = migrateStoredSupplierCategoryWidth(narrow)
  assert.deepEqual(migrated.suppliers, {
    ...narrow.suppliers,
    widths: { name: 280, category: 160, state: 104 },
  })
  assert.strictEqual(migrated.customers, customers)
  assert.deepEqual(narrow.suppliers.widths, { name: 280, category: 128, state: 104 })

  const wide = {
    suppliers: { ...narrow.suppliers, widths: { ...narrow.suppliers.widths, category: 196 } },
  }
  assert.strictEqual(migrateStoredSupplierCategoryWidth(wide), wide)
  assert.equal(SUPPLIER_CATEGORY_WIDTH_MIGRATION_KEY, 'lps.tables.v1.suppliers-category-min-width-v1')
})

test('category minimum applies to stale saved widths and resize attempts without changing valid widths', () => {
  const category = SUPPLIER_COLS.find((column) => column.key === 'category')!
  const config = { order: EXPECTED, hidden: [], widths: { category: 128 } }
  assert.equal(resolvedColumnWidth(config, category), 160)
  assert.equal(resizedColumnWidth(category, 90), 160)
  assert.equal(resizedColumnWidth(category, 211.6), 212)
  assert.equal(resolvedColumnWidth({ ...config, widths: { category: 196 } }, category), 196)

  const state = SUPPLIER_COLS.find((column) => column.key === 'state')!
  assert.equal(resizedColumnWidth(state, 80), 80)
  assert.equal(resizedColumnWidth(state, 20), 64)

  const unrelated = TABLE_COLS.plantMaster.find((column) => column.key === 'name')!
  const legacyPlantMaster = { order: ['name'], hidden: [], widths: { name: 41 } }
  assert.equal(resolvedColumnWidth(legacyPlantMaster, unrelated), 41)
})

test('stored config normalization makes every shape safe while preserving valid unrelated fields', () => {
  const fallback = normalizeStoredTableConfig('suppliers', {
    order: 'bad', hidden: null, widths: ['bad'],
  })
  assert.deepEqual(fallback.order, SUPPLIER_COLS.map((column) => column.key))
  assert.deepEqual(fallback.hidden, DEFAULT_HIDDEN.suppliers)
  assert.deepEqual(fallback.widths, {})

  for (const widths of [null, ['bad'], 'bad']) {
    const normalized = normalizeStoredTableConfig('suppliers', {
      order: ['state', 4, 'category'], hidden: ['website', null], widths,
    })
    assert.deepEqual(normalized.order, ['state', 'category'])
    assert.deepEqual(normalized.hidden, ['website'])
    assert.deepEqual(normalized.widths, {})
  }

  const mixed = normalizeStoredTableLayouts({
    suppliers: {
      order: ['state', false, 'category', 'name'],
      hidden: [null, 'website'],
      widths: { category: 128, name: 41, state: 104, bad: 'wide' },
    },
    plantMaster: { order: ['name'], hidden: [], widths: { name: 39 } },
  })
  assert.deepEqual(mixed.suppliers, {
    order: ['state', 'category', 'name'], hidden: ['website'],
    widths: { category: 128, name: 41, state: 104 },
  })
  assert.deepEqual(mixed.plantMaster, { order: ['name'], hidden: [], widths: { name: 39 } })
  assert.deepEqual(normalizeStoredTableLayouts(mixed), mixed)
})

test('malformed saved layouts fail closed without touching valid non-Suppliers layouts', () => {
  assert.deepEqual(parseStoredTableLayouts('{not json'), {})
  assert.deepEqual(parseStoredTableLayouts('[]'), {})
  assert.deepEqual(parseStoredTableLayouts('null'), {})

  const plants = { order: ['name', 'cal'], hidden: [], widths: { cal: 99 } }
  const migrated = migrateStoredSupplierDefault({
    suppliers: { order: 'bad', hidden: null, widths: 'bad' },
    plants,
  })
  assert.deepEqual(visible(migrated.suppliers!), EXPECTED)
  assert.deepEqual(migrated.suppliers!.widths, {})
  assert.strictEqual(migrated.plants, plants)
})

test('rendered category badge stays compact, one-line and contained by its cell wrapper', () => {
  const category = SUPPLIER_COLS.find((column) => column.key === 'category')!
  const markup = renderToStaticMarkup(createElement(Cell, {
    col: category,
    rowId: 1,
    value: 'Wholesale Supplier',
  }))
  assert.match(markup, /inline-flex max-w-full overflow-hidden px-1\.5/)
  assert.match(markup, /w-fit whitespace-nowrap shrink-0/)
  assert.doesNotMatch(markup, /(?:^|\s)w-full(?:\s|")/)
  assert.match(markup, />Wholesale Supplier<\/span>/)
})

test('desktop config order drives rows and heads while mobile cards remain independent', () => {
  const page = source('app/suppliers/page.tsx')
  assert.equal((page.match(/cfg\.visible\.map\(\(col\)/g) ?? []).length, 2)
  assert.match(page, /cols=\{SUPPLIER_COLS\}/)
  assert.match(page, /className="relative min-h-0 flex-1 overflow-auto"/)
  assert.match(page, /tableLayout: 'fixed'/)

  const mobile = page.slice(page.indexOf('const mobileCard ='), page.indexOf('const desktopRow ='))
  assert.doesNotMatch(mobile, /cfg\.visible|SUPPLIER_COLS|ColumnPicker/)
  assert.match(mobile, /row\.values\.item_count/)
  assert.match(mobile, /row\.values\.primary_contact_name/)
})

function SupplierLayoutProbe() {
  const cfg = useTableConfig('suppliers')
  const category = SUPPLIER_COLS.find((column) => column.key === 'category')!
  const name = SUPPLIER_COLS.find((column) => column.key === 'name')!
  return createElement('output', { 'data-config': JSON.stringify(cfg.config) },
    `${cfg.widthOf(category)}|${cfg.widthOf(name)}`)
}

test('actual load and remount normalize malformed legacy layouts across migration-marker states', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/suppliers' })
  const win = dom.window
  for (const [key, value] of Object.entries({
    window: win,
    document: win.document,
    navigator: win.navigator,
    HTMLElement: win.HTMLElement,
    Node: win.Node,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }

  const storage = win.localStorage
  storage.setItem('lps.tables.v1.cal-visible', '1')
  storage.setItem(SUPPLIER_DEFAULT_MIGRATION_KEY, '1')
  storage.removeItem(SUPPLIER_CATEGORY_WIDTH_MIGRATION_KEY)
  storage.setItem('lps.tables.v1', JSON.stringify({
    suppliers: {
      order: 'broken', hidden: null,
      widths: { category: 128, name: 41, state: 104, malformed: 'wide' },
    },
  }))

  let view = render(createElement(SupplierLayoutProbe))
  await waitFor(() => {
    assert.equal(view.getByRole('status').textContent, '160|41')
    const saved = JSON.parse(storage.getItem('lps.tables.v1')!).suppliers
    assert.ok(Array.isArray(saved.order))
    assert.ok(Array.isArray(saved.hidden))
    assert.deepEqual(saved.widths, { category: 160, name: 41, state: 104 })
  })
  assert.equal(storage.getItem(SUPPLIER_CATEGORY_WIDTH_MIGRATION_KEY), '1')

  view.unmount()
  view = render(createElement(SupplierLayoutProbe))
  await waitFor(() => assert.equal(view.getByRole('status').textContent, '160|41'))
  view.unmount()

  storage.setItem(SUPPLIER_CATEGORY_WIDTH_MIGRATION_KEY, '1')
  for (const widths of [null, ['bad'], 'bad']) {
    storage.setItem('lps.tables.v1', JSON.stringify({
      suppliers: { order: false, hidden: 'bad', widths },
    }))
    view = render(createElement(SupplierLayoutProbe))
    await waitFor(() => {
      assert.equal(view.getByRole('status').textContent, '160|210')
      const saved = JSON.parse(storage.getItem('lps.tables.v1')!).suppliers
      assert.ok(Array.isArray(saved.order))
      assert.ok(Array.isArray(saved.hidden))
      assert.deepEqual(saved.widths, {})
    })
    view.unmount()
  }

  storage.setItem('lps.tables.v1', JSON.stringify({
    suppliers: {
      order: ['state', 9, 'category', 'name'], hidden: [null, 'website'],
      widths: { category: 128, name: 41 },
    },
  }))
  view = render(createElement(SupplierLayoutProbe))
  await waitFor(() => {
    assert.equal(view.getByRole('status').textContent, '160|41')
    const saved = JSON.parse(storage.getItem('lps.tables.v1')!).suppliers
    assert.deepEqual(saved.order, ['state', 'category', 'name'])
    assert.deepEqual(saved.hidden, ['website'])
    assert.deepEqual(saved.widths, { category: 128, name: 41 })
  })

  cleanup()
  dom.window.close()
})
