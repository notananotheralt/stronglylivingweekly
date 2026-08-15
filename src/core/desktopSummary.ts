import { addDays } from './dates/localDate'
import { TOTAL_LIFE_WEEKS } from './models'
import {
  isHexColor,
  resolveThemeColors,
  THEME_PRESETS,
} from './theme'

import type { LifeWeek } from './dates/lifeCalendar'
import type { LifeSettings } from './models'

export interface DesktopSummary {
  schema: 'stronglylivingweekly.summary.v1'
  generatedAt: string
  anchorWeekStart: string
  anchorWeekNumber: number
  totalWeeks: number
  weekStartsOn: 1
  recordedWeeks: number
  privacyMode: 'privacy' | 'personal'
  commitment: string | null
  commitmentValidThrough: string | null
  theme: {
    surface: string
    text: string
    accent: string
  }
}

export interface DesktopSummaryInput {
  settings: LifeSettings
  anchorWeek: LifeWeek
  recordedWeeks: number
  currentCommitment: string
  generatedAt: string
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum
  }

  return Math.min(maximum, Math.max(minimum, Math.trunc(value)))
}

export function createDesktopSummary({
  settings,
  anchorWeek,
  recordedWeeks,
  currentCommitment,
  generatedAt,
}: DesktopSummaryInput): DesktopSummary {
  const colors = resolveThemeColors(settings.appearance)
  const fallback = THEME_PRESETS[0].colors
  const commitment =
    settings.privacyMode === 'personal' && anchorWeek.state === 'current'
      ? currentCommitment.trim() || null
      : null

  return {
    schema: 'stronglylivingweekly.summary.v1',
    generatedAt,
    anchorWeekStart: anchorWeek.startDate,
    anchorWeekNumber: clampInteger(
      anchorWeek.weekNumber,
      1,
      TOTAL_LIFE_WEEKS,
    ),
    totalWeeks: TOTAL_LIFE_WEEKS,
    weekStartsOn: 1,
    recordedWeeks: clampInteger(recordedWeeks, 0, TOTAL_LIFE_WEEKS),
    privacyMode: settings.privacyMode,
    commitment,
    commitmentValidThrough: commitment
      ? addDays(anchorWeek.endDateExclusive, -1)
      : null,
    theme: {
      surface: isHexColor(colors.surface) ? colors.surface : fallback.surface,
      text: isHexColor(colors.text) ? colors.text : fallback.text,
      accent: isHexColor(colors.accent) ? colors.accent : fallback.accent,
    },
  }
}
