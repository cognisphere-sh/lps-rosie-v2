/**
 * The deployment's stamped-entry note convention, in one place.
 *
 * Text written by the agents' skills as entries separated by a blank line,
 * each stamped `[YYYY-MM-DD HH:MM America/Chicago]` — `job_requests`'
 * `customer_notes` / `external_notes` today. The two append-only contact logs
 * this convention was built for are both gone: `suppliers.communication_notes`
 * was frozen by migration 0063, `customers.communication_notes` dropped by
 * 0073, and each side's agent thread carries that history now. Nothing the app
 * writes is stamped any more, so only the reader half is left.
 */

/** One entry of a stamped note column. */
export interface NoteEntry {
  /** `2026-08-18 09:41 America/Chicago`, or null for text predating the convention. */
  stamp: string | null
  text: string
}

/**
 * Split a stamped note column into its entries, oldest first.
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

/**
 * The inline stamp, without its zone name.
 *
 * Entries carry the zone so the record is unambiguous; in a one-line summary it
 * is noise, because every stamp carries the same one.
 */
export const shortStamp = (stamp: string | null) =>
  stamp ? stamp.replace(/\s+[A-Za-z]+\/[A-Za-z_]+$/, '') : ''
