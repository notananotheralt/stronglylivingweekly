import {
  addDays,
  addYearsClamped,
  clampNumber,
  compareISODate,
  daysBetween,
  startOfWeek,
  todayISO,
} from './localDate'

import type { ISODate } from './localDate'
import type { LifeSettings } from '../models'
import {
  TARGET_AGE,
  TOTAL_LIFE_WEEKS,
  WEEKS_PER_YEAR,
} from '../models'

export type LifeWeekState = 'elapsed' | 'current' | 'future'

export interface LifeWeek {
  index: number
  weekNumber: number
  ageYear: number
  weekOfAgeYear: number
  startDate: ISODate
  endDateExclusive: ISODate
  state: LifeWeekState
  isPartialWeek: boolean
}

export interface LifeStats {
  birthDate: ISODate
  targetDate: ISODate
  today: ISODate
  targetAge: number
  totalDays: number
  elapsedDays: number
  remainingDays: number
  completeAgeWeeksElapsed: number
  approximateAgeWeeksRemaining: number
  totalGridWeeks: number
  currentGridWeekNumber: number
  lifeProgress: number
}

function validateSettings(settings: LifeSettings): void {
  if (settings.weekStartsOn !== 1) {
    throw new Error('Strongly Living Weekly uses Monday-starting weeks.')
  }

  addYearsClamped(settings.birthDate, TARGET_AGE)
}

function determineWeekState(
  startDate: ISODate,
  endDateExclusive: ISODate,
  today: ISODate,
): LifeWeekState {
  if (compareISODate(today, startDate) < 0) {
    return 'future'
  }

  if (compareISODate(today, endDateExclusive) >= 0) {
    return 'elapsed'
  }

  return 'current'
}

function calculateFixedTargetDate(settings: LifeSettings): ISODate {
  const firstWeekEnd = addDays(
    startOfWeek(settings.birthDate, settings.weekStartsOn),
    7,
  )

  return addDays(firstWeekEnd, (TOTAL_LIFE_WEEKS - 1) * 7)
}

export function generateLifeWeeks(
  settings: LifeSettings,
  today: ISODate = todayISO(),
): LifeWeek[] {
  validateSettings(settings)

  const targetDate = calculateFixedTargetDate(settings)
  const weeks: LifeWeek[] = []
  let startDate = settings.birthDate
  let endDateExclusive = addDays(
    startOfWeek(settings.birthDate, settings.weekStartsOn),
    7,
  )

  while (weeks.length < TOTAL_LIFE_WEEKS) {
    const index = weeks.length
    const durationDays = daysBetween(startDate, endDateExclusive)

    weeks.push({
      index,
      weekNumber: index + 1,
      ageYear: Math.floor(index / WEEKS_PER_YEAR),
      weekOfAgeYear: (index % WEEKS_PER_YEAR) + 1,
      startDate,
      endDateExclusive,
      state: determineWeekState(startDate, endDateExclusive, today),
      isPartialWeek: durationDays < 7,
    })

    startDate = endDateExclusive
    endDateExclusive = addDays(startDate, 7)
  }

  if (weeks.at(-1)?.endDateExclusive !== targetDate) {
    throw new Error('The fixed life calendar did not end on its target date.')
  }

  return weeks
}

export function calculateLifeStats(
  settings: LifeSettings,
  today: ISODate = todayISO(),
): LifeStats {
  validateSettings(settings)

  const targetDate = calculateFixedTargetDate(settings)
  const totalDays = daysBetween(settings.birthDate, targetDate)
  const elapsedDays = clampNumber(
    daysBetween(settings.birthDate, today),
    0,
    totalDays,
  )
  const remainingDays = totalDays - elapsedDays
  const weeks = generateLifeWeeks(settings, today)
  const currentWeekIndex = weeks.findIndex(
    (week) => week.state === 'current',
  )

  let currentGridWeekNumber = 0

  if (currentWeekIndex >= 0) {
    currentGridWeekNumber = currentWeekIndex + 1
  } else if (compareISODate(today, targetDate) >= 0) {
    currentGridWeekNumber = weeks.length
  }

  return {
    birthDate: settings.birthDate,
    targetDate,
    today,
    targetAge: TARGET_AGE,
    totalDays,
    elapsedDays,
    remainingDays,
    completeAgeWeeksElapsed: Math.floor(elapsedDays / 7),
    approximateAgeWeeksRemaining: Math.ceil(remainingDays / 7),
    totalGridWeeks: weeks.length,
    currentGridWeekNumber,
    lifeProgress: totalDays === 0 ? 0 : elapsedDays / totalDays,
  }
}
