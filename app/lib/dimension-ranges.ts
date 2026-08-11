import type { ColFilters } from '@/lib/table-config'

export interface DimensionRanges {
  heightMin?: number
  heightMax?: number
  widthMin?: number
  widthMax?: number
  caliperMin?: number
  caliperMax?: number
}

const DIMENSIONS = [
  { filterKey: 'h', param: 'height', minKey: 'heightMin', maxKey: 'heightMax' },
  { filterKey: 'w', param: 'width', minKey: 'widthMin', maxKey: 'widthMax' },
  { filterKey: 'cal', param: 'caliper', minKey: 'caliperMin', maxKey: 'caliperMax' },
] as const

/** Stable query string for the three standardized dimension range filters. */
export function dimensionFilterQuery(filters: ColFilters): string {
  const params = new URLSearchParams()
  for (const dimension of DIMENSIONS) {
    const range = filters[dimension.filterKey]
    if (!range || typeof range !== 'object' || Array.isArray(range)) continue
    const min = range.min?.trim() ? Number(range.min) : undefined
    const max = range.max?.trim() ? Number(range.max) : undefined
    if (min !== undefined && (!Number.isFinite(min) || min < 0)) continue
    if (max !== undefined && (!Number.isFinite(max) || max < 0)) continue
    if (min !== undefined && max !== undefined && min > max) continue
    if (min !== undefined) params.set(`${dimension.param}_min`, String(min))
    if (max !== undefined) params.set(`${dimension.param}_max`, String(max))
  }
  return params.toString()
}

/** Parse and validate API range parameters. Empty bounds remain absent. */
export function parseDimensionRanges(params: URLSearchParams): DimensionRanges {
  const ranges: DimensionRanges = {}
  for (const dimension of DIMENSIONS) {
    const rawMin = params.get(`${dimension.param}_min`)
    const rawMax = params.get(`${dimension.param}_max`)
    const min = rawMin == null || rawMin.trim() === '' ? undefined : Number(rawMin)
    const max = rawMax == null || rawMax.trim() === '' ? undefined : Number(rawMax)

    if (min !== undefined && (!Number.isFinite(min) || min < 0)) {
      throw new Error(`${dimension.param}_min must be a non-negative number`)
    }
    if (max !== undefined && (!Number.isFinite(max) || max < 0)) {
      throw new Error(`${dimension.param}_max must be a non-negative number`)
    }
    if (min !== undefined && max !== undefined && min > max) {
      throw new Error(`${dimension.param}_min cannot exceed ${dimension.param}_max`)
    }

    if (min !== undefined) ranges[dimension.minKey] = min
    if (max !== undefined) ranges[dimension.maxKey] = max
  }
  return ranges
}
