'use client'

import { useCallback, useState } from 'react'

import { EyeOffIcon, TrashIcon } from '@/components/workspace/icons'
import { Cell, ColumnHead, ColumnPicker } from '@/components/workspace/table-parts'
import { PLANT_COLS, type ColumnDef } from '@/lib/columns'
import { formatDate } from '@/lib/format'
import type { PlantRow, SupplierRow } from '@/lib/rows'
import { cn } from '@/lib/utils'
import type { useTableConfig } from '@/lib/table-config'

export type PlantConfig = ReturnType<typeof useTableConfig>

export type PlantLocationFacts = {
  primaryLabel: 'Stock location' | 'Supplier location' | 'Location'
  primary: string
  supplier: string | null
}

const locationPart = (value: unknown) => typeof value === 'string' && value.trim()
  ? value.trim().replace(/\s+/gu, ' ')
  : null
const locality = (city: unknown, state: unknown) => [locationPart(city), locationPart(state)].filter(Boolean).join(', ')

export const PLANT_GROUP_LOCATION_LIMIT = 3
export const PLANT_GROUP_LOCATION_CUE_MAX_UNITS = 28
export const PLANT_GROUP_LOCATION_CUE_BYTES = 64

const utf8Bytes = (value: string) => new TextEncoder().encode(value).length
const codePoints = (value: string) => Array.from(value).length

const boundWholeTokens = (value: string) => {
  const tokens = value.trim().split(/\s+/u).filter(Boolean)
  const shown: string[] = []
  for (const token of tokens) {
    const candidate = [...shown, token].join(' ')
    if (
      codePoints(`${candidate}…`) > PLANT_GROUP_LOCATION_CUE_MAX_UNITS ||
      utf8Bytes(`${candidate}…`) > PLANT_GROUP_LOCATION_CUE_BYTES
    ) break
    shown.push(token)
  }
  return shown.length ? `${shown.join(' ')}…` : '…'
}

export function boundPlantGroupLocation(value: string) {
  if (typeof Intl.Segmenter !== 'function') {
    if (
      codePoints(value) <= PLANT_GROUP_LOCATION_CUE_MAX_UNITS &&
      utf8Bytes(value) <= PLANT_GROUP_LOCATION_CUE_BYTES
    ) return value
    return boundWholeTokens(value)
  }

  const clusters = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)]
    .map((part) => part.segment)
  if (
    clusters.length <= PLANT_GROUP_LOCATION_CUE_MAX_UNITS &&
    utf8Bytes(value) <= PLANT_GROUP_LOCATION_CUE_BYTES
  ) return value
  const shown: string[] = []
  for (const cluster of clusters) {
    if (shown.length >= PLANT_GROUP_LOCATION_CUE_MAX_UNITS - 1) break
    if (utf8Bytes(shown.join('') + cluster + '…') > PLANT_GROUP_LOCATION_CUE_BYTES) break
    shown.push(cluster)
  }
  return `${shown.join('')}…`
}

/** Truthful location facts for one inventory match, with no source/delivery inference. */
export function plantLocationFacts(row: PlantRow, company: SupplierRow): PlantLocationFacts {
  const stockName = locationPart(row.stockLocation?.name) ?? locationPart(row.values.branch)
  const stockLocality = locality(row.stockLocation?.city, row.stockLocation?.state)
  const stock = [stockName, stockLocality].filter((part, index, parts) => part && parts.indexOf(part) === index).join(' · ')
  const supplier = locality(company.values.city, company.values.state)

  if (stock) {
    const distinctSupplier = row.supplierId !== company.id && supplier && supplier.toLocaleLowerCase() !== stockLocality.toLocaleLowerCase()
      ? supplier
      : null
    return { primaryLabel: 'Stock location', primary: stock, supplier: distinctSupplier }
  }
  if (supplier) return { primaryLabel: 'Supplier location', primary: supplier, supplier: null }
  return { primaryLabel: 'Location', primary: 'not recorded', supplier: null }
}

export function plantGroupLocationSummary(plants: PlantRow[], company: SupplierRow) {
  const locations: string[] = []
  const seen = new Set<string>()
  const supplier = locality(company.values.city, company.values.state)
  for (const plant of plants) {
    const stockLocality = locality(plant.stockLocation?.city, plant.stockLocation?.state)
    const stockName = locationPart(plant.stockLocation?.name) ?? locationPart(plant.values.branch)
    const display = stockLocality || stockName || (supplier ? `Supplier: ${supplier}` : 'Not recorded')
    const key = display.normalize('NFKC').toLocaleLowerCase('en-US')
    if (seen.has(key)) continue
    seen.add(key)
    locations.push(display)
  }
  if (!locations.length) locations.push('Not recorded')
  const shown = locations.slice(0, PLANT_GROUP_LOCATION_LIMIT).map(boundPlantGroupLocation)
  const omitted = locations.length - shown.length
  const remainder = omitted ? ` · +${omitted} more locations` : ''
  return `Match location${locations.length === 1 ? '' : 's'}: ${shown.join(' · ')}${remainder}`
}

export function PlantLocationCue({
  row,
  company,
  className,
}: {
  row: PlantRow
  company: SupplierRow
  className?: string
}) {
  const facts = plantLocationFacts(row, company)
  return (
    <div
      data-plant-location-cue
      data-location-kind={facts.primaryLabel.toLowerCase().replace(' ', '-')}
      className={cn('flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] leading-snug', className)}
    >
      {facts.primaryLabel === 'Location' ? (
        <span className="font-semibold text-muted-foreground">Location not recorded</span>
      ) : (
        <span className="min-w-0 whitespace-normal break-words">
          <span className="font-semibold text-lps-dim">{facts.primaryLabel}: </span>
          <span className="text-muted-foreground">{facts.primary}</span>
        </span>
      )}
      {facts.supplier && (
        <span className="min-w-0 whitespace-normal break-words">
          <span className="font-semibold text-lps-dim">Supplier location: </span>
          <span className="text-muted-foreground">{facts.supplier}</span>
        </span>
      )}
    </div>
  )
}

/** Supported width range of the sticky Company/supplier panel in Plant Search. */
export const PLANT_COMPANY_PANEL_MIN_WIDTH = 200
export const PLANT_COMPANY_PANEL_WIDTH = 292
export const PLANT_COMPANY_PANEL_MAX_WIDTH = 480

/** One live width owner shared by the Company track and its aligned Search. */
export function usePlantCompanyPanelWidth() {
  const [panelWidth, setPanelWidth] = useState(PLANT_COMPANY_PANEL_WIDTH)
  const startPanelResize = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = panelWidth
    const move = (next: MouseEvent) => {
      setPanelWidth(Math.min(
        Math.max(startWidth + (next.clientX - startX), PLANT_COMPANY_PANEL_MIN_WIDTH),
        PLANT_COMPANY_PANEL_MAX_WIDTH,
      ))
    }
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }, [panelWidth])

  return { panelWidth, startPanelResize }
}

/** actions gutter: 16px padding + one 24px hide button, plus delete where enabled. */
export const SUB_ACTIONS_W = 16 + 24

function actionsWidth(showDelete: boolean) {
  return SUB_ACTIONS_W + (showDelete ? 24 : 0)
}

export function plantsWidth(cfg: PlantConfig, showDelete = false) {
  return actionsWidth(showDelete) + cfg.visible.reduce((n, c) => n + cfg.widthOf(c), 0)
}

/** The sticky header strip: column picker gutter + one head per visible column. */
export function PlantHeaderRow({
  cfg,
  options,
  showDelete = false,
  showFilters = true,
}: {
  cfg: PlantConfig
  options: (key: string) => string[]
  showDelete?: boolean
  showFilters?: boolean
}) {
  const width = actionsWidth(showDelete)

  return (
    <>
      {cfg.visible.map((col) => (
        <div
          key={col.key}
          className="relative flex-none border-r border-lps-hair bg-lps-headrow p-[7px_8px]"
          style={{ width: cfg.widthOf(col), minWidth: cfg.widthOf(col) }}
        >
          <ColumnHead
            col={col}
            small
            width={cfg.widthOf(col)}
            sort={cfg.sort}
            filters={showFilters ? cfg.filters : undefined}
            options={showFilters ? options(col.key) : undefined}
            onSort={() => cfg.cycleSort(col.key)}
            onFilter={showFilters ? (v) => cfg.setColFilter(col.key, v) : undefined}
            onResize={(w) => cfg.resizeColumn(col.key, w)}
            onMove={(from) => cfg.moveColumn(from, col.key)}
          />
        </div>
      ))}
      <div
        className="sticky right-0 z-[22] flex flex-none items-start border-l border-lps-hair bg-lps-headrow p-1"
        style={{ width, minWidth: width }}
      >
        <ColumnPicker
          title="Plant columns"
          cols={PLANT_COLS}
          hidden={cfg.config.hidden}
          onToggle={cfg.toggleColumn}
          size="sm"
        />
      </div>
    </>
  )
}

export function PlantRowLine({
  row,
  company,
  cfg,
  onHide,
  onDelete,
  onEdit,
}: {
  row: PlantRow
  company?: SupplierRow
  cfg: PlantConfig
  onHide: () => void
  onDelete?: () => void
  onEdit: (col: ColumnDef, next: string) => Promise<void>
}) {
  const width = actionsWidth(!!onDelete)

  return (
    <div className="lps-row flex flex-col bg-card transition-colors hover:bg-muted">
      {company && (
        <PlantLocationCue
          row={row}
          company={company}
          className="border-b border-lps-hair bg-lps-tint px-2 py-1"
        />
      )}
      <div className="flex items-stretch">
      {cfg.visible.map((col) => (
        <div
          key={col.key}
          className="relative flex-none border-b border-lps-hair p-[4px_3px]"
          style={{
            width: cfg.widthOf(col),
            minWidth: cfg.widthOf(col),
            textAlign: col.align ?? 'left',
          }}
        >
          <Cell
            col={col}
            small
            rowId={row.id}
            href={col.key === 'source' ? row.sourcePath : undefined}
            value={
              col.key === 'updated' || col.key === 'ingestion_date'
                ? formatDate(row.values[col.key] as string | null)
                : row.values[col.key] ?? null
            }
            onSave={col.edit ? (next) => onEdit(col, next) : undefined}
          />
        </div>
      ))}
      <div
        className="sticky right-0 z-[6] flex flex-none items-center border-l border-b border-lps-hair bg-card p-[3px_5px]"
        style={{ width, minWidth: width }}
      >
        <button
          type="button"
          onClick={onHide}
          title="Hide row"
          aria-label="Hide row"
          className="inline-flex size-6 cursor-pointer items-center justify-center rounded-[7px] border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <EyeOffIcon size={13} />
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            title="Delete row"
            aria-label="Delete row"
            className="inline-flex size-6 cursor-pointer items-center justify-center rounded-[7px] border-none bg-transparent text-muted-foreground hover:bg-lps-warn-bg hover:text-[var(--lps-tone-red-fg)]"
          >
            <TrashIcon size={13} />
          </button>
        )}
      </div>
      </div>
    </div>
  )
}
