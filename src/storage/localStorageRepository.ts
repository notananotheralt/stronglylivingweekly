import { addDays, addYearsClamped } from '../core/dates/localDate'
import {
  DEFAULT_APPEARANCE,
  isHexColor,
} from '../core/theme'
import { MAX_LIFE_CHAPTERS } from '../core/timeline'

import type {
  DailyNote,
  AppearanceSettings,
  LifeCalendarBackup,
  LifeChapter,
  LifeSettings,
  ThemeColors,
  ThemeId,
  WeekEntry,
} from '../core/models'

const SETTINGS_KEY = 'strongly-living-weekly.settings.v2'
const ENTRIES_KEY = 'strongly-living-weekly.entries.v2'
const DAILY_NOTES_KEY = 'strongly-living-weekly.daily-notes.v2'
const LEGACY_SETTINGS_KEY = 'strongly-living-weekly.settings.v1'
const LEGACY_ENTRIES_KEY = 'strongly-living-weekly.entries.v1'

interface LegacySettings {
  birthDate: string
  targetAge: 90 | 100
  weekStartsOn: 0 | 1
}

interface LegacyWeekEntry {
  weekStart: string
  summary: string
  feelings: string
  wentWell: string
  improvement: string
  nextIntention: string
  mood: number | null
  progress: number | null
  updatedAt: string
}

interface LegacyBackup {
  version: 1
  exportedAt: string
  settings: LegacySettings
  entries: Record<string, LegacyWeekEntry>
}

export interface TimelineSeed {
  seedId: string
  chapters: LifeChapter[]
}

function readJSON(key: string): unknown {
  try {
    const value = window.localStorage.getItem(key)
    return value ? (JSON.parse(value) as unknown) : null
  } catch {
    return null
  }
}

function defaultSettings(birthDate: string): LifeSettings {
  return {
    birthDate,
    weekStartsOn: 1,
    privacyMode: 'privacy',
    quote: '',
    showDate: true,
    showYearProgress: true,
    showWeekRemaining: true,
    appearance: {
      themeId: DEFAULT_APPEARANCE.themeId,
      customColors: { ...DEFAULT_APPEARANCE.customColors },
    },
    lifeChapters: [],
  }
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  try {
    addDays(value, 0)
    return true
  } catch {
    return false
  }
}

function isThemeId(value: unknown): value is ThemeId {
  return ['desktop', 'observatory', 'graphite', 'frost', 'ember', 'custom'].includes(
    String(value),
  )
}

function isThemeColors(value: unknown): value is ThemeColors {
  if (!value || typeof value !== 'object') {
    return false
  }

  const colors = value as Partial<ThemeColors>

  return [
    colors.canvas,
    colors.surface,
    colors.text,
    colors.muted,
    colors.elapsed,
    colors.future,
    colors.recorded,
    colors.current,
    colors.accent,
  ].every(isHexColor)
}

function parseAppearance(value: unknown): AppearanceSettings {
  if (!value || typeof value !== 'object') {
    return {
      themeId: DEFAULT_APPEARANCE.themeId,
      customColors: { ...DEFAULT_APPEARANCE.customColors },
    }
  }

  const appearance = value as Partial<AppearanceSettings>

  return {
    themeId: isThemeId(appearance.themeId)
      ? appearance.themeId
      : DEFAULT_APPEARANCE.themeId,
    customColors: isThemeColors(appearance.customColors)
      ? appearance.customColors
      : { ...DEFAULT_APPEARANCE.customColors },
  }
}

function parseLifeChapters(value: unknown): LifeChapter[] | null {
  if (value === undefined) {
    return []
  }

  if (!Array.isArray(value) || value.length > MAX_LIFE_CHAPTERS) {
    return null
  }

  const chapters: LifeChapter[] = []
  const ids = new Set<string>()

  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') {
      return null
    }

    const chapter = candidate as Partial<LifeChapter>

    if (
      typeof chapter.id !== 'string' ||
      !chapter.id.trim() ||
      chapter.id.length > 100 ||
      ids.has(chapter.id) ||
      typeof chapter.title !== 'string' ||
      !chapter.title.trim() ||
      chapter.title.length > 100 ||
      !isValidDate(chapter.startDate) ||
      !isValidDate(chapter.endDate) ||
      chapter.startDate > chapter.endDate ||
      !isHexColor(chapter.color) ||
      (chapter.kind !== 'chapter' && chapter.kind !== 'milestone') ||
      (chapter.confidence !== 'exact' &&
        chapter.confidence !== 'approximate') ||
      typeof chapter.note !== 'string' ||
      chapter.note.length > 1_000
    ) {
      return null
    }

    ids.add(chapter.id)
    chapters.push({
      id: chapter.id,
      title: chapter.title.trim(),
      startDate: chapter.startDate,
      endDate:
        chapter.kind === 'milestone' ? chapter.startDate : chapter.endDate,
      color: chapter.color.toLowerCase(),
      kind: chapter.kind,
      confidence: chapter.confidence,
      note: chapter.note.trim(),
    })
  }

  return chapters
}

export function parseTimelineSeed(source: string): TimelineSeed {
  let value: unknown

  try {
    value = JSON.parse(source) as unknown
  } catch {
    throw new Error('The life chapter seed is not valid JSON.')
  }

  if (!value || typeof value !== 'object') {
    throw new Error('The life chapter seed is invalid.')
  }

  const seed = value as Partial<TimelineSeed>
  const chapters = parseLifeChapters(seed.chapters)

  if (
    typeof seed.seedId !== 'string' ||
    !seed.seedId.trim() ||
    seed.seedId.length > 100 ||
    !chapters
  ) {
    throw new Error('The life chapter seed is invalid.')
  }

  return {
    seedId: seed.seedId.trim(),
    chapters,
  }
}

function parseLifeSettings(value: unknown): LifeSettings | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const settings = value as Partial<LifeSettings>
  const lifeChapters = parseLifeChapters(settings.lifeChapters)

  if (
    !isValidDate(settings.birthDate) ||
    settings.weekStartsOn !== 1 ||
    (settings.privacyMode !== 'privacy' &&
      settings.privacyMode !== 'personal') ||
    typeof settings.quote !== 'string' ||
    typeof settings.showDate !== 'boolean' ||
    typeof settings.showYearProgress !== 'boolean' ||
    typeof settings.showWeekRemaining !== 'boolean' ||
    !lifeChapters
  ) {
    return null
  }

  try {
    addYearsClamped(settings.birthDate, 80)
    return {
      birthDate: settings.birthDate,
      weekStartsOn: 1,
      privacyMode: settings.privacyMode,
      quote: settings.quote,
      showDate: settings.showDate,
      showYearProgress: settings.showYearProgress,
      showWeekRemaining: settings.showWeekRemaining,
      appearance: parseAppearance(settings.appearance),
      lifeChapters,
    }
  } catch {
    return null
  }
}

function isLegacySettings(value: unknown): value is LegacySettings {
  if (!value || typeof value !== 'object') {
    return false
  }

  const settings = value as Partial<LegacySettings>

  if (
    !isValidDate(settings.birthDate) ||
    (settings.targetAge !== 90 && settings.targetAge !== 100) ||
    (settings.weekStartsOn !== 0 && settings.weekStartsOn !== 1)
  ) {
    return false
  }

  return true
}

function isRating(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  )
}

function isWeekEntry(weekStart: string, value: unknown): value is WeekEntry {
  if (!value || typeof value !== 'object' || !isValidDate(weekStart)) {
    return false
  }

  const entry = value as Partial<WeekEntry>

  return (
    entry.weekStart === weekStart &&
    typeof entry.whatHappened === 'string' &&
    isRating(entry.rating) &&
    typeof entry.nextCommitment === 'string' &&
    (entry.reviewKind === 'on-time' || entry.reviewKind === 'retrospective') &&
    typeof entry.sealedAt === 'string' &&
    typeof entry.updatedAt === 'string'
  )
}

function isLegacyWeekEntry(
  weekStart: string,
  value: unknown,
): value is LegacyWeekEntry {
  if (!value || typeof value !== 'object' || !isValidDate(weekStart)) {
    return false
  }

  const entry = value as Partial<LegacyWeekEntry>

  return (
    entry.weekStart === weekStart &&
    typeof entry.summary === 'string' &&
    typeof entry.feelings === 'string' &&
    typeof entry.wentWell === 'string' &&
    typeof entry.improvement === 'string' &&
    typeof entry.nextIntention === 'string' &&
    (entry.mood === null || isRating(entry.mood)) &&
    (entry.progress === null || isRating(entry.progress)) &&
    typeof entry.updatedAt === 'string'
  )
}

function isDailyNote(date: string, value: unknown): value is DailyNote {
  if (!value || typeof value !== 'object' || !isValidDate(date)) {
    return false
  }

  const note = value as Partial<DailyNote>

  return (
    note.date === date &&
    typeof note.text === 'string' &&
    typeof note.capturedAt === 'string' &&
    typeof note.retrospective === 'boolean'
  )
}

function legacyRating(entry: LegacyWeekEntry): 1 | 2 | 3 | 4 | 5 {
  const ratings = [entry.mood, entry.progress].filter(isRating)

  if (ratings.length === 0) {
    return 3
  }

  return Math.round(
    ratings.reduce((total, rating) => total + rating, 0) / ratings.length,
  ) as 1 | 2 | 3 | 4 | 5
}

function legacyNarrative(entry: LegacyWeekEntry): string {
  const sections = [
    entry.summary.trim(),
    entry.feelings.trim() ? `How I felt: ${entry.feelings.trim()}` : '',
    entry.wentWell.trim() ? `What went well: ${entry.wentWell.trim()}` : '',
    entry.improvement.trim()
      ? `What I wanted to improve: ${entry.improvement.trim()}`
      : '',
  ]

  return sections.filter(Boolean).join('\n\n')
}

function migrateLegacyEntries(
  entries: Record<string, LegacyWeekEntry>,
): Record<string, WeekEntry> {
  return Object.fromEntries(
    Object.entries(entries).map(([weekStart, entry]) => [
      weekStart,
      {
        weekStart,
        whatHappened: legacyNarrative(entry),
        rating: legacyRating(entry),
        nextCommitment: entry.nextIntention,
        reviewKind: 'retrospective',
        sealedAt: entry.updatedAt,
        updatedAt: entry.updatedAt,
      } satisfies WeekEntry,
    ]),
  )
}

function parseEntries(value: unknown): Record<string, WeekEntry> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const entries = Object.entries(value)

  if (entries.some(([weekStart, entry]) => !isWeekEntry(weekStart, entry))) {
    return null
  }

  return Object.fromEntries(entries) as Record<string, WeekEntry>
}

function parseLegacyEntries(
  value: unknown,
): Record<string, LegacyWeekEntry> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const entries = Object.entries(value)

  if (
    entries.some(
      ([weekStart, entry]) => !isLegacyWeekEntry(weekStart, entry),
    )
  ) {
    return null
  }

  return Object.fromEntries(entries) as Record<string, LegacyWeekEntry>
}

function parseDailyNotes(value: unknown): Record<string, DailyNote> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const notes = Object.entries(value)

  if (notes.some(([date, note]) => !isDailyNote(date, note))) {
    return null
  }

  return Object.fromEntries(notes) as Record<string, DailyNote>
}

export function loadSettings(): LifeSettings | null {
  const settings = parseLifeSettings(readJSON(SETTINGS_KEY))

  if (settings) {
    saveSettings(settings)
    return settings
  }

  const legacySettings = readJSON(LEGACY_SETTINGS_KEY)

  if (!isLegacySettings(legacySettings)) {
    return null
  }

  const migrated = defaultSettings(legacySettings.birthDate)
  saveSettings(migrated)
  return migrated
}

export function saveSettings(settings: LifeSettings): void {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function loadEntries(): Record<string, WeekEntry> {
  const entries = parseEntries(readJSON(ENTRIES_KEY))

  if (entries) {
    return entries
  }

  const legacyEntries = parseLegacyEntries(readJSON(LEGACY_ENTRIES_KEY))

  if (!legacyEntries) {
    return {}
  }

  const migrated = migrateLegacyEntries(legacyEntries)
  window.localStorage.setItem(ENTRIES_KEY, JSON.stringify(migrated))
  return migrated
}

export function saveEntry(
  entry: WeekEntry,
  currentEntries: Record<string, WeekEntry>,
): Record<string, WeekEntry> {
  const nextEntries = {
    ...currentEntries,
    [entry.weekStart]: entry,
  }

  window.localStorage.setItem(ENTRIES_KEY, JSON.stringify(nextEntries))
  return nextEntries
}

export function loadDailyNotes(): Record<string, DailyNote> {
  return parseDailyNotes(readJSON(DAILY_NOTES_KEY)) ?? {}
}

export function saveDailyNote(
  note: DailyNote,
  currentNotes: Record<string, DailyNote>,
): Record<string, DailyNote> {
  const nextNotes = {
    ...currentNotes,
    [note.date]: note,
  }

  window.localStorage.setItem(DAILY_NOTES_KEY, JSON.stringify(nextNotes))
  return nextNotes
}

export function createBackup(
  settings: LifeSettings,
  entries: Record<string, WeekEntry>,
  dailyNotes: Record<string, DailyNote>,
): LifeCalendarBackup {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    settings,
    entries,
    dailyNotes,
  }
}

function parseVersionTwoBackup(value: unknown): LifeCalendarBackup | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const backup = value as Partial<LifeCalendarBackup>
  const settings = parseLifeSettings(backup.settings)
  const entries = parseEntries(backup.entries)
  const dailyNotes = parseDailyNotes(backup.dailyNotes)

  if (
    backup.version !== 2 ||
    typeof backup.exportedAt !== 'string' ||
    !settings ||
    !entries ||
    !dailyNotes
  ) {
    return null
  }

  return {
    version: 2,
    exportedAt: backup.exportedAt,
    settings,
    entries,
    dailyNotes,
  }
}

function migrateLegacyBackup(value: unknown): LifeCalendarBackup | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const backup = value as Partial<LegacyBackup>
  const entries = parseLegacyEntries(backup.entries)

  if (
    backup.version !== 1 ||
    typeof backup.exportedAt !== 'string' ||
    !isLegacySettings(backup.settings) ||
    !entries
  ) {
    return null
  }

  return {
    version: 2,
    exportedAt: backup.exportedAt,
    settings: defaultSettings(backup.settings.birthDate),
    entries: migrateLegacyEntries(entries),
    dailyNotes: {},
  }
}

export function parseBackup(source: string): LifeCalendarBackup {
  let value: unknown

  try {
    value = JSON.parse(source) as unknown
  } catch {
    throw new Error('This is not a valid Strongly Living Weekly backup.')
  }

  const backup = parseVersionTwoBackup(value) ?? migrateLegacyBackup(value)

  if (!backup) {
    throw new Error('This is not a valid Strongly Living Weekly backup.')
  }

  return backup
}

export function restoreBackup(backup: LifeCalendarBackup): void {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(backup.settings))
  window.localStorage.setItem(ENTRIES_KEY, JSON.stringify(backup.entries))
  window.localStorage.setItem(
    DAILY_NOTES_KEY,
    JSON.stringify(backup.dailyNotes),
  )
}
