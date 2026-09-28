// What choosing one supplier's AR answer writes onto a job line. Pure, so the
// route and its tests share one definition.

/** AR answer → job line status. An unanswered line (null) stays Pending. */
const JOB_STATUS_OF: Record<string, string> = {
  available: 'available',
  unavailable: 'unavailable',
  diff_size_qty_sub: 'alternative_proposed',
  can_order: 'need_to_order',
  arriving_soon: 'arriving_soon',
}

export interface SelectableResponse {
  arItemId: number
  status: string | null
  unitPrice: number | null
  availableQuantity: number | null
  note: string | null
  /** This job line's share of the AR line (`availability_request_item_jobs.quantity`). */
  allocation: number | null
}

export interface SelectableLine {
  demandedQuantity: number | null
  noteForCustomer: string | null
}

/**
 * The job-line columns a selection writes. Price and quantity are copied only
 * when the supplier gave them. Quantity is capped at this line's share — a
 * supplier offering 500 against a demand of 10 can supply 10, and the line
 * total multiplies by it. An answered line's note is appended once.
 */
export function supplierSelectionChanges(line: SelectableLine, response: SelectableResponse) {
  const changes: Record<string, string | number | null> = {
    selected_availability_request_item_id: response.arItemId,
    status: response.status == null ? 'pending' : JOB_STATUS_OF[response.status] ?? 'pending',
  }
  if (response.unitPrice != null) changes.unit_price = response.unitPrice
  if (response.availableQuantity != null) {
    const cap = response.allocation ?? line.demandedQuantity
    changes.available_quantity = cap == null ? response.availableQuantity : Math.min(response.availableQuantity, cap)
  }
  // `note_for_supplier` also carries LPS's own ask; before any answer it is only that.
  const note = response.status == null ? undefined : response.note?.trim()
  const existing = line.noteForCustomer?.trim() ?? ''
  if (note && !existing.includes(note)) {
    changes.note_for_customer = existing ? `${existing}\n\n${note}` : note
  }
  return changes
}
