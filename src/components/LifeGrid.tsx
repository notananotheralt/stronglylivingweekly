import { useEffect, useMemo, useRef, useState } from 'react'

import { addDays } from '../core/dates/localDate'
import { getWeekDisplayState } from '../core/dates/reviewWindow'
import {
  TARGET_AGE,
  TOTAL_LIFE_WEEKS,
  WEEKS_PER_YEAR,
} from '../core/models'
import { chaptersForWeek } from '../core/timeline'

import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
} from 'react'
import type { LifeWeek } from '../core/dates/lifeCalendar'
import type {
  PrivacyMode,
  LifeChapter,
  ThemeColors,
  WeekEntry,
} from '../core/models'

interface CanvasMetrics {
  cssWidth: number
  cssHeight: number
  pixelRatio: number
  cellWidth: number
  cellHeight: number
  gap: number
  offsetX: number
  offsetY: number
}

interface LifeGridProps {
  weeks: LifeWeek[]
  entries: Record<string, WeekEntry>
  today: string
  privacyMode: PrivacyMode
  colors: ThemeColors
  chapters: LifeChapter[]
  selectedWeekStart: string
  onSelectWeek: (week: LifeWeek) => void
}

function formatWeekRange(week: LifeWeek): string {
  return `${week.startDate} - ${addDays(week.endDateExclusive, -1)}`
}

function describeWeek(
  week: LifeWeek,
  entries: Record<string, WeekEntry>,
  today: string,
  privacyMode: PrivacyMode,
  chapters: LifeChapter[],
): string {
  const entry = entries[week.startDate]
  const displayState = getWeekDisplayState(week, today, entry)
  const privateDescription =
    privacyMode === 'personal' && entry
      ? ` Rating ${entry.rating} of 5. ${entry.reviewKind}.`
      : ''
  const chapterDescription =
    privacyMode === 'personal'
      ? chaptersForWeek(week, chapters)
          .map((chapter) => chapter.title)
          .join(', ')
      : ''

  return `Age ${week.ageYear}, week ${week.weekOfAgeYear}. ${formatWeekRange(week)}. ${displayState}.${privateDescription}${chapterDescription ? ` Life chapters: ${chapterDescription}.` : ''}`
}

function parseHex(value: string): [number, number, number] {
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ]
}

function mixHex(first: string, second: string, amount: number): string {
  const firstRgb = parseHex(first)
  const secondRgb = parseHex(second)
  const mixed = firstRgb.map((channel, index) =>
    Math.round(channel + (secondRgb[index] - channel) * amount),
  )

  return `rgb(${mixed.join(', ')})`
}

function calculateMetrics(width: number, height: number): CanvasMetrics {
  const gap = 1
  const cellWidth = Math.max(
    1,
    Math.floor((width - (TARGET_AGE - 1) * gap) / TARGET_AGE),
  )
  const cellHeight = Math.max(
    1,
    Math.floor((height - (WEEKS_PER_YEAR - 1) * gap) / WEEKS_PER_YEAR),
  )
  const usedWidth = cellWidth * TARGET_AGE + gap * (TARGET_AGE - 1)
  const usedHeight = cellHeight * WEEKS_PER_YEAR + gap * (WEEKS_PER_YEAR - 1)

  return {
    cssWidth: width,
    cssHeight: height,
    pixelRatio: Math.max(1, window.devicePixelRatio || 1),
    cellWidth,
    cellHeight,
    gap,
    offsetX: Math.floor((width - usedWidth) / 2),
    offsetY: Math.floor((height - usedHeight) / 2),
  }
}

export function LifeGrid({
  weeks,
  entries,
  today,
  privacyMode,
  colors,
  chapters,
  selectedWeekStart,
  onSelectWeek,
}: LifeGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [metrics, setMetrics] = useState<CanvasMetrics | null>(null)
  const [navigatedWeekStart, setNavigatedWeekStart] = useState('')
  const [hoveredWeekStart, setHoveredWeekStart] = useState('')
  const slots = useMemo(() => {
    const nextSlots = new Array<LifeWeek | undefined>(TOTAL_LIFE_WEEKS)

    for (const week of weeks) {
      const slot =
        (week.weekOfAgeYear - 1) * TARGET_AGE + week.ageYear
      nextSlots[slot] = week
    }

    return nextSlots
  }, [weeks])

  const activeWeekStart = navigatedWeekStart || selectedWeekStart
  const activeWeek =
    weeks.find((week) => week.startDate === activeWeekStart) ?? weeks[0]
  const activeDescription = activeWeek
    ? describeWeek(activeWeek, entries, today, privacyMode, chapters)
    : '4,160-week life map'

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const resize = (): void => {
      const width = Math.max(1, Math.floor(canvas.clientWidth))
      const height = Math.max(1, Math.floor(canvas.clientHeight))
      const nextMetrics = calculateMetrics(width, height)
      canvas.width = Math.round(width * nextMetrics.pixelRatio)
      canvas.height = Math.round(height * nextMetrics.pixelRatio)
      setMetrics(nextMetrics)
    }

    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas || !metrics) {
      return
    }

    const context = canvas.getContext('2d')

    if (!context) {
      return
    }

    context.setTransform(
      metrics.pixelRatio,
      0,
      0,
      metrics.pixelRatio,
      0,
      0,
    )
    context.clearRect(0, 0, metrics.cssWidth, metrics.cssHeight)
    context.imageSmoothingEnabled = false

    for (const week of weeks) {
      const entry = entries[week.startDate]
      const displayState = getWeekDisplayState(week, today, entry)
      const x =
        metrics.offsetX +
        week.ageYear * (metrics.cellWidth + metrics.gap)
      const y =
        metrics.offsetY +
        (week.weekOfAgeYear - 1) * (metrics.cellHeight + metrics.gap)
      let fill = colors.elapsed
      let alpha = 0.58

      if (displayState === 'future') {
        fill = colors.future
        alpha = 0.32
      } else if (displayState === 'recorded') {
        fill = colors.recorded
        alpha = 0.82
      } else if (displayState === 'awaiting-review') {
        fill = colors.accent
        alpha = 0.94
      } else if (displayState === 'retrospective') {
        fill = mixHex(colors.elapsed, colors.recorded, 0.45)
        alpha = 0.72
      } else if (displayState === 'current') {
        fill = colors.current
        alpha = 1
      }

      if (privacyMode === 'personal' && entry) {
        fill = mixHex(
          colors.elapsed,
          colors.recorded,
          0.25 + entry.rating * 0.14,
        )
      }

      context.globalAlpha = alpha
      context.fillStyle = fill
      context.fillRect(x, y, metrics.cellWidth, metrics.cellHeight)

      const weekChapters = chaptersForWeek(week, chapters)
      const rangeChapters = weekChapters.filter(
        (chapter) => chapter.kind === 'chapter',
      )

      if (rangeChapters.length > 0) {
        const bandWidth = metrics.cellWidth / rangeChapters.length

        for (const [index, chapter] of rangeChapters.entries()) {
          context.globalAlpha = displayState === 'future' ? 0.24 : 0.56
          context.fillStyle = chapter.color
          context.fillRect(
            x + index * bandWidth,
            y,
            Math.ceil(bandWidth),
            metrics.cellHeight,
          )
        }
      }

      for (const milestone of weekChapters.filter(
        (chapter) => chapter.kind === 'milestone',
      )) {
        const centerX = x + metrics.cellWidth / 2
        const centerY = y + metrics.cellHeight / 2
        const radius = Math.max(
          1.5,
          Math.min(metrics.cellWidth, metrics.cellHeight) * 0.32,
        )

        context.globalAlpha = 1
        context.fillStyle = milestone.color
        context.beginPath()
        context.moveTo(centerX, centerY - radius)
        context.lineTo(centerX + radius, centerY)
        context.lineTo(centerX, centerY + radius)
        context.lineTo(centerX - radius, centerY)
        context.closePath()
        context.fill()
      }

      if (displayState === 'recorded') {
        const markerSize = Math.max(
          1.5,
          Math.min(metrics.cellWidth, metrics.cellHeight) * 0.3,
        )

        context.globalAlpha = 1
        context.fillStyle = colors.recorded
        context.fillRect(
          x + metrics.cellWidth - markerSize,
          y,
          markerSize,
          markerSize,
        )
      }

      if (displayState === 'retrospective') {
        context.globalAlpha = 0.9
        context.strokeStyle = colors.accent
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(x, y + metrics.cellHeight)
        context.lineTo(x + metrics.cellWidth, y)
        context.stroke()
      }

      if (
        displayState === 'current' ||
        week.startDate === activeWeekStart ||
        week.startDate === hoveredWeekStart
      ) {
        context.globalAlpha = 1
        context.strokeStyle =
          week.startDate === activeWeekStart ? colors.text : colors.current
        context.lineWidth = 1
        context.strokeRect(
          x - 0.5,
          y - 0.5,
          metrics.cellWidth + 1,
          metrics.cellHeight + 1,
        )
      }
    }

    context.globalAlpha = 1
  }, [
    activeWeekStart,
    chapters,
    colors,
    entries,
    hoveredWeekStart,
    metrics,
    privacyMode,
    today,
    weeks,
  ])

  function weekAtPoint(clientX: number, clientY: number): LifeWeek | undefined {
    const canvas = canvasRef.current

    if (!canvas || !metrics) {
      return undefined
    }

    const bounds = canvas.getBoundingClientRect()
    const x = clientX - bounds.left - metrics.offsetX
    const y = clientY - bounds.top - metrics.offsetY

    if (x < 0 || y < 0) {
      return undefined
    }

    const column = Math.floor(x / (metrics.cellWidth + metrics.gap))
    const row = Math.floor(y / (metrics.cellHeight + metrics.gap))
    const insideCellX = x % (metrics.cellWidth + metrics.gap)
    const insideCellY = y % (metrics.cellHeight + metrics.gap)

    if (
      column < 0 ||
      column >= TARGET_AGE ||
      row < 0 ||
      row >= WEEKS_PER_YEAR ||
      insideCellX >= metrics.cellWidth ||
      insideCellY >= metrics.cellHeight
    ) {
      return undefined
    }

    return slots[row * TARGET_AGE + column]
  }

  function handleClick(event: MouseEvent<HTMLDivElement>): void {
    const week = weekAtPoint(event.clientX, event.clientY)

    if (!week) {
      return
    }

    setNavigatedWeekStart(week.startDate)
    onSelectWeek(week)
  }

  function handlePointerMove(event: MouseEvent<HTMLDivElement>): void {
    const nextStart = weekAtPoint(event.clientX, event.clientY)?.startDate ?? ''

    if (nextStart !== hoveredWeekStart) {
      setHoveredWeekStart(nextStart)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (!activeWeek) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelectWeek(activeWeek)
      return
    }

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
    const column = activeWeek.ageYear + offset[0]
    const row = activeWeek.weekOfAgeYear - 1 + offset[1]

    if (
      column < 0 ||
      column >= TARGET_AGE ||
      row < 0 ||
      row >= WEEKS_PER_YEAR
    ) {
      return
    }

    const target = slots[row * TARGET_AGE + column]

    if (target) {
      setNavigatedWeekStart(target.startDate)
    }
  }

  const mapStyle = metrics
    ? ({
        '--life-cell-width': `${metrics.cellWidth}px`,
        '--life-cell-height': `${metrics.cellHeight}px`,
        '--life-cell-gap': `${metrics.gap}px`,
      } as CSSProperties)
    : undefined

  const hoveredWeek = weeks.find(
    (week) => week.startDate === hoveredWeekStart,
  )

  return (
    <div
      className={`life-map${metrics ? ' life-map--measured' : ''}`}
      style={mapStyle}
    >
      <div className="life-map__corner" aria-hidden="true">
        Week
      </div>
      <div className="life-map__ages" aria-hidden="true">
        {Array.from({ length: TARGET_AGE }, (_, age) => (
          <span key={age}>{age % 10 === 0 ? age : ''}</span>
        ))}
      </div>

      <div className="life-map__week-labels" aria-hidden="true">
        {Array.from({ length: WEEKS_PER_YEAR }, (_, index) => {
          const week = index + 1
          return (
            <span key={week}>
              {[1, 13, 26, 39, 52].includes(week) ? week : ''}
            </span>
          )
        })}
      </div>

      <div className="life-map__canvas-wrap">
        <canvas className="life-map__canvas" ref={canvasRef} aria-hidden="true" />
        <div
          className="life-map__interaction"
          role="grid"
          aria-label="4,160-week life map"
          aria-colcount={TARGET_AGE}
          aria-rowcount={WEEKS_PER_YEAR}
          aria-activedescendant={activeWeek ? 'active-life-week' : undefined}
          tabIndex={0}
          title={hoveredWeek
            ? describeWeek(
                hoveredWeek,
                entries,
                today,
                privacyMode,
                chapters,
              )
            : activeDescription}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onMouseLeave={() => setHoveredWeekStart('')}
          onMouseMove={handlePointerMove}
        >
          {activeWeek && (
            <span
              className="visually-hidden"
              id="active-life-week"
              role="gridcell"
              aria-colindex={activeWeek.ageYear + 1}
              aria-rowindex={activeWeek.weekOfAgeYear}
            >
              {activeDescription}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
