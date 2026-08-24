'use client'

/**
 * Tiny window-event bus between the workspace and the chat panel.
 *
 * Cards deep in a page need to open the docked chat on a specific agent
 * thread, or an availability request in the global drawer — and the panel and
 * drawer live at the Shell level. A custom event keeps that a one-liner from
 * anywhere instead of threading callbacks through every layer.
 */

export interface OpenChatDetail {
  agentId: string
  threadId: string
  /** What the panel header calls the thread (falls back to the id). */
  label?: string
}

export function openChat(detail: OpenChatDetail): void {
  window.dispatchEvent(new CustomEvent<OpenChatDetail>('lps:open-chat', { detail }))
}

export function onOpenChat(handler: (detail: OpenChatDetail) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<OpenChatDetail>).detail)
  window.addEventListener('lps:open-chat', listener)
  return () => window.removeEventListener('lps:open-chat', listener)
}

export function openAvailabilityRequest(arId: number): void {
  window.dispatchEvent(new CustomEvent<number>('lps:open-ar', { detail: arId }))
}

export function onOpenAvailabilityRequest(handler: (arId: number) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<number>).detail)
  window.addEventListener('lps:open-ar', listener)
  return () => window.removeEventListener('lps:open-ar', listener)
}
