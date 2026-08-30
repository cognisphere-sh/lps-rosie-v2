import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  DEFAULT_HIDDEN, SUPPLIER_COLS, SUPPLIER_VISIBLE,
} from './columns.ts'
import {
  applyStoredLayoutMigrations, migrateStoredSupplierDefault, parseStoredTableLayouts,
  SUPPLIER_DEFAULT_MIGRATION_KEY, type TableConfig,
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

test('desktop config order drives rows and heads while mobile cards remain independent', () => {
  const page = source('app/suppliers/page.tsx')
  assert.equal((page.match(/cfg\.visible\.map\(\(col\)/g) ?? []).length, 2)
  assert.match(page, /cols=\{SUPPLIER_COLS\}/)

  const mobile = page.slice(page.indexOf('const mobileCard ='), page.indexOf('const desktopRow ='))
  assert.doesNotMatch(mobile, /cfg\.visible|SUPPLIER_COLS|ColumnPicker/)
  assert.match(mobile, /row\.values\.item_count/)
  assert.match(mobile, /row\.values\.primary_contact_name/)
})
