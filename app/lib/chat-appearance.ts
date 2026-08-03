import type { CSSProperties } from 'react'

export type ChatThemeId = 'garden' | 'desert' | 'agave'

export type ChatAppearance = {
  theme: ChatThemeId
  wallpaper: boolean
}

export const CHAT_APPEARANCE_STORE = 'lps.chat.appearance.v1'
export const DEFAULT_CHAT_APPEARANCE: ChatAppearance = { theme: 'garden', wallpaper: false }

export const CHAT_THEMES: { id: ChatThemeId; label: string; accent: string; preview: string }[] = [
  { id: 'garden', label: 'Garden', accent: '#2f9f5b', preview: '#dff3e6' },
  { id: 'desert', label: 'Desert Bloom', accent: '#c66a45', preview: '#f2dfd4' },
  { id: 'agave', label: 'Agave Night', accent: '#2b8f91', preview: '#d7ecea' },
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
