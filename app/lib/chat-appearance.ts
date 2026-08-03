import type { CSSProperties } from 'react'

export type ChatThemeId = 'garden' | 'desert' | 'agave'

export type ChatAppearance = {
  theme: ChatThemeId
  wallpaper: boolean
}

export const CHAT_APPEARANCE_STORE = 'lps.chat.appearance.v1'
export const DEFAULT_CHAT_APPEARANCE: ChatAppearance = { theme: 'garden', wallpaper: false }

export const CHAT_THEMES: { id: ChatThemeId; label: string; accent: string; preview: string }[] = [
  { id: 'garden', label: 'Garden Green', accent: '#2f9f5b', preview: '#dff3e6' },
  { id: 'desert', label: 'Fuchsia Bloom', accent: '#c34fa3', preview: '#f3d5ea' },
  { id: 'agave', label: 'Agave Blue', accent: '#347fbd', preview: '#d7e9f7' },
]

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
