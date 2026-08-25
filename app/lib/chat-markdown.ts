/** Join the link destination when an agent puts it on the line after its label. */
export function joinLineBrokenMarkdownLinks(text: string): string {
  return text.replace(
    /\][ \t]*\n[ \t]*\(((?:https?:\/\/|thread:|ar:)[^)\s]+)\)/g,
    ']($1)',
  )
}

/**
 * Separate sentence punctuation from a bare URL without dropping balanced
 * delimiters that are genuinely part of the address.
 */
export function splitBareHttpUrl(candidate: string): { href: string; suffix: string } {
  let end = candidate.length

  while (end > 0 && /[.,!?;:'"]/.test(candidate[end - 1])) end--

  const pairs: Array<[string, string]> = [['(', ')'], ['[', ']'], ['{', '}']]
  let changed = true
  while (changed && end > 0) {
    changed = false
    for (const [open, close] of pairs) {
      if (candidate[end - 1] !== close) continue
      const value = candidate.slice(0, end)
      const opens = value.split(open).length - 1
      const closes = value.split(close).length - 1
      if (closes > opens) {
        end--
        changed = true
      }
    }
  }

  return { href: candidate.slice(0, end), suffix: candidate.slice(end) }
}
