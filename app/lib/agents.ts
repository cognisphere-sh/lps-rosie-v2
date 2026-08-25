/**
 * The AI team — one entry per harness agent, chattable or not. The Know your
 * Agents page and the settings tabs list all of them; the panel's selector,
 * the collapsed rail and the `/api/chat/<id>/*` proxy only take the ones that
 * can actually hold a conversation here (`CHAT_AGENTS`).
 *
 * Two things make an agent unchattable, and they mean different things:
 * `upcoming` is not wired up yet, while `reachOn` names the channel an agent
 * lives on instead of this panel — lily has no `webchat` plugin at all and is
 * reached on Telegram. Either way the UI disables it and the chat proxy
 * refuses it; only the label differs.
 */
export type Agent = {
  id: string
  name: string
  role: string
  avatar: string
  profile: string
  upcoming?: boolean
  /** Where this agent is reached, when it isn't this panel — e.g. `Telegram`. */
  reachOn?: string
  /** Empty-transcript line shown in the panel before the first message. */
  intro: string
  /** Starter prompts for the empty transcript; chattable agents only. */
  suggestions?: string[]
}

export const AGENTS: Agent[] = [
  {
    id: 'daisy',
    name: 'Daisy',
    role: 'Suppliers',
    avatar: '/daisy.png',
    profile: '/daisy_profile.png',
    intro: 'Ask Daisy about suppliers, availability lists or catalogue data.',
    suggestions: [
      'Which supplier lists are stale?',
      'Add a new supplier',
      'What changed in the last availability file?',
    ],
  },
  {
    id: 'rosie',
    name: 'Rosie',
    role: 'Customers',
    avatar: '/rosie.png',
    profile: '/rosie_profile.png',
    intro: 'Ask Rosie about customers, job requests, quotes or sourcing status.',
    suggestions: [
      'Which job requests are still being sourced?',
      'Log a new job request',
      'Draft a quote for a request',
    ],
  },
  {
    id: 'nova',
    name: 'Nova',
    role: 'Developer',
    avatar: '/nova.png',
    profile: '/nova_profile.png',
    intro: 'Ask Nova for changes to this app — bug fixes, tweaks and new features.',
    suggestions: [
      'What have you shipped recently?',
      'Report a bug in the app',
      'Request a small UI change',
    ],
  },
  {
    id: 'lily',
    name: 'Lily',
    role: 'Product',
    avatar: '/lily.png',
    profile: '/lily_profile.png',
    reachOn: 'Telegram',
    intro: 'Tell Lily what’s working and what isn’t — she turns it into changes to the app and the workflow.',
  },
]

/** The agents that can actually be chatted with here. */
export const CHAT_AGENTS = AGENTS.filter((a) => !a.upcoming && !a.reachOn)

/**
 * Why an agent can't be opened in the panel, as a label — `null` when it can.
 * The rail, the selector, the mobile list and the Know your Agents page all
 * show this in place of "Online"/"Active".
 */
export const chatBlockedReason = (agent: Agent): string | null =>
  agent.upcoming ? 'Coming soon' : agent.reachOn ? `On ${agent.reachOn}` : null

export const agentById = (id: string) => AGENTS.find((a) => a.id === id)

/**
 * The agent conversations a supplier row opens, in panel order.
 *
 * Rosie and daisy each keep one thread per supplier **company**
 * (`suppliers.rosie_thread_id` / `daisy_thread_id`, migrations 0068 and 0064).
 * The two hold the same `supplier-<slug>` string — thread ids are namespaced
 * per agent — so they name two distinct conversations: rosie's order
 * coordination and daisy's onboarding and availability. A row whose column is
 * unset offers no button rather than guessing at an id, which is also what
 * keeps the buttons off the search-projected farm rows nested under a company.
 */
export function supplierAgentThreads(
  values: Record<string, unknown>,
): { agentId: string; threadId: string }[] {
  return ['rosie', 'daisy'].flatMap((agentId) => {
    const threadId = values[`${agentId}_thread_id`]
    return typeof threadId === 'string' && threadId ? [{ agentId, threadId }] : []
  })
}
