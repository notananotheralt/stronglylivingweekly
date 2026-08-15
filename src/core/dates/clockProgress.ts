import type { WeekStartsOn } from './localDate'

const MILLISECONDS_PER_HOUR = 3_600_000
const MILLISECONDS_PER_DAY = 86_400_000

export interface ClockProgress {
  yearProgress: number
  weekProgress: number
  weeksRemainingInYear: number
  daysRemainingInWeek: number
  hoursRemainingInWeek: number
}

function startOfLocalWeek(now: Date, weekStartsOn: WeekStartsOn): Date {
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  )
  const daysSinceStart = (start.getDay() - weekStartsOn + 7) % 7
  start.setDate(start.getDate() - daysSinceStart)
  return start
}

function addLocalDays(date: Date, amount: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}

export function calculateClockProgress(
  now: Date,
  weekStartsOn: WeekStartsOn,
): ClockProgress {
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const nextYear = new Date(now.getFullYear() + 1, 0, 1)
  const weekStart = startOfLocalWeek(now, weekStartsOn)
  const nextWeek = addLocalDays(weekStart, 7)

  const yearDuration = nextYear.getTime() - yearStart.getTime()
  const weekDuration = nextWeek.getTime() - weekStart.getTime()
  const remainingYear = Math.max(nextYear.getTime() - now.getTime(), 0)
  const remainingWeek = Math.max(nextWeek.getTime() - now.getTime(), 0)

  return {
    yearProgress: (now.getTime() - yearStart.getTime()) / yearDuration,
    weekProgress: (now.getTime() - weekStart.getTime()) / weekDuration,
    weeksRemainingInYear: Math.ceil(
      remainingYear / (7 * MILLISECONDS_PER_DAY),
    ),
    daysRemainingInWeek: Math.ceil(
      remainingWeek / MILLISECONDS_PER_DAY,
    ),
    hoursRemainingInWeek: Math.ceil(
      remainingWeek / MILLISECONDS_PER_HOUR,
    ),
  }
}
