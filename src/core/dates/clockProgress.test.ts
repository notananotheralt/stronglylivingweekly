import { describe, expect, it } from 'vitest'

import { calculateClockProgress } from './clockProgress'

describe('clock progress', () => {
  it('calculates Monday-based week progress and time remaining', () => {
    const now = new Date(2026, 6, 15, 12, 0, 0)
    const progress = calculateClockProgress(now, 1)

    expect(progress.weekProgress).toBeCloseTo(2.5 / 7, 5)
    expect(progress.hoursRemainingInWeek).toBe(108)
    expect(progress.daysRemainingInWeek).toBe(5)
  })

  it('calculates year progress within the current year', () => {
    const progress = calculateClockProgress(
      new Date(2026, 6, 1, 0, 0, 0),
      1,
    )

    expect(progress.yearProgress).toBeGreaterThan(0.49)
    expect(progress.yearProgress).toBeLessThan(0.51)
  })
})
