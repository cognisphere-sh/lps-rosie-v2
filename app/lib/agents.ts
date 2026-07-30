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
  suggestions: string[]
}

export const AGENTS: Agent[] = [
  {
    id: 'daisy',
    name: 'Daisy',
    role: 'Supplier management',
    avatar: '/daisy.png',
    profile: '/daisy_profile.png',
    suggestions: [
      'Which supplier lists are stale?',
      'Add a new supplier',
      'What changed in the last availability file?',
    ],
  },
  {
    id: 'rosie',
    name: 'Rosie',
    role: 'Customer relationships',
    avatar: '/rosie.png',
    profile: '/rosie_profile.png',
    upcoming: true,
    suggestions: [],
  },
  {
    id: 'nova',
    name: 'Nova',
    role: 'Developer & app builder',
    avatar: '/nova.png',
    profile: '/nova_profile.png',
    upcoming: true,
    suggestions: [],
  },
]

/** The agents that can actually be chatted with today. */
export const CHAT_AGENTS = AGENTS.filter((a) => !a.upcoming)

export const agentById = (id: string) => AGENTS.find((a) => a.id === id)
