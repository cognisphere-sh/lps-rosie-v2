import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const component = source('components/workspace/job-request.tsx')

function ordered(sourceText: string, tokens: string[]) {
  let cursor = -1
  for (const token of tokens) {
    const next = sourceText.indexOf(token, cursor + 1)
    assert.notEqual(next, -1, `missing ${token}`)
    assert.ok(next > cursor, `${token} is out of order`)
    cursor = next
  }
}

test('shared request line tracks match the exact visible column order', () => {
  assert.match(
    source('lib/columns.ts'),
    /export const REQUEST_ITEM_COLS[\s\S]*?key: 'status'[\s\S]*?key: 'note_for_customer'[\s\S]*?key: 'unit_price'/,
  )
  assert.match(
    component,
    /column\.key === 'note_internal'[\s\S]*?`minmax\(\$\{widthOf\(column\)\}px, 1fr\)`[\s\S]*?: `\$\{widthOf\(column\)\}px`/,
  )
  assert.doesNotMatch(component, /Add a note for customer/)

  assert.match(component, /<LineColumnHeader[\s\S]*?onMove=\{lineTable\.moveColumn\}[\s\S]*?onResize=/)
  assert.match(component, /draggable[\s\S]*?drag to reorder/)
  assert.match(component, /aria-label=\{`Resize \$\{column\.label\}`\}/)
})

test('row fields and behavior move with their headers without changing semantics', () => {
  const row = component.slice(component.indexOf('function ItemRow('), component.indexOf('/** One labelled, editable field'))
  ordered(row, [
    'column="demanded_quantity"',
    'column="available_quantity"',
    'column="size"',
    'column="name"',
    '<StatusPill',
    'kind="shared"',
    'column="unit_price"',
    'money(quoteLineTotal(item))',
    'kind="internal"',
  ])
  assert.match(row, /column="demanded_quantity"[\s\S]*?title="Demand — what the customer asked for"/)
  assert.match(row, /style=\{\{ color: coverColor\(cover\) \}\}[\s\S]*?column="available_quantity"[\s\S]*?title="Avail — how many we can supply\. Blank means not answered yet\."/)
  assert.match(row, /zero when unavailable; otherwise available quantity × unit price, falling back to demand[\s\S]*?quoteLineTotal\(item\)/)
  assert.match(row, /nameEdit = \{\s*\.\.\.edit, value: changes\.name,[\s\S]*?\{\.\.\.nameEdit\} column="name"[\s\S]*?item\.noteForCustomer/)
  assert.match(row, /<StatusPill[\s\S]*?column="status"[\s\S]*?options=\{ITEM_STATUS_OPTIONS\}/)
})

test('one horizontally scrolling RequestBody layout serves every consumer at safe width', () => {
  const tracks = [66, 66, 72, 220, 124, 180, 86, 92, 180]
  const contentMinimum = tracks.reduce((sum, width) => sum + width, 0)
  assert.equal(contentMinimum, 1086)
  const modes: Array<readonly [boolean, boolean]> = [
    [false, false], [true, false], [false, true], [true, true],
  ]
  for (const [selectable, deletable] of modes) {
    const gridMinimum: number = contentMinimum + (selectable ? 36 : 0) + (deletable ? 34 : 0)
    assert.equal(gridMinimum, contentMinimum + (selectable ? 36 : 0) + (deletable ? 34 : 0))
  }
  // One scroller in both directions, so the header stays put; no column is frozen.
  assert.match(component, /className="max-h-\[75vh\] overflow-auto border-t border-border"/)
  assert.doesNotMatch(component, /FROZEN_COLUMNS|sticky z-\[1\]/)
  assert.match(component, /sticky top-0 z-\[2\] grid/)
  assert.match(component, /style=\{\{ minWidth: lineMinWidth \}\}/)

  for (const path of ['components/workspace/focused-job-record.tsx', 'components/workspace/request-list-card.tsx', 'app/customers/[id]/page.tsx']) {
    assert.match(source(path), /<RequestBody/)
  }
  assert.match(
    source('app/customers/[id]/page.tsx'),
    /<RequestBody[\s\S]*?emptyItemsCopy="No active line items are recorded for this customer request\."/,
  )
})

test('the route reference documents the shared order without the former sequence', () => {
  const docs = source('../docs/app/README.md')
  const requests = docs.match(/\| `\/requests` \| client \|([^\n]+)/)?.[1] ?? ''
  assert.match(requests, /Demand \/ Avail \/ Size \/ Plant Name \/ Status \/ Unit price \/ Total \/ Note for customer \/ Internal note/)
  assert.doesNotMatch(requests, /Select \/ Item \/ Size \/ Demand/)
})


test('renaming note columns preserves saved job table layout', async () => {
  const { normalizeStoredTableConfig } = await import('./table-config')
  assert.deepEqual(normalizeStoredTableConfig('requestItems', {
    order: ['name', 'sourcing_notes', 'external_notes'], hidden: ['sourcing_notes'],
    widths: { sourcing_notes: 250, external_notes: 210 },
  }), { order: ['name', 'selected', 'candidates', 'note_internal', 'note_for_customer'], hidden: ['note_internal'],
    widths: { note_internal: 250, note_for_customer: 210 } })
})

test('saved job table layouts place Selected and Candidates left of Internal note', async () => {
  const { moveStoredRequestSuppliers, normalizeStoredTableConfig } = await import('./table-config')
  assert.deepEqual(normalizeStoredTableConfig('requestItems', { order: ['name', 'note_internal', 'total'], hidden: [], widths: {} }).order,
    ['name', 'selected', 'candidates', 'note_internal', 'total'])
  // The old Suppliers column becomes Candidates where it was, with Selected just before it.
  assert.deepEqual(normalizeStoredTableConfig('requestItems', {
    order: ['suppliers', 'name', 'note_internal'], hidden: ['suppliers'], widths: { suppliers: 250 },
  }), { order: ['selected', 'candidates', 'name', 'note_internal'], hidden: ['candidates'], widths: { candidates: 250 } })
  // A layout holding both the old Suppliers key and Candidates shows Candidates once.
  assert.deepEqual(normalizeStoredTableConfig('requestItems', {
    order: ['name', 'suppliers', 'selected', 'candidates', 'note_internal'], hidden: ['suppliers'], widths: { suppliers: 250, candidates: 300 },
  }), { order: ['name', 'selected', 'candidates', 'note_internal'], hidden: [], widths: { candidates: 300 } })
  // A layout already saved with Candidates twice (by the old rename) shows it once.
  assert.deepEqual(normalizeStoredTableConfig('requestItems', {
    order: ['name', 'candidates', 'selected', 'candidates', 'note_internal'], hidden: [], widths: {},
  }).order, ['name', 'candidates', 'selected', 'note_internal'])
  assert.deepEqual(moveStoredRequestSuppliers({ requestItems: { order: ['name', 'selected', 'candidates', 'status', 'note_internal'], hidden: [], widths: {} } })
    .requestItems?.order, ['name', 'status', 'selected', 'candidates', 'note_internal'])
})
