'use client'

import Image from 'next/image'

import { agentById } from '@/lib/agents'
import { openChat } from '@/lib/chat-bus'
import { cn } from '@/lib/utils'

/**
 * "Talk to this agent about this record" — the agent's own face, as a button.
 *
 * A profile page's subject *has* an agent thread (`suppliers.rosie_thread_id`,
 * `suppliers.daisy_thread_id`, `customers.rosie_thread_id`), and this is how
 * the page opens it in the docked panel. The avatar is the whole control: the
 * same picture the panel, the rail and the job cards use, so one glance says
 * which agent is on the other end.
 */
export function AgentChatButton({
  agentId,
  threadId,
  label,
  subject,
  size = 26,
  className,
}: {
  agentId: string
  threadId: string
  /** What the panel header calls the thread; the subject's name, normally. */
  label: string
  /** Named in the tooltip — "Chat with Rosie about <subject>". */
  subject: string
  /** Avatar edge in px. 26 suits a page header; a table row wants 22. */
  size?: number
  className?: string
}) {
  const agent = agentById(agentId)
  if (!agent) return null

  const what = `Chat with ${agent.name} about ${subject}`
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        openChat({ agentId, threadId, label })
      }}
      title={what}
      aria-label={what}
      className={cn(
        'flex flex-none cursor-pointer items-center border-none bg-transparent p-0 opacity-75 hover:opacity-100',
        className,
      )}
    >
      <Image
        src={agent.avatar}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-full object-cover"
      />
    </button>
  )
}
