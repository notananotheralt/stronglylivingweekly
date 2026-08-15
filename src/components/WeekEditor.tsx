import { useState } from 'react'

import { addDays } from '../core/dates/localDate'
import { getWeekDisplayState } from '../core/dates/reviewWindow'

import type { FormEvent } from 'react'
import type { LifeWeek } from '../core/dates/lifeCalendar'
import type {
  DailyNote,
  PrivacyMode,
  WeekEntry,
} from '../core/models'

export interface PreviousYearItem {
  year: number
  entry: WeekEntry
}

interface WeekEditorProps {
  week: LifeWeek
  entry?: WeekEntry
  today: string
  privacyMode: PrivacyMode
  previousCommitment: string
  dailyNotes: DailyNote[]
  previousYears: PreviousYearItem[]
  onSave: (entry: WeekEntry) => void
  onSaveDailyNote: (note: DailyNote) => void
  onRequestPersonal: () => void
  onClose: () => void
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function Rating({
  value,
  onChange,
}: {
  value: number | null
  onChange: (value: 1 | 2 | 3 | 4 | 5) => void
}) {
  return (
    <fieldset className="rating-field">
      <legend>How was the week?</legend>
      <div>
        {([1, 2, 3, 4, 5] as const).map((rating) => (
          <button
            className={value === rating ? 'rating-button is-active' : 'rating-button'}
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            aria-pressed={value === rating}
          >
            {rating}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function WeekEditor({
  week,
  entry,
  today,
  privacyMode,
  previousCommitment,
  dailyNotes,
  previousYears,
  onSave,
  onSaveDailyNote,
  onRequestPersonal,
  onClose,
}: WeekEditorProps) {
  const state = getWeekDisplayState(week, today, entry)
  const isReview = state === 'awaiting-review'
  const isRetrospective = state === 'missed' && !entry
  const [whatHappened, setWhatHappened] = useState(
    entry?.whatHappened ?? '',
  )
  const [rating, setRating] = useState<number | null>(entry?.rating ?? null)
  const [nextCommitment, setNextCommitment] = useState(
    entry?.nextCommitment ?? '',
  )
  const existingTodayNote = dailyNotes.find((note) => note.date === today)
  const [dailyDraft, setDailyDraft] = useState(existingTodayNote?.text ?? '')
  const [status, setStatus] = useState('')

  function handleReviewSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    if (!whatHappened.trim() || rating === null) {
      setStatus('Complete the reflection and choose a rating.')
      return
    }

    if (isReview && !nextCommitment.trim()) {
      setStatus('Choose one commitment for this week.')
      return
    }

    const timestamp = new Date().toISOString()

    onSave({
      weekStart: week.startDate,
      whatHappened: whatHappened.trim(),
      rating: rating as 1 | 2 | 3 | 4 | 5,
      nextCommitment: isReview ? nextCommitment.trim() : '',
      reviewKind: isReview ? 'on-time' : 'retrospective',
      sealedAt: timestamp,
      updatedAt: timestamp,
    })
    setStatus(isReview ? 'Week sealed.' : 'Retrospective saved.')
  }

  function handleDailyNoteSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    if (!dailyDraft.trim()) {
      setStatus('Write a note before saving.')
      return
    }

    onSaveDailyNote({
      date: today,
      text: dailyDraft.trim(),
      capturedAt: new Date().toISOString(),
      retrospective: false,
    })
    setStatus('Daily note saved.')
  }

  const privateGate = privacyMode === 'privacy' && (
    entry || isReview || isRetrospective || state === 'current'
  )

  return (
    <aside className="week-sheet" aria-labelledby="week-sheet-title">
      <header className="week-sheet__header">
        <div>
          <span className="week-sheet__state">{state.replace('-', ' ')}</span>
          <h2 id="week-sheet-title">{formatDate(week.startDate)}</h2>
          <p>
            {formatDate(week.startDate)} -{' '}
            {formatDate(addDays(week.endDateExclusive, -1))}
          </p>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close week">
          X
        </button>
      </header>

      {privateGate ? (
        <section className="privacy-gate">
          <span>Privacy mode</span>
          <p>Personal text is hidden until Personal mode is active.</p>
          <button className="button button--primary" type="button" onClick={onRequestPersonal}>
            Use Personal mode
          </button>
        </section>
      ) : (
        <>
          {entry && (
            <section className="sealed-review">
              {entry.reviewKind === 'retrospective' && (
                <span className="entry-kind">Added retrospectively</span>
              )}
              <div className="sealed-review__rating" aria-label={`Rating ${entry.rating} out of 5`}>
                <strong>{entry.rating}</strong>
                <span>/ 5</span>
              </div>
              <h3>What happened</h3>
              <p className="long-text">{entry.whatHappened}</p>
              {entry.nextCommitment && (
                <>
                  <h3>Commitment for the following week</h3>
                  <p className="commitment-text">{entry.nextCommitment}</p>
                </>
              )}
            </section>
          )}

          {!entry && (isReview || isRetrospective) && (
            <form className="review-form" onSubmit={handleReviewSubmit}>
              {isReview && previousCommitment && (
                <div className="previous-commitment">
                  <span>Last week's commitment</span>
                  <p>{previousCommitment}</p>
                </div>
              )}

              {isReview && !previousCommitment && (
                <p className="sheet-note">Review today. Sealing closes at midnight.</p>
              )}

              {isRetrospective && (
                <p className="sheet-note">
                  This week was missed. A historical note will remain distinct from an on-time review.
                </p>
              )}

              <label className="form-field">
                <span>What happened?</span>
                <textarea
                  required
                  rows={7}
                  value={whatHappened}
                  onChange={(event) => {
                    setWhatHappened(event.target.value)
                    setStatus('')
                  }}
                />
              </label>

              <Rating
                value={rating}
                onChange={(value) => {
                  setRating(value)
                  setStatus('')
                }}
              />

              {isReview && (
                <label className="form-field">
                  <span>One commitment for next week</span>
                  <textarea
                    required
                    rows={3}
                    value={nextCommitment}
                    onChange={(event) => {
                      setNextCommitment(event.target.value)
                      setStatus('')
                    }}
                  />
                </label>
              )}

              <div className="form-actions">
                <button className="button button--primary" type="submit">
                  {isReview ? 'Seal week' : 'Save retrospective'}
                </button>
                {status && <span className="form-status" role="status">{status}</span>}
              </div>
            </form>
          )}

          {!entry && state === 'current' && (
            <section className="current-week-panel">
              <p className="sheet-note">The weekly review opens next Monday.</p>
              {previousCommitment && (
                <div className="previous-commitment">
                  <span>This week's commitment</span>
                  <p>{previousCommitment}</p>
                </div>
              )}

              <form className="daily-note-form" onSubmit={handleDailyNoteSubmit}>
                <label className="form-field">
                  <span>Today's note</span>
                  <textarea
                    rows={4}
                    value={dailyDraft}
                    onChange={(event) => {
                      setDailyDraft(event.target.value)
                      setStatus('')
                    }}
                  />
                </label>
                <div className="form-actions">
                  <button className="button" type="submit">Save daily note</button>
                  {status && <span className="form-status" role="status">{status}</span>}
                </div>
              </form>
            </section>
          )}

          {!entry && state === 'future' && (
            <p className="sheet-note">This week has not begun.</p>
          )}

          {dailyNotes.length > 0 && (
            <details className="daily-notes" open={isReview}>
              <summary>Daily notes ({dailyNotes.length})</summary>
              <div>
                {dailyNotes.map((note) => (
                  <article key={note.date}>
                    <span>{formatDate(note.date)}</span>
                    <p>{note.text}</p>
                  </article>
                ))}
              </div>
            </details>
          )}

          {previousYears.length > 0 && (
            <details className="previous-years">
              <summary>This week in previous years</summary>
              <div>
                {previousYears.map(({ year, entry: previousEntry }) => (
                  <article key={previousEntry.weekStart}>
                    <div>
                      <strong>{year}</strong>
                      <span>{previousEntry.rating} / 5</span>
                    </div>
                    <p>{previousEntry.whatHappened}</p>
                  </article>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </aside>
  )
}
