import type { ISODate, WeekStartsOn } from './dates/localDate'

export const TARGET_AGE = 80
export const WEEKS_PER_YEAR = 52
export const TOTAL_LIFE_WEEKS = TARGET_AGE * WEEKS_PER_YEAR

export type PrivacyMode = 'privacy' | 'personal'
export type ReviewKind = 'on-time' | 'retrospective'
export type ThemeId =
  | 'desktop'
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

export type LifeChapterKind = 'chapter' | 'milestone'
export type DateConfidence = 'exact' | 'approximate'

export interface LifeChapter {
  id: string
  title: string
  startDate: ISODate
  endDate: ISODate
  color: string
  kind: LifeChapterKind
  confidence: DateConfidence
  note: string
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
  lifeChapters: LifeChapter[]
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
