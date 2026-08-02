export type TypedSize = {
  unit: 'gallon' | 'box'
  value: number
  label: string
}

export type SizeChoice = {
  key: string
  label: string
}

type SizeBounds = { min: number; max: number }

function bounds(numbers: number[]): SizeBounds | null {
  if (numbers.length === 0) return null
  return { min: Math.min(...numbers), max: Math.max(...numbers) }
}

function numbersIn(value: unknown): number[] {
  return [...String(value ?? '').matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]))
}

function explicitBounds(size: string, unit: 'gallon' | 'box'): SizeBounds | null {
  if (unit === 'gallon') {
    const found: number[] = []
    const unitPattern = /(?:gallon|gal|g)s?\b/gi
    let previousEnd = 0
    for (const match of size.matchAll(unitPattern)) {
      const index = match.index ?? 0
      if (index > 0 && /[a-z]/i.test(size[index - 1])) continue
      found.push(...numbersIn(size.slice(previousEnd, index)))
      previousEnd = index + match[0].length
    }
    return bounds(found)
  }

  const match = /(^|[^a-z])([\d.][\d.\s/-]*)\s*(?:"|in(?:ch(?:es)?)?)?\s*box\b/i.exec(size)
  return bounds(match ? numbersIn(match[2]) : [])
}

function compactNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, '').replace(/\.$/, '')
}

function removeMatch(query: string, match: RegExpExecArray): string {
  return `${query.slice(0, match.index)} ${query.slice(match.index + match[0].length)}`
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Pull an explicit size out of a natural plant query. The remaining text is the
 * plant-name query sent to search_inventory; the size is applied independently
 * so alias matching cannot accidentally ignore it.
 */
export function parseSizeQuery(query: string): { plantQuery: string; size: TypedSize | null } {
  const gallon = /(?:^|\s)(\d+(?:\.\d+)?)\s*(?:g|gal|gallon)s?\b/i.exec(query)
  if (gallon) {
    const value = Number(gallon[1])
    return {
      plantQuery: removeMatch(query, gallon),
      size: { unit: 'gallon', value, label: `${compactNumber(value)} gal` },
    }
  }

  const box = /(?:^|\s)(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)\s*box\b/i.exec(query)
  if (box) {
    const value = Number(box[1])
    return {
      plantQuery: removeMatch(query, box),
      size: { unit: 'box', value, label: `${compactNumber(value)}\" box` },
    }
  }

  return { plantQuery: query.trim(), size: null }
}

function caliperBounds(values: Record<string, unknown>): SizeBounds | null {
  const dedicated = String(values.cal ?? '').trim()
  const size = String(values.size ?? '')
  const hasCaliperContext = /\bcal(?:iper)?\b|"|\bin(?:ch(?:es)?)?\b/i.test(`${dedicated} ${size}`)
  if (dedicated && hasCaliperContext) {
    const parsed = bounds(numbersIn(dedicated))
    // Values such as 55, 80 and 215 are known source-column mapping noise, not
    // plausible nursery calipers. Keep them out of customer-facing facets.
    if (parsed && parsed.min > 0 && parsed.max <= 20) return parsed
  }

  const match = /([\d.][\d.\s/-]*)\s*(?:"|in(?:ch(?:es)?)?)?\s*cal(?:iper)?\b/i.exec(size)
  const parsed = bounds(match ? numbersIn(match[1]) : [])
  return parsed && parsed.min > 0 && parsed.max <= 20 ? parsed : null
}

function endpointChoices(
  listed: SizeBounds,
  unit: 'gallon' | 'box' | 'caliper',
): SizeChoice[] {
  const values = listed.min === listed.max ? [listed.min] : [listed.min, listed.max]
  return values.map((value) => ({
    key: `${unit}:${value}`,
    label: unit === 'gallon'
      ? `${compactNumber(value)} gal`
      : unit === 'box'
        ? `${compactNumber(value)}" box`
        : `${compactNumber(value)}" caliper`,
  }))
}

/**
 * Build conservative commercial choices only. Grower descriptions stay on the
 * row, but bare inch measurements, dimensions and untyped numbers never become
 * filter options. A listed range contributes its two standard endpoints.
 */
export function sizeChoicesForValues(values: Record<string, unknown>): SizeChoice[] {
  const original = String(values.size ?? '').trim()
  const choices: SizeChoice[] = []
  const gallons = explicitBounds(original, 'gallon')
  const boxes = explicitBounds(original, 'box')
  const calipers = caliperBounds(values)
  if (gallons) choices.push(...endpointChoices(gallons, 'gallon'))
  if (boxes) choices.push(...endpointChoices(boxes, 'box'))
  if (calipers) choices.push(...endpointChoices(calipers, 'caliper'))
  return choices
}

export function sizeChoicesFor(rows: { values: Record<string, unknown> }[]): SizeChoice[] {
  const choices = new Map<string, SizeChoice>()
  for (const row of rows) {
    for (const choice of sizeChoicesForValues(row.values)) choices.set(choice.key, choice)
  }
  const unitOrder: Record<string, number> = { gallon: 0, box: 1, caliper: 2 }
  return [...choices.values()].sort((a, b) => {
    const [aUnit, aValue] = a.key.split(':')
    const [bUnit, bValue] = b.key.split(':')
    return unitOrder[aUnit] - unitOrder[bUnit] || Number(aValue) - Number(bValue)
  })
}

export function matchesSizeFilter(
  values: Record<string, unknown>,
  typed: TypedSize | null,
  selectedKeys: string[],
): boolean {
  if (typed) {
    const listed = explicitBounds(String(values.size ?? ''), typed.unit)
    return !!listed && listed.min <= typed.value && listed.max >= typed.value
  }
  if (selectedKeys.length === 0) return true
  return sizeChoicesForValues(values).some((choice) => selectedKeys.includes(choice.key))
}
