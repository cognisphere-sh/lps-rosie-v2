export type TypedSize = {
  unit: 'gallon' | 'box'
  value: number
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

/**
 * A size typed into the query still matches by value, so `15g` finds a row
 * listed as `15 gal`. The size filter itself is a plain checkbox list of the
 * `size` values the rows actually carry — see `optionsFor`.
 */
export function matchesSizeFilter(
  values: Record<string, unknown>,
  typed: TypedSize | null,
  selectedSizes: string[],
): boolean {
  if (typed) {
    const listed = explicitBounds(String(values.size ?? ''), typed.unit)
    return !!listed && listed.min <= typed.value && listed.max >= typed.value
  }
  if (selectedSizes.length === 0) return true
  return selectedSizes.includes(String(values.size ?? ''))
}
