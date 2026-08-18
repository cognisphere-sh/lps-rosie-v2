/**
 * The agents the chat panel can talk to. One entry per harness agent that has
 * the `webchat` plugin enabled — the panel's selector, the collapsed rail and
 * the `/api/chat/<id>/*` proxy all read this list.
 *
 * `upcoming` agents are shown in the rail/selector and on the Know your Agents
 * page, but are not chattable yet — the UI disables them and the chat proxy
 * refuses them.
 */
export type Agent = {
  id: string
  name: string
  role: string
  avatar: string
  profile: string
  upcoming?: boolean
  /** Empty-transcript line shown in the panel before the first message. */
  intro: string
  suggestions: string[]
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
      'Which job requests need attention?',
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
]

/** The agents that can actually be chatted with today. */
export const CHAT_AGENTS = AGENTS.filter((a) => !a.upcoming)

export const agentById = (id: string) => AGENTS.find((a) => a.id === id)
