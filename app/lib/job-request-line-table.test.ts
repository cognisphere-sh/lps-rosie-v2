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
    /export const REQUEST_ITEM_COLS[\s\S]*?key: 'status'[\s\S]*?key: 'external_notes'[\s\S]*?key: 'unit_price'/,
  )
  assert.match(
    component,
    /columns\.map\(\(column\) => `\$\{widthOf\(column\)\}px`\)/,
  )
  assert.doesNotMatch(component, /Add a shared note/)

  assert.match(component, /<LineColumnHeader[\s\S]*?onMove=\{lineTable\.moveColumn\}[\s\S]*?onResize=/)
  assert.match(component, /draggable[\s\S]*?drag to reorder/)
  assert.match(component, /aria-label=\{`Resize \$\{column\.label\}`\}/)
})

test('row fields and behavior move with their headers without changing semantics', () => {
  const row = component.slice(component.indexOf('function ItemRow('), component.indexOf('/** One labelled, editable field'))
  ordered(row, [
    'column="quantity"',
    'column="available_quantity"',
    'column="size"',
    'column="name"',
    '<StatusPill',
    'kind="shared"',
    'column="unit_price"',
    'money(quoteLineTotal(item))',
    'kind="internal"',
  ])
  assert.match(row, /column="quantity"[\s\S]*?title="Demand — what the customer asked for"/)
  assert.match(row, /style=\{\{ color: coverColor\(cover\) \}\}[\s\S]*?column="available_quantity"[\s\S]*?title="Avail — how many we can supply\. Blank means not answered yet\."/)
  assert.match(row, /zero when unavailable; otherwise available quantity × unit price, falling back to demand[\s\S]*?quoteLineTotal\(item\)/)
  assert.match(row, /column="name" value=\{item\.name\}[\s\S]*?item\.customerNotes/)
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
  assert.match(component, /className="overflow-x-auto border-t border-border"/)
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
  assert.match(requests, /Demand \/ Avail \/ Size \/ Plant Name \/ Status \/ Unit price \/ Total \/ Shared note \/ Sourcing note/)
  assert.doesNotMatch(requests, /Select \/ Item \/ Size \/ Demand/)
})
