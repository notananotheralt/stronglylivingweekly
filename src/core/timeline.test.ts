import { describe, expect, it } from 'vitest'

import { chapterDateSummary, chaptersForWeek } from './timeline'

import type { LifeWeek } from './dates/lifeCalendar'
import type { LifeChapter } from './models'

const week: LifeWeek = {
  index: 0,
  weekNumber: 1,
  ageYear: 0,
  weekOfAgeYear: 1,
  startDate: '2026-08-10',
  endDateExclusive: '2026-08-17',
  state: 'elapsed',
  isPartialWeek: false,
}

function chapter(overrides: Partial<LifeChapter> = {}): LifeChapter {
  return {
    id: 'chapter-1',
    title: 'A chapter',
    startDate: '2026-08-10',
    endDate: '2026-08-16',
    color: '#789abc',
    kind: 'chapter',
    confidence: 'exact',
    note: '',
    ...overrides,
  }
}

describe('life chapters', () => {
  it('finds ranges and one-day milestones that overlap a week', () => {
    const matches = chaptersForWeek(week, [
      chapter(),
      chapter({
        id: 'milestone',
        startDate: '2026-08-15',
        endDate: '2026-08-15',
        kind: 'milestone',
      }),
      chapter({
        id: 'later',
        startDate: '2026-08-17',
        endDate: '2026-09-01',
      }),
    ])

    expect(matches.map(({ id }) => id)).toEqual(['chapter-1', 'milestone'])
  })

  it('labels approximate dates without presenting false precision', () => {
    expect(
      chapterDateSummary(
        chapter({ confidence: 'approximate', kind: 'milestone' }),
      ),
    ).toBe('About 2026-08-10')
  })
})
