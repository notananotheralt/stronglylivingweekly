export type ISODate = string
export type WeekStartsOn = 0 | 1

const MILLISECONDS_PER_DAY = 86_400_000

interface DateParts {
  year: number
  month: number
  day: number
}

function parseDateParts(value: ISODate): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    throw new Error(`Invalid ISO date: ${value}`)
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${value}`)
  }

  return { year, month, day }
}

function toUTCDate(value: ISODate): Date {
  const { year, month, day } = parseDateParts(value)
  return new Date(Date.UTC(year, month - 1, day))
}

function padNumber(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatUTCDate(date: Date): ISODate {
  return [
    date.getUTCFullYear(),
    padNumber(date.getUTCMonth() + 1),
    padNumber(date.getUTCDate()),
  ].join('-')
}

export function todayISO(now: Date = new Date()): ISODate {
  return [
    now.getFullYear(),
    padNumber(now.getMonth() + 1),
    padNumber(now.getDate()),
  ].join('-')
}

export function dayNumber(value: ISODate): number {
  return Math.floor(toUTCDate(value).getTime() / MILLISECONDS_PER_DAY)
}

export function daysBetween(start: ISODate, end: ISODate): number {
  return dayNumber(end) - dayNumber(start)
}

export function compareISODate(first: ISODate, second: ISODate): number {
  return dayNumber(first) - dayNumber(second)
}

export function addDays(value: ISODate, amount: number): ISODate {
  if (!Number.isInteger(amount)) {
    throw new Error('Days added must be an integer.')
  }

  const date = toUTCDate(value)
  date.setUTCDate(date.getUTCDate() + amount)
  return formatUTCDate(date)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function addYearsClamped(
  value: ISODate,
  numberOfYears: number,
): ISODate {
  if (!Number.isInteger(numberOfYears)) {
    throw new Error('Years added must be an integer.')
  }

  const { year, month, day } = parseDateParts(value)
  const targetYear = year + numberOfYears
  const targetDay = Math.min(day, daysInMonth(targetYear, month))

  return [targetYear, padNumber(month), padNumber(targetDay)].join('-')
}

export function startOfWeek(
  value: ISODate,
  weekStartsOn: WeekStartsOn,
): ISODate {
  const weekday = toUTCDate(value).getUTCDay()
  const daysSinceStart = (weekday - weekStartsOn + 7) % 7
  return addDays(value, -daysSinceStart)
}

export function minDate(first: ISODate, second: ISODate): ISODate {
  return compareISODate(first, second) <= 0 ? first : second
}

export function clampNumber(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(Math.max(value, minimum), maximum)
}
