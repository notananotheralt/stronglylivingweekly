import { addDays, compareISODate } from './localDate'

import type { LifeWeek } from './lifeCalendar'
import type { ISODate } from './localDate'
import type { WeekEntry } from '../models'

export type WeekDisplayState =
  | 'future'
  | 'current'
  | 'awaiting-review'
  | 'recorded'
  | 'missed'
  | 'retrospective'

export function getWeekDisplayState(
  week: LifeWeek,
  today: ISODate,
  entry?: WeekEntry,
): WeekDisplayState {
  if (week.state === 'future') {
    return 'future'
  }

  if (week.state === 'current') {
    return 'current'
  }

  if (entry?.reviewKind === 'on-time') {
    return 'recorded'
  }

  if (today === week.endDateExclusive) {
    return 'awaiting-review'
  }

  if (entry?.reviewKind === 'retrospective') {
    return 'retrospective'
  }

  return 'missed'
}

export function isWeekReviewable(
  week: LifeWeek,
  today: ISODate,
  entry?: WeekEntry,
): boolean {
  return getWeekDisplayState(week, today, entry) === 'awaiting-review'
}

export function reviewClosesOn(week: LifeWeek): ISODate {
  return addDays(week.endDateExclusive, 1)
}

export function isDateInsideWeek(date: ISODate, week: LifeWeek): boolean {
  return (
    compareISODate(date, week.startDate) >= 0 &&
    compareISODate(date, week.endDateExclusive) < 0
  )
}
