import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { join } from 'node:path'

import { SUPPLIER_FILTERS, filterQuery, parseFilters } from './server-filters.ts'
import { supplierFilterSummary, supplierFilterValues } from './supplier-filters.ts'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

test('advanced filter values and the one toolbar summary preserve every selected value', () => {
  const values = supplierFilterValues({
    name: 'oak',
    city: ['Austin', 'Dallas'],
    category: ['Grower', 'Broker/Platform'],
    state: ['TX', 'LA'],
    lps_partner: ['false'],
  })

  assert.deepEqual(values, {
    name: 'oak', city: ['Austin', 'Dallas'], category: ['Grower', 'Broker/Platform'],
    state: ['TX', 'LA'], partner: ['false'],
  })
  assert.deepEqual(supplierFilterSummary(values), [
    'Name: oak', 'City: Austin, Dallas', 'Type: Grower, Broker/Platform',
    'State: TX, LA', 'Partner: Not partners',
  ])
})

test('Supplier advanced state keeps the established stable URL and server meanings', () => {
  const query = filterQuery('supplier', SUPPLIER_FILTERS, {
    city: ['Dallas', 'Austin'], name: ' oak ', lps_partner: ['false'],
  })
  assert.equal(query, 's.city=Austin&s.city=Dallas&s.lps_partner=false&s.name=oak')
  assert.deepEqual(parseFilters('supplier', SUPPLIER_FILTERS, new URLSearchParams(query)), [
    { kind: 'in', column: 'city', values: ['Austin', 'Dallas'] },
    { kind: 'in', column: 'is_lps_partner', values: ['false'] },
    { kind: 'ilike', column: 'name', value: 'oak' },
  ])
})

test('Suppliers wiring keeps one filter owner, desktop paging, and bounded mobile append', () => {
  const page = source('app/suppliers/page.tsx')
  const filterPanel = source('components/workspace/supplier-filters.tsx')
  const columns = source('lib/columns.ts')
  const queries = source('lib/queries.ts')
  const searchRpc = source('../harness/agents/daisy/migrations/0074_rename_is_onboarded_to_is_lps_partner.sql')
  const supplierHead = page.slice(page.indexOf('<ColumnHead'), page.indexOf('/>', page.indexOf('<ColumnHead')) + 2)

  assert.equal((page.match(/<SupplierFilters/g) ?? []).length, 1)
  assert.doesNotMatch(page, /<MultiFilter|chips=\{/)
  assert.match(page, /Search name, contact, email, city…/)
  assert.match(page, /const searchKey = `\$\{debouncedQuery\}\\n\$\{debouncedServerQuery\}`[\s\S]*setPage\(1\)/)
  assert.match(page, /pagination=\{isMobile \? undefined : \{ page, pageCount, onPage: setPage/)
  assert.match(page, /const nextPage = page \+ 1[\s\S]*requestId = \+\+loadRequestId\.current[\s\S]*await fetchSupplierPage[\s\S]*loadRequestId\.current !== requestId[\s\S]*setPage\(nextPage\)/)
  assert.match(page, /catch \{[\s\S]*setLoadMoreError\(true\)/)
  assert.match(page, /Retry load 50 more/)
  assert.match(page, /const clearAll = \(\) => \{[\s\S]*loadRequestId\.current \+= 1[\s\S]*setPage\(1\)[\s\S]*current\.slice\(0, 50\)/)
  assert.match(page, /if \(isMobile && page > 1\) return/)
  assert.match(page, /`\$\{visibleCompanies\.length\}\/\$\{total\} Companies`/)
  assert.match(filterPanel, /allLabel="Supplier type"[\s\S]*allLabel="State"/)
  assert.match(filterPanel, /allLabel="State"[^\n]*menuAlign="right"/)
  assert.match(filterPanel, /setPointerCapture\(event\.pointerId\)[\s\S]*releasePointerCapture\(event\.pointerId\)/)
  assert.match(filterPanel, /title="Advanced filters"/)
  assert.match(filterPanel, /Clear all[\s\S]*Show results/)
  const advancedFields = filterPanel.slice(filterPanel.indexOf("const body ="), filterPanel.indexOf("return (\n    <div ref={pop}"))
  assert.match(advancedFields, /Name contains/)
  assert.match(advancedFields, /City/)
  assert.match(advancedFields, /LPS Partner/)
  assert.doesNotMatch(advancedFields, /allLabel="Supplier type"|allLabel="State"/)
  assert.match(supplierHead, /onSort=/)
  assert.match(supplierHead, /onResize=/)
  assert.match(supplierHead, /onMove=/)
  assert.doesNotMatch(supplierHead, /filters=|options=|onFilter=/)
  assert.match(page, /<ColumnPicker/)
  assert.match(columns, /key: 'city', label: 'City'.*filter: 'multiselect'.*column: 'city'/)
  assert.match(queries, /select\('category, city, state, availability_source_type'\)/)
  assert.match(searchRpc, /coalesce\(s\.city, ''\)/)
})
