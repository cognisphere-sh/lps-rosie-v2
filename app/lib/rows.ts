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

/** One ingested source file: display name plus the raw `file_path` to sign. */
export interface SourceLink {
  label: string
  path: string
}

export interface SupplierRow {
  id: number
  ref: SupplierRef
  values: Record<string, CellValue>
  /** Parallel to values.inventory_sources, carrying the paths to link to. */
  sourceLinks: SourceLink[]
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
