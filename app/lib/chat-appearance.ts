import type { CSSProperties } from 'react'

export type ChatThemeId = 'forest' | 'rose' | 'violet' | 'garden' | 'desert' | 'agave'
export type ChatAgentId = 'daisy' | 'rosie' | 'nova'
export type ChatWallpaperId = 'none' | 'line-art' | 'desert-night'

export type ChatAppearance = {
  themes: Record<ChatAgentId, ChatThemeId>
  wallpaper: ChatWallpaperId
}

export const CHAT_APPEARANCE_STORE = 'lps.chat.appearance.v1'
export const DEFAULT_CHAT_APPEARANCE: ChatAppearance = {
  themes: {
    daisy: 'forest',
    rosie: 'rose',
    nova: 'violet',
  },
  wallpaper: 'none',
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

export const CHAT_WALLPAPERS: {
  id: ChatWallpaperId
  label: string
  description: string
  image?: string
  size?: string
}[] = [
  { id: 'none', label: 'None', description: 'Solid chat background' },
  {
    id: 'line-art',
    label: 'Desert line art',
    description: 'Light original plant doodles',
    image: '/desert-plants-chat.svg',
    size: '320px 320px',
  },
  {
    id: 'desert-night',
    label: 'Desert Night',
    description: 'Dense cactus and agave doodles',
    image: '/desert-night-chat.webp',
    size: '480px 480px',
  },
]

export const isChatTheme = (value: unknown): value is ChatThemeId =>
  CHAT_THEMES.some((theme) => theme.id === value)

export const isChatWallpaper = (value: unknown): value is ChatWallpaperId =>
  CHAT_WALLPAPERS.some((wallpaper) => wallpaper.id === value)

export function chatWallpaperStyle(wallpaperId: ChatWallpaperId): CSSProperties | undefined {
  const wallpaper = CHAT_WALLPAPERS.find((item) => item.id === wallpaperId)
  if (!wallpaper?.image) return undefined
  if (wallpaperId === 'desert-night') {
    return {
      // Color blending takes hue/saturation from the active agent accent but
      // preserves the image luminance: black stays black while the brightened
      // cactus/agave line work rolls forest, coral or violet with the agent.
      backgroundColor: '#000',
      backgroundImage: `linear-gradient(color-mix(in srgb, var(--primary) 58%, transparent), color-mix(in srgb, var(--primary) 58%, transparent)), url('${wallpaper.image}')`,
      backgroundBlendMode: 'color, normal',
      backgroundRepeat: 'repeat',
      backgroundSize: wallpaper.size,
    }
  }
  return {
    backgroundImage: `url('${wallpaper.image}')`,
    backgroundRepeat: 'repeat',
    backgroundSize: wallpaper.size,
  }
}

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
    '--primary-foreground': '#fff',
    '--ring': accent,
    '--secondary': `color-mix(in srgb, ${accent} 16%, var(--card))`,
    '--secondary-foreground': `color-mix(in srgb, ${accent} 82%, var(--foreground))`,
    '--lps-bubble': `color-mix(in srgb, ${accent} 18%, var(--card))`,
    '--chat-bubble-border': `color-mix(in srgb, ${accent} 28%, var(--border))`,
  } as CSSProperties
}
