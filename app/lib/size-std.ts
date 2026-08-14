// The standardized container vocabulary behind `inventory.size_std`, and the
// order the size filter presents it in.
//
// `size` keeps whatever the supplier printed ("15 G/17\"", "#15", "15gal") and
// is what the table cell shows; `size_std` is the one bucket that row belongs
// to, and is what the filter selects on. See docs/supabase-schema.md.
//
// The pot, gallon and box families are open sets — the database constrains the
// *shape* (`<N>" Pot`, `<N>G`, `<N>" Box`), not a fixed list — so the order is a
// rule rather than an array. It runs smallest container to largest: the word
// grades that precede a pot, then pots, gallons and boxes each ascending by
// their own number, then the field-dug grades, then `other`.

/** Word grades that lead the list, in the order they are offered. */
export const SIZE_STD_LEADING = ['Bare Root', 'Liners', 'Plug', 'Trays'] as const
/** Field-dug grades, which follow the numbered families. */
export const SIZE_STD_TRAILING = ['B&B', 'Field Grown', 'Grow Bags', 'Root Pruned'] as const
/** The catch-all: a real container the standard has no bucket for. */
export const SIZE_STD_OTHER = 'other'

const POT = /^(\d+(?:\.\d+)?)" Pot$/
const GALLON = /^(\d+(?:\.\d+)?)G$/
const BOX = /^(\d+)" Box$/

/**
 * Sort position as (family, number). Anything unrecognized sorts after `other`
 * rather than being dropped — an unmapped value is still a real row.
 */
function rank(value: string): [number, number] {
  const leading = SIZE_STD_LEADING.indexOf(value as (typeof SIZE_STD_LEADING)[number])
  if (leading !== -1) return [0, leading]

  const pot = POT.exec(value)
  if (pot) return [1, Number(pot[1])]

  const gallon = GALLON.exec(value)
  if (gallon) return [2, Number(gallon[1])]

  const box = BOX.exec(value)
  if (box) return [3, Number(box[1])]

  const trailing = SIZE_STD_TRAILING.indexOf(value as (typeof SIZE_STD_TRAILING)[number])
  if (trailing !== -1) return [4, trailing]

  return value === SIZE_STD_OTHER ? [5, 0] : [6, 0]
}

/** Canonical order for two `size_std` values. */
export function compareSizeStd(a: string, b: string): number {
  const [familyA, numberA] = rank(a)
  const [familyB, numberB] = rank(b)
  if (familyA !== familyB) return familyA - familyB
  if (numberA !== numberB) return numberA - numberB
  return a.localeCompare(b)
}
