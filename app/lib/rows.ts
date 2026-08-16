// The row shapes the workspace tables render. `values` is keyed by the column
// keys in lib/columns.ts; `ref` carries the extra fields the UI needs but does
// not show as a column.

export type CellValue = string | number | string[] | null

export interface SupplierRef {
  id: number
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
 * Another active location of the same company — a sibling row sharing this
 * supplier's `head_branch_id`.
 *
 * A company that operates at several sites is several `suppliers` rows, one per
 * location, and one of them is the head branch (see docs/supabase-schema.md).
 * This never includes the supplier being viewed, so `is_head` is false on every
 * entry when the supplier being viewed is itself the head.
 */
export interface SupplierLocation {
  id: number
  name: string
  category: string | null
  city: string | null
  state: string | null
  is_head: boolean
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

export interface PlantRow {
  id: string
  supplierId: number | null
  values: Record<string, CellValue>
  /** Raw `inventory_sources.file_path` this row came from, if any. */
  sourcePath: string | null
}

export interface PlantGroup {
  supplier: SupplierRow
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

/** The option lists the photo-catalogue filters offer, for one search. */
export interface PhotoFacets {
  size: string[]
  tag: string[]
  /** City and state so two locations of one company can be told apart in the
   *  dropdown; the filter itself selects on `id`. */
  supplier: { id: number; name: string; city: string | null; state: string | null }[]
}
