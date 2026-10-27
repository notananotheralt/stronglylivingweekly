import { describe, expect, it } from 'vitest'

import {
  createDesktopSummary,
  findLastOnTimeReviewWeekStart,
} from './desktopSummary'
import { DEFAULT_APPEARANCE } from './theme'

import type { LifeWeek } from './dates/lifeCalendar'
import type { LifeSettings } from './models'

const currentWeek: LifeWeek = {
  index: 969,
  weekNumber: 970,
  ageYear: 18,
  weekOfAgeYear: 34,
  startDate: '2026-08-10',
  endDateExclusive: '2026-08-17',
  state: 'current',
  isPartialWeek: false,
}

const settings: LifeSettings = {
  birthDate: '2008-01-02',
  weekStartsOn: 1,
  privacyMode: 'privacy',
  quote: 'Private journal text must not leak',
  showDate: true,
  showYearProgress: true,
  showWeekRemaining: true,
  appearance: {
    themeId: DEFAULT_APPEARANCE.themeId,
    customColors: { ...DEFAULT_APPEARANCE.customColors },
  },
  lifeChapters: [],
}

function summary(overrides: Partial<LifeSettings> = {}) {
  return createDesktopSummary({
    settings: { ...settings, ...overrides },
    anchorWeek: currentWeek,
    recordedWeeks: 21,
    lastOnTimeReviewWeekStart: '2026-08-03',
    currentCommitment: 'Ship the Linux beta',
    generatedAt: '2026-08-15T10:00:00.000Z',
  })
}

describe('desktop summary privacy projection', () => {
  it('always removes commitment text in Privacy mode', () => {
    expect(summary()).toMatchObject({
      privacyMode: 'privacy',
      commitment: null,
      commitmentValidThrough: null,
    })
  })

  it('includes only the current commitment in Personal mode', () => {
    expect(summary({ privacyMode: 'personal' })).toMatchObject({
      privacyMode: 'personal',
      commitment: 'Ship the Linux beta',
      commitmentValidThrough: '2026-08-16',
    })
  })

  it('does not expose settings, journal, or daily-note fields', () => {
    expect(Object.keys(summary())).toEqual([
      'schema',
      'generatedAt',
      'anchorWeekStart',
      'anchorWeekNumber',
      'totalWeeks',
      'weekStartsOn',
      'recordedWeeks',
      'lastOnTimeReviewWeekStart',
      'privacyMode',
      'commitment',
      'commitmentValidThrough',
      'theme',
    ])
    expect(JSON.stringify(summary())).not.toContain(settings.birthDate)
    expect(JSON.stringify(summary())).not.toContain(settings.quote)
    expect(JSON.stringify(summary())).not.toContain('whatHappened')
    expect(JSON.stringify(summary())).not.toContain('dailyNotes')
  })

  it('clamps week and record counts to the fixed grid', () => {
    const result = createDesktopSummary({
      settings,
      anchorWeek: { ...currentWeek, weekNumber: 99_999 },
      recordedWeeks: -5,
      lastOnTimeReviewWeekStart: null,
      currentCommitment: '',
      generatedAt: '2026-08-15T10:00:00.000Z',
    })

    expect(result.anchorWeekNumber).toBe(4_160)
    expect(result.recordedWeeks).toBe(0)
  })

  it('replaces invalid custom colors before serialization', () => {
    const result = summary({
      appearance: {
        themeId: 'custom',
        customColors: {
          ...DEFAULT_APPEARANCE.customColors,
          surface: 'transparent',
          text: '#nothex',
          accent: '#123456',
        },
      },
    })

    expect(result.theme).toEqual({
      surface: DEFAULT_APPEARANCE.customColors.surface,
      text: DEFAULT_APPEARANCE.customColors.text,
      accent: '#123456',
    })
  })

  it('projects only the newest completed on-time review date', () => {
    expect(
      findLastOnTimeReviewWeekStart({
        retrospective: {
          weekStart: '2026-08-10',
          whatHappened: 'Late note',
          rating: 3,
          nextCommitment: '',
          reviewKind: 'retrospective',
          sealedAt: '2026-08-20T10:00:00.000Z',
          updatedAt: '2026-08-20T10:00:00.000Z',
        },
        earlier: {
          weekStart: '2026-07-27',
          whatHappened: 'Earlier review',
          rating: 4,
          nextCommitment: 'Keep going',
          reviewKind: 'on-time',
          sealedAt: '2026-08-03T10:00:00.000Z',
          updatedAt: '2026-08-03T10:00:00.000Z',
        },
        latest: {
          weekStart: '2026-08-03',
          whatHappened: 'Latest review',
          rating: 5,
          nextCommitment: 'Finish the work',
          reviewKind: 'on-time',
          sealedAt: '2026-08-10T10:00:00.000Z',
          updatedAt: '2026-08-10T10:00:00.000Z',
        },
      }),
    ).toBe('2026-08-03')
  })
})
