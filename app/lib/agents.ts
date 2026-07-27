/**
 * The agents the chat panel can talk to. One entry per harness agent that has
 * the `webchat` plugin enabled — the panel's selector, the collapsed rail and
 * the `/api/chat/<id>/*` proxy all read this list.
 */
export type Agent = {
  id: string
  name: string
  role: string
  avatar: string
  suggestions: string[]
}

export const AGENTS: Agent[] = [
  {
    id: 'daisy',
    name: 'Daisy',
    role: 'Supplier management',
    avatar: '/daisy.png',
    suggestions: [
      'Which supplier lists are stale?',
      'Add a new supplier',
      'What changed in the last availability file?',
    ],
  },
]

export const agentById = (id: string) => AGENTS.find((a) => a.id === id)
