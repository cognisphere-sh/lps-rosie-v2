'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { MessagesSquare } from 'lucide-react'
import { openChat } from '@/lib/chat-bus'
import { agentChatButtonClass } from '@/lib/agent-chat-button-style'

export function CustomerChatButton({ customerId, threadId, label, className, avatar = false, size = 26, labelled = false, job }: {
  customerId: number
  /** Open the conversation as this job's customer tab. */
  job?: { id: number; label?: string }
  threadId?: string | null
  label: string
  className?: string
  avatar?: boolean
  size?: number
  labelled?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const opening = useRef(false)
  async function open() {
    if (opening.current) return
    opening.current = true
    setBusy(true)
    setError('')
    try {
      let target = threadId?.trim()
      if (!target) {
        const response = await fetch(`/api/customers/${customerId}/chat`, { method: 'POST' })
        const body = await response.json()
        if (!response.ok || typeof body.threadId !== 'string' || !body.threadId.trim()) throw new Error(body.error || 'Could not open customer chat')
        target = body.threadId.trim()
      }
      openChat({ agentId: 'rosie', threadId: target!, label, ...(job ? { job } : {}) })
    } catch (error) { setError((error as Error).message) }
    finally { opening.current = false; setBusy(false) }
  }
  return <>
    <button type="button" disabled={busy} aria-busy={busy}
      title={`Chat with ${label}`} aria-label={`Chat with ${label}`}
      onClick={(event) => { event.stopPropagation(); void open() }}
      className={avatar ? agentChatButtonClass({ labelled, className }) : className}>
      {avatar ? <Image src="/rosie.png" alt="" width={size} height={size} className="rounded-full object-cover" /> : <MessagesSquare size={11} aria-hidden="true" />}
      {labelled && <span className="hidden min-[480px]:inline">Chat with Rosie</span>}
    </button>
    {error && <span role="alert" className="px-2 text-[11px] text-destructive">{error}</span>}
  </>
}
