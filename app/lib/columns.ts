// Column definitions, verbatim from the "Supplier Workspace" design, with the
// keys pointed at the real Supabase columns (docs/supabase-schema.md).
//
// `edit: true` means the cell writes back to the database. Only columns that
// are real, writable columns on their table carry it — derived values
// (other_names, source, item_count, the aggregates) never do.

export type FilterKind = 'text' | 'range' | 'multiselect' | 'none'
/**
 * `link` = opens the supplier profile; `list` = the scrollable source-file
 * list; `file` = a single source file; `url` = an external web address.
 */
export type CellKind = 'plain' | 'link' | 'badge' | 'list' | 'file' | 'url'

/** `suppliers.website` is usually a bare domain ("acostafarms.com"). */
export function websiteHref(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

export interface ColumnDef {
  key: string
  label: string
  width: number
  kind?: CellKind
  filter?: FilterKind
  align?: 'left' | 'right'
  edit?: boolean
  money?: boolean
  num?: boolean
  /** Table + column this cell writes to when edited. */
  writes?: { table: 'suppliers' | 'inventory'; column: string }
}

export const SUPPLIER_COLS: ColumnDef[] = [
  { key: 'name', label: 'Name', width: 210, kind: 'link' },
  { key: 'category', label: 'Category', width: 128, kind: 'badge', filter: 'multiselect' },
  { key: 'poc_name', label: 'PoC name', width: 150, edit: true, writes: { table: 'suppliers', column: 'poc_name' } },
  { key: 'poc_email', label: 'PoC email', width: 210, edit: true, writes: { table: 'suppliers', column: 'poc_email' } },
  { key: 'poc_phone', label: 'PoC phone', width: 145, edit: true, writes: { table: 'suppliers', column: 'poc_phone' } },
  { key: 'email', label: 'Email', width: 200, edit: true, writes: { table: 'suppliers', column: 'email' } },
  { key: 'phone', label: 'Phone', width: 145, edit: true, writes: { table: 'suppliers', column: 'phone' } },
  { key: 'website', label: 'Website', width: 190, kind: 'url', filter: 'none' },
  { key: 'inventory_sources', label: 'Inventory sources', width: 210, kind: 'list', filter: 'none' },
  { key: 'item_count', label: '# Items', width: 96, align: 'right', filter: 'range' },
  { key: 'city', label: 'City', width: 150, edit: true, filter: 'multiselect', writes: { table: 'suppliers', column: 'city' } },
  { key: 'state', label: 'State', width: 96, edit: true, filter: 'multiselect', writes: { table: 'suppliers', column: 'state' } },
  // `notes` = durable profile facts (quirks, preferences, anything the schema
  // has no column for). `communication_notes` = an append-only contact log.
  // See docs/supabase-schema.md — they are not interchangeable.
  { key: 'notes', label: 'Notes', width: 230, edit: true, writes: { table: 'suppliers', column: 'notes' } },
  { key: 'communication_notes', label: 'Communication notes', width: 260, edit: true, writes: { table: 'suppliers', column: 'communication_notes' } },
  { key: 'created_at', label: 'Created at', width: 130, filter: 'none' },
  { key: 'updated', label: 'Last updated', width: 140, filter: 'none' },
]
export const SUPPLIER_HIDDEN = ['email', 'phone', 'created_at', 'notes', 'communication_notes']

// Plant search — master rows are suppliers with a plant count.
export const MASTER_COLS: ColumnDef[] = [
  { key: 'name', label: 'Name', width: 220, kind: 'link' },
  { key: 'plant_count', label: '# Plants', width: 104, align: 'right', filter: 'none' },
  { key: 'category', label: 'Category', width: 128, kind: 'badge', filter: 'multiselect' },
  { key: 'state', label: 'State', width: 96, filter: 'multiselect' },
  { key: 'city', label: 'City', width: 150, filter: 'multiselect' },
  { key: 'poc_name', label: 'PoC name', width: 150 },
  { key: 'poc_email', label: 'PoC email', width: 210 },
  { key: 'poc_phone', label: 'PoC phone', width: 145 },
  { key: 'website', label: 'Website', width: 190, kind: 'url', filter: 'none' },
  { key: 'inventory_sources', label: 'Inventory sources', width: 210, kind: 'list', filter: 'none' },
  { key: 'cheapest', label: 'Lowest price', width: 120, align: 'right', filter: 'range', money: true },
  { key: 'in_stock', label: 'In stock', width: 108, align: 'right', filter: 'range', num: true },
  { key: 'updated', label: 'Last updated', width: 140, filter: 'none' },
]
export const MASTER_VISIBLE = [
  'name', 'plant_count', 'category', 'poc_name', 'poc_phone', 'poc_email', 'city', 'state', 'updated',
]
export const MASTER_HIDDEN = MASTER_COLS.map((c) => c.key).filter((k) => !MASTER_VISIBLE.includes(k))

// Plant sub-table (the second table on Plant search, and the profile's Inventory tab).
export const PLANT_COLS: ColumnDef[] = [
  { key: 'name', label: 'Plant', width: 200, edit: true, writes: { table: 'inventory', column: 'name' } },
  { key: 'other', label: 'Other names', width: 190 },
  { key: 'cat', label: 'Category', width: 120, filter: 'multiselect' },
  { key: 'size', label: 'Size', width: 104, filter: 'multiselect' },
  { key: 'price', label: 'Price', width: 100, align: 'right', edit: true, filter: 'range', money: true, writes: { table: 'inventory', column: 'unit_price' } },
  { key: 'qty', label: 'Quantity', width: 104, align: 'right', edit: true, filter: 'range', num: true, writes: { table: 'inventory', column: 'quantity' } },
  { key: 'h', label: 'Height', width: 92, edit: true, filter: 'none', writes: { table: 'inventory', column: 'height' } },
  { key: 'w', label: 'Width', width: 92, edit: true, filter: 'none', writes: { table: 'inventory', column: 'width' } },
  { key: 'cal', label: 'Caliper', width: 92, edit: true, filter: 'none', writes: { table: 'inventory', column: 'caliper' } },
  { key: 'variety', label: 'Variety', width: 124, edit: true, writes: { table: 'inventory', column: 'variety' } },
  { key: 'notes', label: 'Notes', width: 190, edit: true, writes: { table: 'inventory', column: 'notes' } },
  { key: 'source', label: 'Source', width: 180, kind: 'file', filter: 'none' },
  { key: 'updated', label: 'Last updated', width: 130, filter: 'none' },
]
export const PLANT_HIDDEN = ['variety', 'notes', 'cal']

export type TableId = 'suppliers' | 'plantMaster' | 'plants'

export const TABLE_COLS: Record<TableId, ColumnDef[]> = {
  suppliers: SUPPLIER_COLS,
  plantMaster: MASTER_COLS,
  plants: PLANT_COLS,
}

export const DEFAULT_HIDDEN: Record<TableId, string[]> = {
  suppliers: SUPPLIER_HIDDEN,
  plantMaster: MASTER_HIDDEN,
  plants: PLANT_HIDDEN,
}
