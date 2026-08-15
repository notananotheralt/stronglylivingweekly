import { useState } from 'react'

import { todayISO } from '../core/dates/localDate'
import { DEFAULT_APPEARANCE } from '../core/theme'

import type { FormEvent } from 'react'
import type { LifeSettings } from '../core/models'

interface SetupFormProps {
  initialSettings?: LifeSettings
  onSave: (settings: LifeSettings) => void
  onCancel?: () => void
}

export function SetupForm({
  initialSettings,
  onSave,
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
    })
  }

  return (
    <section className="setup-layout">
      <form className="setup-card" onSubmit={handleSubmit}>
        <div className="setup-card__heading">
          <span>80-year map</span>
          <h1>{initialSettings ? 'Birthdate' : 'Begin'}</h1>
        </div>

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
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button className="button button--primary" type="submit">
            {initialSettings ? 'Save' : 'Create map'}
          </button>
          {onCancel && (
            <button className="button" type="button" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
