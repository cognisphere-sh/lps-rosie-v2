export type HorizontalScrollTarget = {
  clientWidth: number
  scrollLeft: number
  scrollWidth: number
}

/** Moves an overflowing mobile plant name without moving the result card/page. */
export function scrollPlantNameWithKeyboard(target: HorizontalScrollTarget, key: string) {
  const max = Math.max(0, target.scrollWidth - target.clientWidth)
  if (max === 0) return false

  const step = Math.max(48, Math.round(target.clientWidth * 0.6))
  if (key === 'ArrowLeft') target.scrollLeft = Math.max(0, target.scrollLeft - step)
  else if (key === 'ArrowRight') target.scrollLeft = Math.min(max, target.scrollLeft + step)
  else if (key === 'Home') target.scrollLeft = 0
  else if (key === 'End') target.scrollLeft = max
  else return false

  return true
}
