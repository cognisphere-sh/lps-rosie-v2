export type ChatInlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; children: ChatInlineToken[] }
  | { kind: 'code'; text: string }
  | { kind: 'action'; scheme: 'thread' | 'ar'; target: string; label: string }
  | { kind: 'link'; href: string; label: string }

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

/** Parse the deliberately small inline-markdown subset used by chat bubbles. */
export function tokenizeChatInline(text: string): ChatInlineToken[] {
  const tokens: ChatInlineToken[] = []
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((?:(thread|ar):([^)\s]+)|(https?:\/\/[^)\s]+))\)|(https?:\/\/[^\s<]+)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text))) {
    if (match.index > last) tokens.push({ kind: 'text', text: text.slice(last, match.index) })
    if (match[1]) {
      // The recursive input cannot contain the outer ** delimiters, so nested
      // links/code are parsed without risking a recursion loop.
      tokens.push({ kind: 'strong', children: tokenizeChatInline(match[1]) })
    } else if (match[2]) {
      tokens.push({ kind: 'code', text: match[2] })
    } else if (match[4]) {
      tokens.push({
        kind: 'action',
        scheme: match[4] as 'thread' | 'ar',
        target: match[5],
        label: match[3],
      })
    } else if (match[3]) {
      tokens.push({ kind: 'link', href: match[6], label: match[3] })
    } else {
      const { href, suffix } = splitBareHttpUrl(match[7])
      tokens.push({ kind: 'link', href, label: href })
      if (suffix) tokens.push({ kind: 'text', text: suffix })
    }
    last = re.lastIndex
  }

  if (last < text.length) tokens.push({ kind: 'text', text: text.slice(last) })
  return tokens
}
