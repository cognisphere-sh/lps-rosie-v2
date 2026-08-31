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
    component,
    /const LINE_COLUMNS =\s*\n\s*'66px 66px 72px minmax\(170px,1\.4fr\) 124px 86px 92px minmax\(145px,\.9fr\) minmax\(145px,\.9fr\)'/,
  )
  assert.match(
    component,
    /\[selectable \? `\$\{SELECT_COLUMN\}px` : null, LINE_COLUMNS, deletable \? `\$\{ACTION_COLUMN\}px` : null\]/,
  )

  const header = component.slice(
    component.indexOf('{/* Column header'),
    component.indexOf('{request.items.length'),
  )
  ordered(header, [
    '>Demand</div>',
    '>Avail</div>',
    '>Size</div>',
    '>Plant Name</div>',
    '>Status</div>',
    '>Unit price</div>',
    '>Total</div>',
    '>Shared note</div>',
    '>Sourcing note</div>',
  ])
  assert.doesNotMatch(header, />Item<\/div>/)
})

test('row fields and behavior move with their headers without changing semantics', () => {
  const row = component.slice(component.indexOf('function ItemRow('), component.indexOf('/** One labelled, editable field'))
  ordered(row, [
    'column="quantity"',
    'column="available_quantity"',
    'column="size"',
    'column="name"',
    '<StatusPill',
    'column="unit_price"',
    'money(item.total)',
    'kind="shared"',
    'kind="internal"',
  ])
  assert.match(row, /column="quantity"[\s\S]*?title="Demand — what the customer asked for"/)
  assert.match(row, /style=\{\{ color: coverColor\(cover\) \}\}[\s\S]*?column="available_quantity"[\s\S]*?title="Avail — how many we can supply\. Blank means not answered yet\."/)
  assert.match(row, /column="name" value=\{item\.name\}[\s\S]*?item\.customerNotes/)
  assert.match(row, /<StatusPill[\s\S]*?column="status"[\s\S]*?options=\{ITEM_STATUS_OPTIONS\}/)
})

test('one horizontally scrolling RequestBody layout serves every consumer at safe width', () => {
  const tracks = [66, 66, 72, 170, 124, 86, 92, 145, 145]
  const contentMinimum = tracks.reduce((sum, width) => sum + width, 0)
  assert.equal(contentMinimum, 966)
  assert.match(component, /const GRID_MIN = 1050/)
  const modes: Array<readonly [boolean, boolean]> = [
    [false, false], [true, false], [false, true], [true, true],
  ]
  for (const [selectable, deletable] of modes) {
    const gridMinimum: number = contentMinimum + (selectable ? 36 : 0) + (deletable ? 34 : 0)
    const wrapperMinimum: number = 1050 - (selectable ? 0 : 36) + (deletable ? 34 : 0)
    assert.equal(wrapperMinimum - gridMinimum, 48)
  }
  assert.match(component, /className="overflow-x-auto border-t border-border"/)
  assert.match(component, /GRID_MIN - \(onSelect \? 0 : SELECT_COLUMN\) \+ \(onDeleteItem \? ACTION_COLUMN : 0\)/)

  for (const path of ['app/jobs/page.tsx', 'components/workspace/request-list-card.tsx', 'app/customers/[id]/page.tsx']) {
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
