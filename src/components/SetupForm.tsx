import { useState } from 'react'

import { AppIcon } from './AppIcon'
import { todayISO } from '../core/dates/localDate'
import { DEFAULT_APPEARANCE } from '../core/theme'

import type { ChangeEvent, FormEvent } from 'react'
import type { LifeSettings } from '../core/models'

interface SetupFormProps {
  initialSettings?: LifeSettings
  dataStatus?: string
  onSave: (settings: LifeSettings) => void
  onImport?: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  onCancel?: () => void
}

export function SetupForm({
  initialSettings,
  dataStatus,
  onSave,
  onImport,
  onCancel,
}: SetupFormProps) {
  const [birthDate, setBirthDate] = useState(
    initialSettings?.birthDate ?? '',
  )
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    if (!birthDate) {
      setError('Enter your birthdate.')
      return
    }

    if (birthDate > todayISO()) {
      setError('Your birthdate cannot be in the future.')
      return
    }

    onSave({
      birthDate,
      weekStartsOn: 1,
      privacyMode: initialSettings?.privacyMode ?? 'privacy',
      quote: initialSettings?.quote ?? '',
      showDate: initialSettings?.showDate ?? true,
      showYearProgress: initialSettings?.showYearProgress ?? true,
      showWeekRemaining: initialSettings?.showWeekRemaining ?? true,
      appearance: initialSettings?.appearance ?? {
        themeId: DEFAULT_APPEARANCE.themeId,
        customColors: { ...DEFAULT_APPEARANCE.customColors },
      },
      lifeChapters: initialSettings?.lifeChapters ?? [],
    })
  }

  return (
    <section className="setup-layout">
      <div className="setup-card">
        <div className="setup-card__heading">
          <span>Strongly Living Weekly</span>
          <h1>{initialSettings ? 'Birthdate' : 'Begin with one date.'}</h1>
          {!initialSettings && (
            <p>
              One square for every week. A short review each Monday. Your
              reflections stay on this device.
            </p>
          )}
        </div>

        {!initialSettings && (
          <div className="setup-principles" aria-label="Product principles">
            <span><AppIcon name="grid" />4,160 weeks</span>
            <span><AppIcon name="calendar" />Monday reviews</span>
            <span><AppIcon name="shield" />Private by default</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Birthdate</span>
            <input
              required
              max={todayISO()}
              type="date"
              value={birthDate}
              onChange={(event) => {
                setBirthDate(event.target.value)
                setError('')
              }}
            />
            {!initialSettings && (
              <small>Used only to anchor your fixed 80 × 52 map.</small>
            )}
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="form-actions">
            <button className="button button--primary button--roomy" type="submit">
              {initialSettings ? 'Save' : 'Create my map'}
            </button>
            {onCancel && (
              <button className="button" type="button" onClick={onCancel}>
                Cancel
              </button>
            )}
          </div>
        </form>

        {!initialSettings && onImport && (
          <section className="setup-restore" aria-label="Restore an existing map">
            <div>
              <strong>Already have a map?</strong>
              <span>Restore a browser, Windows, or Linux JSON backup.</span>
            </div>
            <label className="button file-button">
              <AppIcon name="restore" />
              Choose backup
              <input
                type="file"
                accept="application/json,.json"
                onChange={onImport}
              />
            </label>
            {dataStatus && <p className="data-status" role="status">{dataStatus}</p>}
          </section>
        )}
      </div>
    </section>
  )
}
