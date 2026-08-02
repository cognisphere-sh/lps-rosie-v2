export const SIZE_UNITS = [
  { value: 'gallon', label: 'Gallon', suffix: 'gal', step: 1 },
  { value: 'box', label: 'Box', suffix: 'in', step: 1 },
  { value: 'height', label: 'Height', suffix: 'ft', step: 0.5 },
  { value: 'caliper', label: 'Caliper', suffix: 'in', step: 0.25 },
] as const

export type SizeUnit = (typeof SIZE_UNITS)[number]['value']
export type SizeBounds = { min: number; max: number }

export function isSizeUnit(value: string | null): value is SizeUnit {
  return SIZE_UNITS.some((unit) => unit.value === value)
}

function bounds(numbers: number[]): SizeBounds | null {
  if (numbers.length === 0) return null
  return { min: Math.min(...numbers), max: Math.max(...numbers) }
}

function numbersIn(value: unknown): number[] {
  return [...String(value ?? '').matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]))
}

/**
 * Read an inventory row's range for one comparable size unit. `size` is legacy
 * source text, so only explicit units are classified; ambiguous values such as
 * `4"` are deliberately not guessed to be pot diameter, box or caliper.
 */
export function sizeBoundsFor(
  values: Record<string, unknown>,
  unit: SizeUnit,
): SizeBounds | null {
  const size = String(values.size ?? '')

  if (unit === 'gallon') {
    const found: number[] = []
    const unitPattern = /\b(?:g|gal|gallon)s?\b/gi
    let previousEnd = 0
    for (const match of size.matchAll(unitPattern)) {
      const segment = size.slice(previousEnd, match.index)
      found.push(...numbersIn(segment))
      previousEnd = (match.index ?? 0) + match[0].length
    }
    return bounds(found)
  }

  if (unit === 'box') {
    const match = /(^|[^a-z])([\d.][\d.\s/-]*)\s*(?:"|in(?:ch(?:es)?)?)?\s*box\b/i.exec(size)
    return bounds(match ? numbersIn(match[2]) : [])
  }

  if (unit === 'height') {
    if (values.h != null && values.h !== '') return bounds(numbersIn(values.h))
    const match = /([\d.][\d.\s/-]*)\s*(?:'|ft\b|feet\b)/i.exec(size)
    return bounds(match ? numbersIn(match[1]) : [])
  }

  if (values.cal != null && values.cal !== '') return bounds(numbersIn(values.cal))
  const match = /([\d.][\d.\s/-]*)\s*(?:"|in(?:ch(?:es)?)?)?\s*cal(?:iper)?\b/i.exec(size)
  return bounds(match ? numbersIn(match[1]) : [])
}

/** Match when the listed size overlaps the requested range. */
export function matchesSizeRange(
  values: Record<string, unknown>,
  unit: SizeUnit | '',
  requestedMin: string,
  requestedMax: string,
): boolean {
  if (!unit) return true
  const listed = sizeBoundsFor(values, unit)
  if (!listed) return false

  const parsedMin = requestedMin === '' ? null : Number(requestedMin)
  const parsedMax = requestedMax === '' ? null : Number(requestedMax)
  const low = parsedMin != null && parsedMax != null ? Math.min(parsedMin, parsedMax) : parsedMin
  const high = parsedMin != null && parsedMax != null ? Math.max(parsedMin, parsedMax) : parsedMax

  return (low == null || listed.max >= low) && (high == null || listed.min <= high)
}
