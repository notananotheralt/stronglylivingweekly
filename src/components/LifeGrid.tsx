import { useEffect, useMemo, useRef, useState } from 'react'

import { addDays } from '../core/dates/localDate'
import { getWeekDisplayState } from '../core/dates/reviewWindow'
import {
  TARGET_AGE,
  TOTAL_LIFE_WEEKS,
  WEEKS_PER_YEAR,
} from '../core/models'

import type { CSSProperties, KeyboardEvent } from 'react'
import type { LifeWeek } from '../core/dates/lifeCalendar'
import type { PrivacyMode, WeekEntry } from '../core/models'

interface CellMetrics {
  width: number
  height: number
  gap: number
}

interface LifeGridProps {
  weeks: LifeWeek[]
  entries: Record<string, WeekEntry>
  today: string
  privacyMode: PrivacyMode
  selectedWeekStart: string
  interactive: boolean
  onSelectWeek: (week: LifeWeek) => void
}

function formatWeekRange(week: LifeWeek): string {
  return `${week.startDate} - ${addDays(week.endDateExclusive, -1)}`
}

export function LifeGrid({
  weeks,
  entries,
  today,
  privacyMode,
  selectedWeekStart,
  interactive,
  onSelectWeek,
}: LifeGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [cellMetrics, setCellMetrics] = useState<CellMetrics | null>(null)
  const slots = useMemo(() => {
    const nextSlots = new Array<LifeWeek | undefined>(TOTAL_LIFE_WEEKS)

    for (const week of weeks) {
      const slot =
        (week.weekOfAgeYear - 1) * TARGET_AGE + week.ageYear
      nextSlots[slot] = week
    }

    return nextSlots
  }, [weeks])

  useEffect(() => {
    const grid = gridRef.current

    if (!grid) {
      return
    }

    const updateCellMetrics = (): void => {
      const gap = 1
      const width = Math.max(
        1,
        Math.floor((grid.clientWidth - (TARGET_AGE - 1) * gap) / TARGET_AGE),
      )
      const height = Math.max(
        1,
        Math.floor(
          (grid.clientHeight - (WEEKS_PER_YEAR - 1) * gap) /
            WEEKS_PER_YEAR,
        ),
      )

      setCellMetrics((current) => {
        if (
          current?.width === width &&
          current.height === height &&
          current.gap === gap
        ) {
          return current
        }

        return { width, height, gap }
      })
    }

    updateCellMetrics()
    const resizeObserver = new ResizeObserver(updateCellMetrics)
    resizeObserver.observe(grid)

    return () => resizeObserver.disconnect()
  }, [])

  const mapStyle = cellMetrics
    ? ({
        '--life-cell-width': `${cellMetrics.width}px`,
        '--life-cell-height': `${cellMetrics.height}px`,
        '--life-cell-gap': `${cellMetrics.gap}px`,
      } as CSSProperties)
    : undefined

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    week: LifeWeek,
  ): void {
    const offsets: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }
    const offset = offsets[event.key]

    if (!offset) {
      return
    }

    event.preventDefault()
    const targetAge = week.ageYear + offset[0]
    const targetRow = week.weekOfAgeYear + offset[1]
    const target = weeks.find(
      (candidate) =>
        candidate.ageYear === targetAge &&
        candidate.weekOfAgeYear === targetRow,
    )

    if (!target) {
      return
    }

    onSelectWeek(target)
    gridRef.current
      ?.querySelector<HTMLButtonElement>(
        `[data-week-start="${target.startDate}"]`,
      )
      ?.focus()
  }

  return (
    <div
      className={`life-map${cellMetrics ? ' life-map--measured' : ''}`}
      style={mapStyle}
      aria-label="4,160-week life map"
    >
      <div className="life-map__corner" aria-hidden="true">Week</div>
      <div className="life-map__ages" aria-hidden="true">
        {Array.from({ length: TARGET_AGE }, (_, age) => (
          <span key={age}>{age % 10 === 0 ? age : ''}</span>
        ))}
      </div>

      <div className="life-map__week-labels" aria-hidden="true">
        {Array.from({ length: WEEKS_PER_YEAR }, (_, index) => {
          const week = index + 1
          return <span key={week}>{[1, 13, 26, 39, 52].includes(week) ? week : ''}</span>
        })}
      </div>

      <div className="life-map__grid" ref={gridRef} role="grid">
        {slots.map((week, slot) => {
          if (!week) {
            return <span className="life-cell life-cell--empty" key={`empty-${slot}`} />
          }

          const entry = entries[week.startDate]
          const displayState = getWeekDisplayState(week, today, entry)
          const isSelected = selectedWeekStart === week.startDate
          const ratingClass =
            privacyMode === 'personal' && entry
              ? `life-cell--rating-${entry.rating}`
              : ''
          const className = [
            'life-cell',
            `life-cell--${displayState}`,
            ratingClass,
            isSelected ? 'life-cell--selected' : '',
            week.isPartialWeek ? 'life-cell--partial' : '',
          ]
            .filter(Boolean)
            .join(' ')
          const privateDescription =
            privacyMode === 'personal' && entry
              ? ` Rating ${entry.rating} of 5. ${entry.reviewKind}.`
              : ''
          const label = `Column ${week.ageYear + 1}, week ${week.weekOfAgeYear}. ${formatWeekRange(week)}. ${displayState}.${privateDescription}`

          if (!interactive) {
            return (
              <span
                className={className}
                key={week.startDate}
                role="gridcell"
                aria-label={label}
              />
            )
          }

          return (
            <button
              className={className}
              data-week-start={week.startDate}
              key={week.startDate}
              type="button"
              role="gridcell"
              tabIndex={isSelected ? 0 : -1}
              title={label}
              aria-label={label}
              onClick={() => onSelectWeek(week)}
              onKeyDown={(event) => handleKeyDown(event, week)}
            />
          )
        })}
      </div>
    </div>
  )
}
