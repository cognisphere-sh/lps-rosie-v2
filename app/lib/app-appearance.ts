import type { CSSProperties } from 'react'

export type AppAccentId = 'edge' | 'ocean' | 'forest' | 'plum' | 'coral'

export const APP_APPEARANCE_STORE = 'lps.app.appearance.v1'
export const DEFAULT_APP_ACCENT: AppAccentId = 'edge'

export const APP_ACCENTS: {
  id: AppAccentId
  label: string
  light: string
  dark: string
  lightForeground: string
  darkForeground: string
}[] = [
  { id: 'edge', label: 'Edge Teal', light: '#087F8C', dark: '#42C7C9', lightForeground: '#FFFFFF', darkForeground: '#07191B' },
  { id: 'ocean', label: 'Ocean Blue', light: '#2563A9', dark: '#6BA7E8', lightForeground: '#FFFFFF', darkForeground: '#071522' },
  { id: 'forest', label: 'Forest Green', light: '#2F7A44', dark: '#62D087', lightForeground: '#FFFFFF', darkForeground: '#07190E' },
  { id: 'plum', label: 'Soft Plum', light: '#76528E', dark: '#C59AD9', lightForeground: '#FFFFFF', darkForeground: '#1D1023' },
  { id: 'coral', label: 'Warm Coral', light: '#A84F45', dark: '#F08F82', lightForeground: '#FFFFFF', darkForeground: '#25100D' },
]

export const isAppAccent = (value: unknown): value is AppAccentId =>
  APP_ACCENTS.some((accent) => accent.id === value)

/**
 * Reads the device preference. A missing value is the former implicit forest
 * default, so it alone moves to Edge Teal; any valid explicit choice survives.
 */
export function readAppAccent(raw: string | null): AppAccentId {
  if (!raw) return DEFAULT_APP_ACCENT
  try {
    const saved = JSON.parse(raw) as { accent?: unknown } | null
    return isAppAccent(saved?.accent) ? saved.accent : DEFAULT_APP_ACCENT
  } catch {
    return DEFAULT_APP_ACCENT
  }
}

export function appAccentStyle(id: AppAccentId, dark: boolean): CSSProperties {
  const choice = APP_ACCENTS.find((accent) => accent.id === id) ?? APP_ACCENTS[0]
  const color = dark ? choice.dark : choice.light
  const foreground = dark ? choice.darkForeground : choice.lightForeground
  return {
    '--primary': color,
    '--primary-foreground': foreground,
    '--ring': color,
    '--secondary': `color-mix(in srgb, ${color} 16%, var(--card))`,
    '--secondary-foreground': `color-mix(in srgb, ${color} 78%, var(--foreground))`,
    '--accent': `color-mix(in srgb, ${color} 30%, var(--card))`,
    '--accent-foreground': `color-mix(in srgb, ${color} 78%, var(--foreground))`,
    '--sidebar-primary': color,
    '--sidebar-primary-foreground': foreground,
    '--sidebar-accent': `color-mix(in srgb, ${color} 16%, var(--sidebar))`,
    '--sidebar-accent-foreground': `color-mix(in srgb, ${color} 78%, var(--foreground))`,
    '--sidebar-ring': color,
  } as CSSProperties
}

export function appAccentColor(id: AppAccentId, dark: boolean): string {
  const choice = APP_ACCENTS.find((accent) => accent.id === id) ?? APP_ACCENTS[0]
  return dark ? choice.dark : choice.light
}
