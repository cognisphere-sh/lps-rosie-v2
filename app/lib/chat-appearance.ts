import type { CSSProperties } from 'react'

export type ChatThemeId = 'edge' | 'forest' | 'rose' | 'violet' | 'garden' | 'desert' | 'agave'
export type ChatAgentId = 'daisy' | 'rosie' | 'nova'
export type ChatWallpaperId = 'none' | 'line-art' | 'desert-night'

export type ChatAppearance = {
  themes: Record<ChatAgentId, ChatThemeId>
  wallpapers: Record<ChatAgentId, ChatWallpaperId>
}

export const CHAT_APPEARANCE_STORE = 'lps.chat.appearance.v1'
export const CHAT_EDGE_DEFAULT_MIGRATION_STORE = 'lps.chat.appearance.v1.edge-default'
export const DEFAULT_CHAT_APPEARANCE: ChatAppearance = {
  themes: {
    daisy: 'edge',
    rosie: 'rose',
    nova: 'violet',
  },
  wallpapers: {
    daisy: 'none',
    rosie: 'none',
    nova: 'none',
  },
}

export const CHAT_THEMES: { id: ChatThemeId; label: string; accent: string; preview: string }[] = [
  { id: 'edge', label: 'Edge Teal', accent: '#087F8C', preview: '#d8eef0' },
  // These three are sampled toward each profile image's dominant backdrop.
  { id: 'forest', label: 'Forest Green', accent: '#3e7b36', preview: '#dcebd8' },
  { id: 'rose', label: 'Coral Rose', accent: '#b15150', preview: '#f0d9d8' },
  { id: 'violet', label: 'Electric Violet', accent: '#6540bd', preview: '#e3dcf4' },
  { id: 'garden', label: 'Garden Green', accent: '#247a45', preview: '#dff3e6' },
  { id: 'desert', label: 'Fuchsia Bloom', accent: '#a63e89', preview: '#f3d5ea' },
  { id: 'agave', label: 'Agave Blue', accent: '#276a9e', preview: '#d7e9f7' },
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

export const CHAT_AGENT_IDS = ['daisy', 'rosie', 'nova'] as const

/**
 * The stored wallpapers, from any shape this preference has had.
 *
 * Two legacy shapes predate per-agent wallpapers: `wallpaper: true` (the first
 * line-art flag) and `wallpaper: <id>` (one choice shared by every chat).
 * Either one becomes every agent's wallpaper, so splitting the setting doesn't
 * silently change how anyone's chats already look.
 */
export function readChatWallpapers(
  saved: { wallpapers?: Partial<Record<ChatAgentId, unknown>>; wallpaper?: unknown } | null,
): Record<ChatAgentId, ChatWallpaperId> {
  const legacy: ChatWallpaperId = isChatWallpaper(saved?.wallpaper)
    ? saved.wallpaper
    : saved?.wallpaper === true ? 'line-art' : 'none'
  const wallpapers = { daisy: legacy, rosie: legacy, nova: legacy }
  for (const id of CHAT_AGENT_IDS) {
    const value = saved?.wallpapers?.[id]
    if (isChatWallpaper(value)) wallpapers[id] = value
  }
  return wallpapers
}

export function chatWallpaperForAgent(
  appearance: ChatAppearance,
  agentId: string,
): ChatWallpaperId {
  if (agentId === 'daisy' || agentId === 'rosie' || agentId === 'nova') {
    return appearance.wallpapers[agentId]
  }
  return DEFAULT_CHAT_APPEARANCE.wallpapers.nova
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
