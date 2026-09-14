export type ChatInlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; children: ChatInlineToken[] }
  | { kind: 'underline'; children: ChatInlineToken[] }
  | { kind: 'code'; text: string }
  | { kind: 'action'; scheme: 'thread' | 'ar'; target: string; label: string }
  | { kind: 'link'; href: string; label: string }

export type ChatMarkdownBlock =
  | { kind: 'prose'; text: string }
  | { kind: 'code'; language: string; text: string }

/** Split fenced code from prose so code is never interpreted as inline markdown. */
export function splitChatMarkdownBlocks(text: string): ChatMarkdownBlock[] {
  const blocks: ChatMarkdownBlock[] = []
  const prose: string[] = []
  const code: string[] = []
  let language: string | null = null

  const flushProse = () => {
    if (!prose.length) return
    blocks.push({ kind: 'prose', text: prose.join('\n') })
    prose.length = 0
  }

  for (const line of text.split('\n')) {
    if (language === null) {
      const opening = /^\s*```([^\s`]*)\s*$/.exec(line)
      if (!opening) {
        prose.push(line)
        continue
      }
      flushProse()
      language = opening[1]
      continue
    }

    if (/^\s*```\s*$/.test(line)) {
      blocks.push({ kind: 'code', language, text: code.join('\n') })
      code.length = 0
      language = null
    } else {
      code.push(line)
    }
  }

  if (language !== null) blocks.push({ kind: 'code', language, text: code.join('\n') })
  flushProse()
  return blocks
}

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

/** Transform rendered token text without touching link hrefs or action targets. */
export function transformChatInlineText(
  tokens: ChatInlineToken[],
  transform: (text: string) => string,
): ChatInlineToken[] {
  return tokens.map((token) => {
    if (token.kind === 'text' || token.kind === 'code') {
      return { ...token, text: transform(token.text) }
    }
    if (token.kind === 'strong' || token.kind === 'underline') {
      return { ...token, children: transformChatInlineText(token.children, transform) }
    }
    return { ...token, label: transform(token.label) }
  })
}

/**
 * Serialize rendered Markdown as plain text for audience-filtered copying.
 * Safe HTTP destinations remain useful; action targets and destinations whose
 * own text would be redacted are omitted rather than exposed or corrupted.
 */
export function chatMarkdownPlainText(
  text: string,
  transform: (text: string) => string,
): string {
  const plainInline = (tokens: ChatInlineToken[]): string => tokens.map((token) => {
    if (token.kind === 'text' || token.kind === 'code') return transform(token.text)
    if (token.kind === 'strong' || token.kind === 'underline') return plainInline(token.children)
    if (token.kind === 'action') return transform(token.label)

    const label = transform(token.label)
    const hrefIsSafe = transform(token.href) === token.href
    if (!hrefIsSafe || token.label === token.href) return label
    return `${label} (${token.href})`
  }).join('')

  return splitChatMarkdownBlocks(text).map((block) => {
    if (block.kind === 'code') return transform(block.text)
    return plainInline(tokenizeChatInline(joinLineBrokenMarkdownLinks(block.text)))
  }).join('\n')
}

/** Parse the deliberately small inline-markdown subset used by chat bubbles. */
export function tokenizeChatInline(text: string): ChatInlineToken[] {
  const tokens: ChatInlineToken[] = []
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((?:(thread|ar):([^)\s]+)|(https?:\/\/[^)\s]+))\)|(https?:\/\/[^\s<]+)|<u>(.+?)<\/u>/g
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
    } else if (match[8]) {
      // Only this exact, attribute-free tag is formatting. Every other HTML
      // string remains text and is escaped by React when rendered.
      tokens.push({ kind: 'underline', children: tokenizeChatInline(match[8]) })
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
