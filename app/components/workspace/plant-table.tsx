'use client'

import { EyeOffIcon, TrashIcon } from '@/components/workspace/icons'
import { Cell, ColumnHead, ColumnPicker } from '@/components/workspace/table-parts'
import { PLANT_COLS, type ColumnDef } from '@/lib/columns'
import { formatDate } from '@/lib/format'
import type { PlantRow } from '@/lib/rows'
import type { useTableConfig } from '@/lib/table-config'

export type PlantConfig = ReturnType<typeof useTableConfig>

/** actions gutter: 16px padding + two 24px buttons, per the design. */
export const SUB_ACTIONS_W = 16 + 24 * 2

export function plantsWidth(cfg: PlantConfig) {
  return SUB_ACTIONS_W + cfg.visible.reduce((n, c) => n + cfg.widthOf(c), 0)
}

/** The sticky header strip: column picker gutter + one head per visible column. */
export function PlantHeaderRow({
  cfg,
  options,
}: {
  cfg: PlantConfig
  options: (key: string) => string[]
}) {
  return (
    <>
      <div
        className="relative flex flex-none items-start border-r border-lps-hair bg-lps-headrow p-1"
        style={{ width: SUB_ACTIONS_W, minWidth: SUB_ACTIONS_W }}
      >
        <ColumnPicker
          title="Plant columns"
          cols={PLANT_COLS}
          hidden={cfg.config.hidden}
          onToggle={cfg.toggleColumn}
          size="sm"
        />
      </div>
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
            filters={cfg.filters}
            options={options(col.key)}
            onSort={() => cfg.cycleSort(col.key)}
            onFilter={(v) => cfg.setColFilter(col.key, v)}
            onResize={(w) => cfg.resizeColumn(col.key, w)}
            onMove={(from) => cfg.moveColumn(from, col.key)}
          />
        </div>
      ))}
    </>
  )
}

export function PlantRowLine({
  row,
  cfg,
  onHide,
  onDelete,
  onEdit,
}: {
  row: PlantRow
  cfg: PlantConfig
  onHide: () => void
  onDelete: () => void
  onEdit: (col: ColumnDef, next: string) => Promise<void>
}) {
  return (
    <div className="lps-row flex items-stretch bg-card transition-colors hover:bg-muted">
      <div
        className="sticky left-0 z-[6] flex flex-none items-center border-r border-b border-lps-hair bg-card p-[3px_5px]"
        style={{ width: SUB_ACTIONS_W, minWidth: SUB_ACTIONS_W }}
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
        <button
          type="button"
          onClick={onDelete}
          title="Delete row"
          aria-label="Delete row"
          className="inline-flex size-6 cursor-pointer items-center justify-center rounded-[7px] border-none bg-transparent text-muted-foreground hover:bg-lps-warn-bg hover:text-[#C24C2E]"
        >
          <TrashIcon size={13} />
        </button>
      </div>
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
              col.key === 'updated'
                ? formatDate(row.values.updated as string | null)
                : row.values[col.key] ?? null
            }
            onSave={col.edit ? (next) => onEdit(col, next) : undefined}
          />
        </div>
      ))}
    </div>
  )
}
