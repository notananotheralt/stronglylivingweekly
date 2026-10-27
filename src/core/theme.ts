import type { AppearanceSettings, ThemeColors, ThemeId } from './models'

export interface ThemePreset {
  id: Exclude<ThemeId, 'custom'>
  name: string
  description: string
  colors: ThemeColors
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'desktop',
    name: 'Desktop',
    description: 'Follow the current DMS wallpaper palette',
    colors: {
      canvas: '#0f1411',
      surface: '#151b18',
      text: '#edf1ed',
      muted: '#89918c',
      elapsed: '#35403a',
      future: '#27302b',
      recorded: '#789483',
      current: '#aec4b6',
      accent: '#c3a676',
    },
  },
  {
    id: 'observatory',
    name: 'Observatory',
    description: 'Forest black and soft sage',
    colors: {
      canvas: '#0f1411',
      surface: '#151b18',
      text: '#edf1ed',
      muted: '#89918c',
      elapsed: '#35403a',
      future: '#27302b',
      recorded: '#789483',
      current: '#aec4b6',
      accent: '#c3a676',
    },
  },
  {
    id: 'graphite',
    name: 'Graphite',
    description: 'Neutral, restrained monochrome',
    colors: {
      canvas: '#0c0d0f',
      surface: '#16181b',
      text: '#f0f2f4',
      muted: '#7d828a',
      elapsed: '#34373d',
      future: '#222429',
      recorded: '#777d87',
      current: '#e2e6eb',
      accent: '#aeb4bd',
    },
  },
  {
    id: 'frost',
    name: 'Frost',
    description: 'Cool glass for a blue-toned rice',
    colors: {
      canvas: '#0b1117',
      surface: '#121c24',
      text: '#e7f1f6',
      muted: '#78909e',
      elapsed: '#2c3b46',
      future: '#1b2932',
      recorded: '#638da4',
      current: '#b3d6e5',
      accent: '#8fc4d8',
    },
  },
  {
    id: 'ember',
    name: 'Ember',
    description: 'Warm charcoal and muted amber',
    colors: {
      canvas: '#15100d',
      surface: '#211813',
      text: '#f5ece4',
      muted: '#a28b7e',
      elapsed: '#46362d',
      future: '#2c211b',
      recorded: '#a66f50',
      current: '#e3b08c',
      accent: '#d6925f',
    },
  },
]

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  themeId: 'desktop',
  customColors: { ...THEME_PRESETS[0].colors },
}

export const THEME_COLOR_FIELDS: Array<{
  key: keyof ThemeColors
  label: string
}> = [
  { key: 'canvas', label: 'Canvas' },
  { key: 'surface', label: 'Panels' },
  { key: 'text', label: 'Text' },
  { key: 'muted', label: 'Muted text' },
  { key: 'elapsed', label: 'Elapsed weeks' },
  { key: 'future', label: 'Future weeks' },
  { key: 'recorded', label: 'Recorded weeks' },
  { key: 'current', label: 'Current week' },
  { key: 'accent', label: 'Review accent' },
]

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

export function resolveThemeColors(
  appearance: AppearanceSettings,
): ThemeColors {
  if (
    appearance.themeId === 'custom' ||
    appearance.themeId === 'desktop'
  ) {
    return appearance.customColors
  }

  return (
    THEME_PRESETS.find((theme) => theme.id === appearance.themeId)?.colors ??
    THEME_PRESETS[1].colors
  )
}

export function themeVariables(
  appearance: AppearanceSettings,
): Record<string, string> {
  const colors = resolveThemeColors(appearance)

  return {
    '--canvas': colors.canvas,
    '--surface': colors.surface,
    '--surface-raised': `color-mix(in srgb, ${colors.surface} 88%, ${colors.text})`,
    '--ink': colors.text,
    '--ink-soft': `color-mix(in srgb, ${colors.text} 78%, ${colors.muted})`,
    '--muted': colors.muted,
    '--line': `color-mix(in srgb, ${colors.text} 9%, transparent)`,
    '--line-strong': `color-mix(in srgb, ${colors.text} 17%, transparent)`,
    '--week-elapsed': colors.elapsed,
    '--week-future': colors.future,
    '--sage': colors.recorded,
    '--sage-bright': colors.current,
    '--gold': colors.accent,
    '--gold-deep': `color-mix(in srgb, ${colors.accent} 68%, ${colors.canvas})`,
  }
}
