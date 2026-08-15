import { describe, expect, it } from 'vitest'

import {
  addDays,
  addYearsClamped,
  daysBetween,
  startOfWeek,
} from './localDate'
import {
  calculateLifeStats,
  generateLifeWeeks,
} from './lifeCalendar'
import { DEFAULT_APPEARANCE } from '../theme'

import type { LifeSettings } from '../models'

describe('local date calculations', () => {
  it('calculates days across a leap day', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2)
  })

  it('adds days across the end of a month', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('clamps February 29 when the target year is not a leap year', () => {
    expect(addYearsClamped('2004-02-29', 1)).toBe('2005-02-28')
  })

  it('finds Monday as the start of a week', () => {
    expect(startOfWeek('2026-07-19', 1)).toBe('2026-07-13')
  })
})

describe('life calendar calculations', () => {
  const settings: LifeSettings = {
    birthDate: '2008-01-02',
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
  }

  it('creates a partial first week when birth was not on Monday', () => {
    const weeks = generateLifeWeeks(settings, '2026-07-19')

    expect(weeks[0]).toMatchObject({
      startDate: '2008-01-02',
      endDateExclusive: '2008-01-07',
      isPartialWeek: true,
    })
  })

  it('creates Monday-to-Monday weeks after the first partial week', () => {
    const weeks = generateLifeWeeks(settings, '2026-07-19')

    expect(weeks[1]).toMatchObject({
      startDate: '2008-01-07',
      endDateExclusive: '2008-01-14',
      isPartialWeek: false,
    })
  })

  it('marks only the week containing today as current', () => {
    const weeks = generateLifeWeeks(settings, '2026-07-19')
    const currentWeeks = weeks.filter((week) => week.state === 'current')

    expect(currentWeeks).toHaveLength(1)
    expect(currentWeeks[0]?.startDate).toBe('2026-07-13')
    expect(currentWeeks[0]?.endDateExclusive).toBe('2026-07-20')
  })

  it('keeps progress inside the selected lifespan', () => {
    const stats = calculateLifeStats(settings, '2026-07-19')

    expect(stats.lifeProgress).toBeGreaterThan(0)
    expect(stats.lifeProgress).toBeLessThan(1)
    expect(stats.elapsedDays + stats.remainingDays).toBe(stats.totalDays)
  })

  it('uses exactly 80 columns of 52 weeks', () => {
    const stats = calculateLifeStats(settings, '2026-07-19')

    expect(stats.targetAge).toBe(80)
    expect(stats.totalGridWeeks).toBe(4_160)
    expect(stats.totalDays).toBe(5 + 4_159 * 7)
  })

  it('maps sequential weeks into 52-week columns', () => {
    const weeks = generateLifeWeeks(settings, '2026-07-19')

    expect(weeks[0]).toMatchObject({ ageYear: 0, weekOfAgeYear: 1 })
    expect(weeks[51]).toMatchObject({ ageYear: 0, weekOfAgeYear: 52 })
    expect(weeks[52]).toMatchObject({ ageYear: 1, weekOfAgeYear: 1 })
    expect(weeks.at(-1)).toMatchObject({ ageYear: 79, weekOfAgeYear: 52 })
    expect(Math.max(...weeks.map((week) => week.ageYear))).toBe(79)
    expect(Math.max(...weeks.map((week) => week.weekOfAgeYear))).toBe(52)
  })

  it('reports zero progress before the birthdate', () => {
    const stats = calculateLifeStats(settings, '2000-01-01')

    expect(stats.elapsedDays).toBe(0)
    expect(stats.lifeProgress).toBe(0)
    expect(stats.currentGridWeekNumber).toBe(0)
  })

  it('caps progress at one after the target date', () => {
    const stats = calculateLifeStats(settings, '2200-01-01')

    expect(stats.elapsedDays).toBe(stats.totalDays)
    expect(stats.remainingDays).toBe(0)
    expect(stats.lifeProgress).toBe(1)
  })
})
