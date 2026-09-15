import type { ChatMessage } from '../components/workspace/chat-kit'

/** Overlapping live reads and history pages may contain the same server rows. */
export function mergePartnerMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]))
  for (const message of incoming) byId.set(message.id, message)
  return [...byId.values()].sort((a, b) => {
    // Server IDs define transcript order; unsaved messages stay at the end.
    if (a.id > 0 && b.id > 0) return a.id - b.id
    if (a.id > 0) return -1
    if (b.id > 0) return 1
    return a.at - b.at
  })
}
