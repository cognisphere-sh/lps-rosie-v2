import type { CSSProperties } from 'react'

export type ChatThemeId = 'forest' | 'rose' | 'violet' | 'garden' | 'desert' | 'agave'
export type ChatAgentId = 'daisy' | 'rosie' | 'nova'

export type ChatAppearance = {
  themes: Record<ChatAgentId, ChatThemeId>
  wallpaper: boolean
}

export const CHAT_APPEARANCE_STORE = 'lps.chat.appearance.v1'
export const DEFAULT_CHAT_APPEARANCE: ChatAppearance = {
  themes: {
    daisy: 'forest',
    rosie: 'rose',
    nova: 'violet',
  },
  wallpaper: false,
}

export const CHAT_THEMES: { id: ChatThemeId; label: string; accent: string; preview: string }[] = [
  // The first three are sampled toward each profile image's dominant backdrop.
  { id: 'forest', label: 'Forest Green', accent: '#3e7b36', preview: '#dcebd8' },
  { id: 'rose', label: 'Coral Rose', accent: '#b15150', preview: '#f0d9d8' },
  { id: 'violet', label: 'Electric Violet', accent: '#6540bd', preview: '#e3dcf4' },
  { id: 'garden', label: 'Garden Green', accent: '#2f9f5b', preview: '#dff3e6' },
  { id: 'desert', label: 'Fuchsia Bloom', accent: '#c34fa3', preview: '#f3d5ea' },
  { id: 'agave', label: 'Agave Blue', accent: '#347fbd', preview: '#d7e9f7' },
]

export const isChatTheme = (value: unknown): value is ChatThemeId =>
  CHAT_THEMES.some((theme) => theme.id === value)

export function chatThemeForAgent(appearance: ChatAppearance, agentId: string): ChatThemeId {
  if (agentId === 'daisy' || agentId === 'rosie' || agentId === 'nova') {
    return appearance.themes[agentId]
  }
  return DEFAULT_CHAT_APPEARANCE.themes.nova
}

export function chatThemeStyle(theme: ChatThemeId): CSSProperties {
  const accent = CHAT_THEMES.find((item) => item.id === theme)?.accent ?? CHAT_THEMES[0].accent
  return {
    '--primary': accent,
    '--ring': accent,
    '--secondary': `color-mix(in srgb, ${accent} 16%, var(--card))`,
    '--secondary-foreground': `color-mix(in srgb, ${accent} 82%, var(--foreground))`,
    '--lps-bubble': `color-mix(in srgb, ${accent} 9%, var(--card))`,
  } as CSSProperties
}
