import { compareISODate } from './dates/localDate'

import type { LifeWeek } from './dates/lifeCalendar'
import type { LifeChapter } from './models'

export const MAX_LIFE_CHAPTERS = 64

export function chapterOverlapsWeek(
  chapter: LifeChapter,
  week: LifeWeek,
): boolean {
  return (
    compareISODate(chapter.startDate, week.endDateExclusive) < 0 &&
    compareISODate(chapter.endDate, week.startDate) >= 0
  )
}

export function chaptersForWeek(
  week: LifeWeek,
  chapters: LifeChapter[],
): LifeChapter[] {
  return chapters.filter((chapter) => chapterOverlapsWeek(chapter, week))
}

export function chapterDateSummary(chapter: LifeChapter): string {
  const prefix = chapter.confidence === 'approximate' ? 'About ' : ''

  if (chapter.kind === 'milestone' || chapter.startDate === chapter.endDate) {
    return `${prefix}${chapter.startDate}`
  }

  return `${prefix}${chapter.startDate} – ${chapter.endDate}`
}
