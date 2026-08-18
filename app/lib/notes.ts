/**
 * The deployment's append-only note convention, in one place.
 *
 * Several columns are logs rather than fields — `job_requests.internal_notes`,
 * `job_request_items.internal_notes`, `customers.communication_notes`,
 * `suppliers.communication_notes`. They all follow the same shape, written by
 * the agents' skills and now by this app: entries separated by a blank line,
 * each stamped `[YYYY-MM-DD HH:MM America/Chicago]`.
 *
 * Reader and writer live together deliberately. They are two halves of one
 * format, and the only way the parser and the stamper can disagree is if
 * someone changes one without the other.
 */

/** The timezone every stamped entry in this deployment is written in. */
export const NOTE_ZONE = 'America/Chicago'

/** One entry of an append-only column. */
export interface NoteEntry {
  /** `2026-08-18 09:41 America/Chicago`, or null for text predating the convention. */
  stamp: string | null
  text: string
}

/**
 * Split an append-only column into its entries, oldest first.
 *
 * Text with no stamp — written before the convention, or a customer's verbatim
 * message — stays one unstamped entry rather than being reshaped into
 * something it never was.
 */
export function parseEntries(text: string | null): NoteEntry[] {
  if (!text?.trim()) return []
  return text
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const m = chunk.match(/^\[([^\]]+)\]\s*([\s\S]*)$/)
      return m ? { stamp: m[1], text: m[2].trim() } : { stamp: null, text: chunk }
    })
}

/** `[2026-08-18 09:41 America/Chicago]` — the stamp `parseEntries` reads back. */
export function noteStamp(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: NOTE_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const at = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `[${at('year')}-${at('month')}-${at('day')} ${at('hour')}:${at('minute')} ${NOTE_ZONE}]`
}

/**
 * The inline stamp, without its zone name.
 *
 * Entries carry the zone so the record is unambiguous; in a one-line summary it
 * is noise, because every stamp carries the same one.
 */
export const shortStamp = (stamp: string | null) =>
  stamp ? stamp.replace(/\s+[A-Za-z]+\/[A-Za-z_]+$/, '') : ''
