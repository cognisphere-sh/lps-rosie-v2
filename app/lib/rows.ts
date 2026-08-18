// The row shapes the workspace tables render. `values` is keyed by the column
// keys in lib/columns.ts; `ref` carries the extra fields the UI needs but does
// not show as a column.

export type CellValue = string | number | string[] | null

export interface SupplierRef {
  id: number
  /** The company head; self for a single-location supplier. */
  headBranchId: number
  latitude: number | null
  longitude: number | null
  is_active: boolean
  address: string | null
}

/** One active ingested source file and its immutable ingestion timestamp. */
export interface SourceLink {
  label: string
  path: string
  ingestedAt: string
}

/** Another location the same contact covers — one row of `supplier_contacts`. */
export interface ContactLink {
  supplier_id: number
  supplier_name: string
}

/**
 * One active contact, as seen from one supplier.
 *
 * A contact is a person or inbox in its own right and can cover several
 * locations of a multi-location company, so `supplier_id` and `is_primary` are
 * not properties of the person — they come from the `supplier_contacts` link
 * this row was read through. Editing the fields below changes the contact
 * everywhere; `also_at` says where else that is.
 */
export interface Contact {
  id: number
  supplier_id: number
  name: string | null
  email: string | null
  phone: string | null
  title_department: string | null
  notes: string | null
  is_primary: boolean
  also_at: ContactLink[]
  created_at: string | null
  updated_at: string | null
}

/**
 * One location of the company the profile is showing, with everything its tabs
 * need to tag an entry with the farm it belongs to.
 *
 * The profile is one page per company: opened on a head-branch id its scope is
 * every active location of the company, opened on a farm id it is that farm
 * alone. `row.contacts` and `sources` therefore belong to *this* location, not
 * to the company — which is exactly what the location tag says.
 */
export interface SupplierScopeLocation {
  row: SupplierRow
  is_head: boolean
  sources: SupplierSource[]
}

/** The whole payload behind one supplier profile page. */
export interface SupplierProfile {
  /** The location the page is about — the head branch on a company page. */
  subjectId: number
  company: { id: number; name: string; locationCount: number }
  /** Every location in scope, head first. Exactly one on a farm page. */
  locations: SupplierScopeLocation[]
}

export interface SupplierRow {
  id: number
  ref: SupplierRef
  values: Record<string, CellValue>
  /** Parallel to values.inventory_sources, carrying the paths to link to. */
  sourceLinks: SourceLink[]
  /** Active contacts, primary first. Backs the profile's Contacts tab. */
  contacts: Contact[]
}

/**
 * One company result in Supplier Search — a single row, expandable.
 *
 * The row itself is the **head office**: its own name, contacts, website and
 * address. Only `# Items` and the ingestion columns are company-wide, because a
 * corporate office holds no stock and a row reading "0 items" would understate
 * the company it stands for. The farms beneath it are the ones that answered
 * the query, which is why `matchedCount` and `locationCount` can differ.
 */
export interface SupplierCompany {
  /** The head supplier row id; stable company identity. */
  id: number
  name: string
  /** The head-office row. Present whether or not it answered the query. */
  head: SupplierRow
  /** The farms that answered the query, head excluded. */
  locations: SupplierRow[]
  /** Every active location in the company, before search/filter narrowing. */
  locationCount: number
  /** Locations that answered the query, head included. */
  matchedCount: number
  /** Every active location id — what the page's `# Items` pass counts over. */
  locationIds: number[]
}

export interface PlantRow {
  id: string
  /** The farm that holds this row — never the company. `values.branch` names it. */
  supplierId: number | null
  values: Record<string, CellValue>
  /** Raw `inventory_sources.file_path` this row came from, if any. */
  sourcePath: string | null
}

/**
 * One company on the Plant search page — one card, one row per matched plant.
 *
 * Inventory is still location-scoped in the database: every plant belongs to
 * one farm, and `values.branch` on the row says which. The company is the unit
 * of *presentation* only, so the aggregates below describe the matched plants
 * across the company rather than any one farm's catalogue.
 */
export interface PlantGroup {
  /** Head-branch id; the company's stable identity. */
  companyId: number
  companyName: string
  /** The head-office row, carrying the aggregates over `plants`. */
  company: SupplierRow
  /** Active locations in the company. */
  locationCount: number
  /** Locations that contributed at least one matched plant. */
  matchedLocations: number
  plants: PlantRow[]
}

export interface SupplierSource {
  id: string
  file_path: string
  url: string
  notes: string | null
  created_at: string
}

/**
 * One catalogued plant photo, as the grid and the detail sheet render it.
 *
 * `imageUrl` is this app's own `/api/photos/<id>/image`, never a bucket URL:
 * the `plant-photos` bucket is private and the path is resolved from the row
 * server-side, so no storage key ever reaches the browser.
 */
export interface PhotoCard {
  id: string
  imageUrl: string
  name: string
  commonName: string | null
  botanicalName: string | null
  cultivar: string | null
  size: string | null
  height: string | null
  width: string | null
  caliper: string | null
  tags: string[]
  caption: string | null
  notes: string | null
  source: string | null
  /** When the photo was taken; distinct from `createdAt`, when we received it. */
  capturedAt: string | null
  createdAt: string | null
  mimeType: string | null
  byteSize: number | null
  pixels: { width: number; height: number } | null
  supplier: { id: number; name: string; city: string | null; state: string | null } | null
}

/**
 * One note on a job request or line item, as the notes popover renders it.
 *
 * The database keeps three note columns rather than a thread table
 * (`customer_notes` / `internal_notes` / `external_notes`), so a "thread" here
 * is those columns split into their timestamped entries — see `noteEntries` in
 * lib/queries.ts. `kind` is what decides who may see it: `internal` never
 * reaches a customer-facing surface.
 */
export interface JobNote {
  kind: 'customer' | 'internal' | 'shared'
  /** Entry timestamp when the note was written `[YYYY-MM-DD HH:MM …]`, else null. */
  stamp: string | null
  text: string
}

/** The four address parts, kept separate so each is individually editable. */
export interface JobAddress {
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
}

/** One line item of a job request. */
export interface JobRequestItem {
  id: number
  name: string
  size: string | null
  /** What the customer asked for. */
  quantity: number | null
  /** What we can supply: null = unanswered, 0 = confirmed none (migration 0056). */
  availableQuantity: number | null
  unitPrice: number | null
  /** Generated in the database as quantity × unit_price — never written. */
  total: number | null
  status: string
  needsAttention: boolean
  notes: JobNote[]
  /** Raw `external_notes`, for the editor — `notes` is the parsed view of it. */
  externalNotes: string | null
  updatedAt: string | null
}

/** Per-status line counts behind a request's KPI pills. */
export type StatusCounts = Record<string, number>

/**
 * One job request, collapsed or expanded.
 *
 * Everything the collapsed card shows is on the request itself — the counts and
 * `lineTotal` are computed server-side over *all* its items, so a collapsed card
 * never lies about a request whose items are filtered out of view.
 */
export interface JobRequestRow {
  id: number
  status: string
  needsAttention: boolean
  customer: { id: number; name: string; company: string | null; email: string | null; phone: string | null } | null
  billing: JobAddress
  shipping: JobAddress
  customerNotes: string | null
  notes: JobNote[]
  /** Raw `external_notes`, for the editor — `notes` is the parsed view of it. */
  externalNotes: string | null
  itemCount: number
  /** Items needing attention, by flag or by an unanswered/short quantity. */
  attentionCount: number
  statusCounts: StatusCounts
  lineTotal: number
  items: JobRequestItem[]
  createdAt: string | null
  updatedAt: string | null
}

/** The option lists the job-request filters offer, for one search. */
export interface JobRequestFacets {
  size: string[]
  customer: { id: number; name: string; company: string | null }[]
}

/** The option lists the photo-catalogue filters offer, for one search. */
export interface PhotoFacets {
  size: string[]
  tag: string[]
  /** Display names; the filter matches the normalized `cultivar_keys` array. */
  cultivar: string[]
  /** City and state so two locations of one company can be told apart in the
   *  dropdown; the filter itself selects on `id`. */
  supplier: { id: number; name: string; city: string | null; state: string | null }[]
}
