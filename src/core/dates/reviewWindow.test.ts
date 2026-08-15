import { describe, expect, it } from 'vitest'

import { getWeekDisplayState, reviewClosesOn } from './reviewWindow'

import type { LifeWeek } from './lifeCalendar'
import type { WeekEntry } from '../models'

const completedWeek: LifeWeek = {
  index: 10,
  weekNumber: 11,
  ageYear: 0,
  weekOfAgeYear: 11,
  startDate: '2026-07-13',
  endDateExclusive: '2026-07-20',
  state: 'elapsed',
  isPartialWeek: false,
}

const onTimeEntry: WeekEntry = {
  weekStart: '2026-07-13',
  whatHappened: 'A deliberate week.',
  rating: 4,
  nextCommitment: 'Finish the draft.',
  reviewKind: 'on-time',
  sealedAt: '2026-07-20T08:00:00.000Z',
  updatedAt: '2026-07-20T08:00:00.000Z',
}

describe('Monday review lifecycle', () => {
  it('opens the review only on the Monday after the week ends', () => {
    expect(getWeekDisplayState(completedWeek, '2026-07-20')).toBe(
      'awaiting-review',
    )
    expect(reviewClosesOn(completedWeek)).toBe('2026-07-21')
  })

  it('marks an unreviewed week as missed after Monday', () => {
    expect(getWeekDisplayState(completedWeek, '2026-07-21')).toBe('missed')
  })

  it('keeps an on-time sealed review recorded after the window', () => {
    expect(
      getWeekDisplayState(completedWeek, '2026-07-21', onTimeEntry),
    ).toBe('recorded')
  })

  it('keeps a late historical entry visually distinct', () => {
    expect(
      getWeekDisplayState(completedWeek, '2026-07-21', {
        ...onTimeEntry,
        reviewKind: 'retrospective',
      }),
    ).toBe('retrospective')
  })
})
