import assert from 'node:assert/strict'
import test from 'node:test'

import { joinLineBrokenMarkdownLinks, splitBareHttpUrl, tokenizeChatInline } from './chat-markdown.ts'

test('joins a Markdown URL placed on the line after its label', () => {
  assert.equal(
    joinLineBrokenMarkdownLinks('[Weekly update]\n(https://mail.google.com/mail/u/0/#all/abc)\nFrom: Grower'),
    '[Weekly update](https://mail.google.com/mail/u/0/#all/abc)\nFrom: Grower',
  )
})

test('parses a line-broken Markdown link nested inside bold text', () => {
  const source = '**[Weekly update from R Plants!]\n(https://mail.google.com/mail/u/0/#all/abc)**'
  assert.deepEqual(tokenizeChatInline(joinLineBrokenMarkdownLinks(source)), [
    {
      kind: 'strong',
      children: [{
        kind: 'link',
        label: 'Weekly update from R Plants!',
        href: 'https://mail.google.com/mail/u/0/#all/abc',
      }],
    },
  ])
})

test('joins line-broken action links without changing their scheme', () => {
  assert.equal(joinLineBrokenMarkdownLinks('[Open request]\n(ar:27)'), '[Open request](ar:27)')
  assert.equal(joinLineBrokenMarkdownLinks('[Continue]\n(thread:jr-12)'), '[Continue](thread:jr-12)')
})

test('does not join unrelated parenthesized text on the next line', () => {
  assert.equal(joinLineBrokenMarkdownLinks('[plain text]\n(not a link)'), '[plain text]\n(not a link)')
})

test('separates prose punctuation and unmatched delimiters from bare URLs', () => {
  assert.deepEqual(splitBareHttpUrl('https://example.com/path?q=one).'), {
    href: 'https://example.com/path?q=one',
    suffix: ').',
  })
  assert.deepEqual(splitBareHttpUrl('https://example.com/a_(useful_path).'), {
    href: 'https://example.com/a_(useful_path)',
    suffix: '.',
  })
})
