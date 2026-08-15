// Column definitions, verbatim from the "Supplier Workspace" design, with the
// keys pointed at the real Supabase columns (docs/supabase-schema.md).
//
// `edit: true` means the cell writes back to the database. Only columns that
// are real, writable columns on their table carry it — derived values
// (source, item_count, the aggregates) never do.

import type { CellValue } from '@/lib/rows'

export type FilterKind = 'text' | 'range' | 'multiselect' | 'none'
/**
 * `link` = opens the supplier profile; `list` = the scrollable source-file
 * list; `file` = a single source file; `url` = an external web address;
 * `contacts` = the supplier's non-primary contacts, deep-linking to their tab;
 * `select` = edits through a dropdown of `options` rather than a free text box.
 */
export type CellKind = 'plain' | 'link' | 'badge' | 'list' | 'file' | 'url' | 'contacts' | 'select'

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
  /** Optional numeric row value used to filter/sort a human-readable column. */
  filterValueKey?: string
  /**
   * The cell holds several comma-separated values (a row's cultivar column can
   * name a cultivar *and* a trade name). The multiselect then offers one option
   * per name rather than one per combination, and a row matches if **any** of
   * its names is selected — the same shape the database's `cultivar_keys`
   * array match has.
   */
  multiValue?: boolean
  /** Unit shown in numeric range controls. */
  filterUnit?: string
  align?: 'left' | 'right'
  edit?: boolean
  money?: boolean
  num?: boolean
  /** For kind="select": the values the dropdown offers. Blank always clears. */
  options?: string[]
  /** Table + column this cell writes to when edited. */
  writes?: { table: 'suppliers' | 'inventory'; column: string }
}

/** `suppliers.availability_source_type` — how a supplier's list reaches us. */
export const AVAILABILITY_SOURCE_TYPES = ['Email', 'Hosted']

export const SUPPLIER_COLS: ColumnDef[] = [
  { key: 'name', label: 'Name', width: 210, kind: 'link' },
  { key: 'category', label: 'Category', width: 128, kind: 'badge', filter: 'multiselect' },
  // Contacts live in their own table keyed by contact id, so these are read-only
  // here — a supplier row has no single contact id to write back to. Editing,
  // adding and promoting happen on the profile's Contacts tab.
  { key: 'primary_contact_name', label: 'Primary contact', width: 150 },
  { key: 'primary_contact_email', label: 'Primary email', width: 210 },
  { key: 'primary_contact_phone', label: 'Primary phone', width: 145 },
  { key: 'other_contacts', label: 'Other contacts', width: 190, kind: 'contacts', filter: 'none' },
  { key: 'website', label: 'Website', width: 190, kind: 'url', filter: 'none' },
  { key: 'inventory_sources', label: 'Inventory sources', width: 210, kind: 'list', filter: 'none' },
  { key: 'last_ingestion_date', label: 'Last ingestion', width: 138, filter: 'none' },
  // How the supplier's availability reaches us, and how often. All three are
  // nullable — blank means nobody has established it yet, not "none".
  {
    key: 'availability_source_type', label: 'Availability source', width: 150,
    kind: 'select', options: AVAILABILITY_SOURCE_TYPES, filter: 'multiselect', edit: true,
    writes: { table: 'suppliers', column: 'availability_source_type' },
  },
  {
    key: 'availability_update_days', label: 'Update every (days)', width: 150,
    align: 'right', num: true, filter: 'range', edit: true,
    writes: { table: 'suppliers', column: 'availability_update_days' },
  },
  {
    key: 'hosted_availability_url', label: 'Hosted availability', width: 210,
    kind: 'url', filter: 'none', edit: true,
    writes: { table: 'suppliers', column: 'hosted_availability_url' },
  },
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
export const SUPPLIER_HIDDEN = ['created_at', 'notes', 'communication_notes']

// Plant search — master rows are suppliers with a plant count.
export const MASTER_COLS: ColumnDef[] = [
  { key: 'name', label: 'Name', width: 220, kind: 'link' },
  { key: 'plant_count', label: '# Plants', width: 104, align: 'right', filter: 'none' },
  { key: 'category', label: 'Category', width: 128, kind: 'badge', filter: 'multiselect' },
  { key: 'state', label: 'State', width: 96, filter: 'multiselect' },
  { key: 'city', label: 'City', width: 150, filter: 'multiselect' },
  { key: 'primary_contact_name', label: 'Primary contact', width: 150 },
  { key: 'primary_contact_email', label: 'Primary email', width: 210 },
  { key: 'primary_contact_phone', label: 'Primary phone', width: 145 },
  { key: 'other_contacts', label: 'Other contacts', width: 190, kind: 'contacts', filter: 'none' },
  { key: 'website', label: 'Website', width: 190, kind: 'url', filter: 'none' },
  { key: 'inventory_sources', label: 'Inventory sources', width: 210, kind: 'list', filter: 'none' },
  { key: 'last_ingestion_date', label: 'Last ingestion', width: 138, filter: 'none' },
  { key: 'cheapest', label: 'Lowest price', width: 120, align: 'right', filter: 'range', money: true },
  { key: 'in_stock', label: 'In stock', width: 108, align: 'right', filter: 'range', num: true },
  { key: 'updated', label: 'Last updated', width: 140, filter: 'none' },
]
export const MASTER_VISIBLE = [
  'name', 'plant_count', 'category', 'primary_contact_name', 'primary_contact_phone',
  'primary_contact_email', 'city', 'state', 'updated',
]
export const MASTER_HIDDEN = MASTER_COLS.map((c) => c.key).filter((k) => !MASTER_VISIBLE.includes(k))

// Plant sub-table (the second table on Plant search, and the profile's Inventory tab).
export const PLANT_COLS: ColumnDef[] = [
  // The whole identity: "Common name [botanical name, cultivar]". The database
  // derives it from the three part columns below (migration 0040), so it is
  // read-only here — edit a part and this recomposes.
  { key: 'name', label: 'Full Name', width: 220 },
  { key: 'common_name', label: 'Common name', width: 170, edit: true, writes: { table: 'inventory', column: 'common_name' } },
  { key: 'botanical_name', label: 'Botanical name', width: 180, edit: true, writes: { table: 'inventory', column: 'botanical_name' } },
  // Cultivar, variety and trade name share one column; the header filter is a
  // multi-select over the cultivars present in the current result set.
  {
    key: 'cultivar', label: 'Cultivar', width: 170, filter: 'multiselect',
    multiValue: true, edit: true,
    writes: { table: 'inventory', column: 'cultivar_variety_trade_name' },
  },
  // The cell shows the supplier's own size text; the filter selects on the
  // standardized bucket beside it (lib/size-std.ts).
  { key: 'size', label: 'Size', width: 104, filter: 'multiselect', filterValueKey: 'size_std' },
  { key: 'price', label: 'Price', width: 100, align: 'right', edit: true, filter: 'range', money: true, writes: { table: 'inventory', column: 'unit_price' } },
  { key: 'qty', label: 'Quantity', width: 104, align: 'right', edit: true, filter: 'range', num: true, writes: { table: 'inventory', column: 'quantity' } },
  {
    key: 'h', label: 'Height', width: 112, edit: true, filter: 'range',
    filterValueKey: 'h_std', filterUnit: 'ft', writes: { table: 'inventory', column: 'height' },
  },
  {
    key: 'w', label: 'Width', width: 112, edit: true, filter: 'range',
    filterValueKey: 'w_std', filterUnit: 'in', writes: { table: 'inventory', column: 'width' },
  },
  {
    key: 'cal', label: 'Caliper', width: 112, edit: true, filter: 'range',
    filterValueKey: 'cal_std', filterUnit: 'in', writes: { table: 'inventory', column: 'caliper' },
  },
  // `notes` = what the supplier said about the offering (their row description,
  // dated availability, lead time). `internal_notes` = what we said about it
  // (split sizes, tentative quantities, parse caveats). Split by migration 0039.
  { key: 'notes', label: 'Notes', width: 190, edit: true, writes: { table: 'inventory', column: 'notes' } },
  { key: 'internal_notes', label: 'Internal notes', width: 190, edit: true, writes: { table: 'inventory', column: 'internal_notes' } },
  { key: 'source', label: 'Source', width: 180, kind: 'file', filter: 'none' },
  { key: 'ingestion_date', label: 'Ingested', width: 130, filter: 'none' },
  { key: 'updated', label: 'Last updated', width: 130, filter: 'none' },
]
// Common and botanical name are hidden by default, not absent: the Full Name
// column already shows both inside the composed identity, so showing them costs
// 350px for no new information. Unhide either to edit it.
export const PLANT_HIDDEN = ['common_name', 'botanical_name', 'notes', 'internal_notes', 'cal']

/**
 * The patch an inline plant edit applies to the row on screen.
 *
 * Editing a name part has to move the read-only Full Name column with it, or the
 * table shows an identity the database no longer holds until the next fetch.
 * This mirrors `compose_plant_name()` (migrations 0040/0043) — the database stays
 * authoritative; this is the optimistic copy, replaced by the real value on the
 * next load.
 */
const NAME_PARTS = ['common_name', 'botanical_name', 'cultivar'] as const

/** The individual names in a cell that holds a comma-separated list. */
export function splitMultiValue(raw: unknown): string[] {
  return String(raw ?? '')
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function plantEditPatch(
  values: Record<string, CellValue>,
  col: ColumnDef,
  next: string,
): Record<string, CellValue> {
  const patch: Record<string, CellValue> = {
    [col.key]: next || null,
    // A hand-edited source string invalidates its standardized companion until
    // ingestion or review supplies a reviewed pair.
    ...(col.filterValueKey ? { [col.filterValueKey]: null } : {}),
  }
  if (!(NAME_PARTS as readonly string[]).includes(col.key)) return patch

  const parts = NAME_PARTS.map((key) =>
    String((key === col.key ? patch[key] : values[key]) ?? '').trim(),
  ).filter(Boolean)
  patch.name = parts.length ? parts.join(' - ') : values.name
  return patch
}

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
