'use client'

import Image from 'next/image'

import { agentChatButtonClass } from '@/lib/agent-chat-button-style'
import { agentById } from '@/lib/agents'
import { openChat } from '@/lib/chat-bus'

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
  labelled = false,
  quickAction = false,
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
  /** Show a labelled header action; narrow phones keep its accessible avatar. */
  labelled?: boolean
  /** Use the outlined 44px contact-route shape. */
  quickAction?: boolean
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
      className={agentChatButtonClass({ labelled, quickAction, className })}
    >
      <Image
        src={agent.avatar}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-full object-cover"
      />
      {labelled && <span className="hidden min-[480px]:inline">Chat with {agent.name}</span>}
    </button>
  )
}
