import { chapterDateSummary, MAX_LIFE_CHAPTERS } from '../core/timeline'
import { todayISO } from '../core/dates/localDate'

import type {
  DateConfidence,
  LifeChapter,
  LifeChapterKind,
} from '../core/models'

interface TimelineEditorProps {
  chapters: LifeChapter[]
  onChange: (chapters: LifeChapter[]) => void
}

const CHAPTER_COLORS = [
  '#d49a6a',
  '#e1b45f',
  '#83aa9b',
  '#6f9fc2',
  '#7e79b9',
  '#d57a72',
  '#b57ba6',
  '#cb8a58',
]

function nextChapterId(): string {
  return `chapter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createChapter(index: number): LifeChapter {
  const today = todayISO()

  return {
    id: nextChapterId(),
    title: 'New life chapter',
    startDate: today,
    endDate: today,
    color: CHAPTER_COLORS[index % CHAPTER_COLORS.length],
    kind: 'chapter',
    confidence: 'approximate',
    note: '',
  }
}

export function TimelineEditor({
  chapters,
  onChange,
}: TimelineEditorProps) {
  function updateChapter(
    id: string,
    update: Partial<LifeChapter>,
  ): void {
    onChange(
      chapters.map((chapter) => {
        if (chapter.id !== id) {
          return chapter
        }

        const next = { ...chapter, ...update }

        if (next.kind === 'milestone') {
          next.endDate = next.startDate
        }

        return next
      }),
    )
  }

  function changeKind(chapter: LifeChapter, kind: LifeChapterKind): void {
    updateChapter(chapter.id, {
      kind,
      endDate: kind === 'milestone' ? chapter.startDate : chapter.endDate,
    })
  }

  function removeChapter(id: string): void {
    onChange(chapters.filter((chapter) => chapter.id !== id))
  }

  return (
    <fieldset className="settings-group timeline-settings">
      <legend>Life chapters</legend>
      <p className="settings-help">
        Color meaningful eras and one-day milestones on the map. Approximate
        dates stay visibly marked as estimates and can be corrected later.
      </p>

      <div className="timeline-list">
        {chapters.map((chapter) => (
          <details className="timeline-card" key={chapter.id}>
            <summary>
              <i
                className="timeline-swatch"
                style={{ backgroundColor: chapter.color }}
                aria-hidden="true"
              />
              <span>
                <strong>{chapter.title || 'Untitled chapter'}</strong>
                <small>{chapterDateSummary(chapter)}</small>
              </span>
            </summary>

            <div className="timeline-card__fields">
              <label className="form-field timeline-card__title">
                <span>Name</span>
                <input
                  required
                  maxLength={100}
                  value={chapter.title}
                  onChange={(event) =>
                    updateChapter(chapter.id, { title: event.target.value })
                  }
                />
              </label>

              <fieldset className="settings-group timeline-kind">
                <legend>Type</legend>
                <div className="segmented-control">
                  {(['chapter', 'milestone'] as LifeChapterKind[]).map(
                    (kind) => (
                      <button
                        className={chapter.kind === kind ? 'is-active' : ''}
                        key={kind}
                        type="button"
                        aria-pressed={chapter.kind === kind}
                        onClick={() => changeKind(chapter, kind)}
                      >
                        {kind === 'chapter' ? 'Date range' : 'Milestone'}
                      </button>
                    ),
                  )}
                </div>
              </fieldset>

              <label className="form-field">
                <span>{chapter.kind === 'milestone' ? 'Date' : 'Start'}</span>
                <input
                  required
                  type="date"
                  value={chapter.startDate}
                  onChange={(event) =>
                    updateChapter(chapter.id, {
                      startDate: event.target.value,
                      ...(chapter.kind === 'milestone'
                        ? { endDate: event.target.value }
                        : {}),
                    })
                  }
                />
              </label>

              {chapter.kind === 'chapter' && (
                <label className="form-field">
                  <span>End</span>
                  <input
                    required
                    min={chapter.startDate}
                    type="date"
                    value={chapter.endDate}
                    onChange={(event) =>
                      updateChapter(chapter.id, { endDate: event.target.value })
                    }
                  />
                </label>
              )}

              <label className="form-field">
                <span>Date confidence</span>
                <select
                  value={chapter.confidence}
                  onChange={(event) =>
                    updateChapter(chapter.id, {
                      confidence: event.target.value as DateConfidence,
                    })
                  }
                >
                  <option value="exact">Exact</option>
                  <option value="approximate">Approximate</option>
                </select>
              </label>

              <label className="form-field timeline-color-field">
                <span>Color</span>
                <span>
                  <input
                    type="color"
                    value={chapter.color}
                    aria-label={`${chapter.title} color`}
                    onChange={(event) =>
                      updateChapter(chapter.id, { color: event.target.value })
                    }
                  />
                  <input
                    required
                    maxLength={7}
                    pattern="#[0-9a-fA-F]{6}"
                    value={chapter.color}
                    aria-label={`${chapter.title} hex color`}
                    onChange={(event) =>
                      updateChapter(chapter.id, { color: event.target.value })
                    }
                  />
                </span>
              </label>

              <label className="form-field timeline-card__note">
                <span>Optional context</span>
                <textarea
                  rows={2}
                  maxLength={1_000}
                  value={chapter.note}
                  onChange={(event) =>
                    updateChapter(chapter.id, { note: event.target.value })
                  }
                />
              </label>

              <button
                className="button button--danger timeline-card__remove"
                type="button"
                onClick={() => removeChapter(chapter.id)}
              >
                Remove chapter
              </button>
            </div>
          </details>
        ))}
      </div>

      <button
        className="button timeline-add"
        type="button"
        disabled={chapters.length >= MAX_LIFE_CHAPTERS}
        onClick={() => onChange([...chapters, createChapter(chapters.length)])}
      >
        Add chapter or milestone
      </button>
    </fieldset>
  )
}
