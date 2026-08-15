import type { ISODate, WeekStartsOn } from './dates/localDate'

export const TARGET_AGE = 80
export const WEEKS_PER_YEAR = 52
export const TOTAL_LIFE_WEEKS = TARGET_AGE * WEEKS_PER_YEAR

export type PrivacyMode = 'privacy' | 'personal'
export type ReviewKind = 'on-time' | 'retrospective'
export type ThemeId =
  | 'observatory'
  | 'graphite'
  | 'frost'
  | 'ember'
  | 'custom'

export interface ThemeColors {
  canvas: string
  surface: string
  text: string
  muted: string
  elapsed: string
  future: string
  recorded: string
  current: string
  accent: string
}

export interface AppearanceSettings {
  themeId: ThemeId
  customColors: ThemeColors
}

export interface LifeSettings {
  birthDate: ISODate
  weekStartsOn: WeekStartsOn
  privacyMode: PrivacyMode
  quote: string
  showDate: boolean
  showYearProgress: boolean
  showWeekRemaining: boolean
  appearance: AppearanceSettings
}

export interface WeekEntry {
  weekStart: ISODate
  whatHappened: string
  rating: 1 | 2 | 3 | 4 | 5
  nextCommitment: string
  reviewKind: ReviewKind
  sealedAt: string
  updatedAt: string
}

export interface DailyNote {
  date: ISODate
  text: string
  capturedAt: string
  retrospective: boolean
}

export interface LifeCalendarBackup {
  version: 2
  exportedAt: string
  settings: LifeSettings
  entries: Record<ISODate, WeekEntry>
  dailyNotes: Record<ISODate, DailyNote>
}
