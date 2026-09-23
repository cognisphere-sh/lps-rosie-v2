interface SourceLine {
  id: number
  name: string
  size: string | null
  demanded_quantity: number | null
}

/** Consolidate only identical asks with known quantities and matching quoted prices. */
export function buildAvailabilitySnapshots(
  lines: SourceLine[],
  prices: ReadonlyMap<number, number>,
  consolidate: boolean,
) {
  const snapshots = new Map<string, {
    name: string
    size: string | null
    demanded_quantity: number | null
    unit_price: number | null
    allocations: { job_request_item_id: number; quantity: number | null }[]
  }>()
  for (const line of lines) {
    const price = prices.get(line.id) ?? null
    const key = consolidate && line.demanded_quantity != null
      ? JSON.stringify([line.name, line.size, price]) : String(line.id)
    const existing = snapshots.get(key)
    const allocation = { job_request_item_id: line.id, quantity: line.demanded_quantity }
    if (existing) {
      existing.demanded_quantity = (existing.demanded_quantity ?? 0) + (line.demanded_quantity ?? 0)
      existing.allocations.push(allocation)
    } else {
      snapshots.set(key, { name: line.name, size: line.size, demanded_quantity: line.demanded_quantity,
        unit_price: price, allocations: [allocation] })
    }
  }
  return [...snapshots.values()]
}
