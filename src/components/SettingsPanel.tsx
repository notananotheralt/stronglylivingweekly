import { useMemo, useState } from 'react'

import { todayISO } from '../core/dates/localDate'
import {
  isHexColor,
  THEME_COLOR_FIELDS,
  THEME_PRESETS,
  themeVariables,
} from '../core/theme'

import type { ChangeEvent, CSSProperties, FormEvent } from 'react'
import type {
  LifeSettings,
  PrivacyMode,
  ThemeColors,
  ThemeId,
} from '../core/models'

interface SettingsPanelProps {
  settings: LifeSettings
  dataStatus: string
  onSave: (settings: LifeSettings) => void
  onExport: () => void
  onImport: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  onClose: () => void
}

export function SettingsPanel({
  settings,
  dataStatus,
  onSave,
  onExport,
  onImport,
  onClose,
}: SettingsPanelProps) {
  const [draft, setDraft] = useState(settings)
  const [appearanceError, setAppearanceError] = useState('')

  const themeOptions = useMemo(
    () => [
      ...THEME_PRESETS,
      {
        id: 'custom' as const,
        name: 'Custom',
        description: 'Your own hex palette',
        colors: draft.appearance.customColors,
      },
    ],
    [draft.appearance.customColors],
  )

  function update<K extends keyof LifeSettings>(
    key: K,
    value: LifeSettings[K],
  ): void {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function updateTheme(themeId: ThemeId): void {
    setDraft((current) => ({
      ...current,
      appearance: { ...current.appearance, themeId },
    }))
    setAppearanceError('')
  }

  function updateCustomColor(key: keyof ThemeColors, value: string): void {
    setDraft((current) => ({
      ...current,
      appearance: {
        ...current.appearance,
        customColors: {
          ...current.appearance.customColors,
          [key]: value,
        },
      },
    }))
    setAppearanceError('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    if (
      draft.appearance.themeId === 'custom' &&
      Object.values(draft.appearance.customColors).some(
        (color) => !isHexColor(color),
      )
    ) {
      setAppearanceError('Use six-digit hex colors, such as #8fa8a0.')
      return
    }

    onSave(draft)
  }

  return (
    <aside className="settings-sheet" aria-labelledby="settings-title">
      <header className="settings-sheet__header">
        <div>
          <span>Settings</span>
          <h2 id="settings-title">Appearance & data</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={onClose}
          aria-label="Close settings"
        >
          X
        </button>
      </header>

      <form className="settings-form" onSubmit={handleSubmit}>
        <fieldset className="settings-group">
          <legend>Theme</legend>
          <div className="theme-options">
            {themeOptions.map((theme) => {
              const appearance = {
                themeId: theme.id,
                customColors: theme.colors,
              }

              return (
                <button
                  className={`theme-option${draft.appearance.themeId === theme.id ? ' is-active' : ''}`}
                  key={theme.id}
                  type="button"
                  aria-pressed={draft.appearance.themeId === theme.id}
                  style={themeVariables(appearance) as CSSProperties}
                  onClick={() => updateTheme(theme.id)}
                >
                  <span className="theme-option__preview" aria-hidden="true">
                    {Array.from({ length: 24 }, (_, index) => (
                      <i
                        className={
                          index < 9
                            ? 'is-elapsed'
                            : index === 9
                              ? 'is-current'
                              : index < 13
                                ? 'is-recorded'
                                : 'is-future'
                        }
                        key={index}
                      />
                    ))}
                  </span>
                  <span className="theme-option__copy">
                    <strong>{theme.name}</strong>
                    <small>{theme.description}</small>
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>

        {draft.appearance.themeId === 'custom' && (
          <fieldset className="settings-group custom-colors">
            <legend>Custom palette</legend>
            <div className="color-fields">
              {THEME_COLOR_FIELDS.map(({ key, label }) => {
                const color = draft.appearance.customColors[key]
                const validColor = isHexColor(color)

                return (
                  <label className="color-field" key={key}>
                    <span>{label}</span>
                    <span className="color-field__controls">
                      <input
                        type="color"
                        value={validColor ? color : '#000000'}
                        aria-label={`${label} color picker`}
                        onChange={(event) =>
                          updateCustomColor(key, event.target.value)
                        }
                      />
                      <input
                        type="text"
                        value={color}
                        maxLength={7}
                        spellCheck={false}
                        aria-invalid={!validColor}
                        aria-label={`${label} hex color`}
                        onChange={(event) =>
                          updateCustomColor(key, event.target.value)
                        }
                      />
                    </span>
                  </label>
                )
              })}
            </div>
            {appearanceError && (
              <p className="form-error" role="alert">{appearanceError}</p>
            )}
          </fieldset>
        )}

        <fieldset className="settings-group">
          <legend>Privacy</legend>
          <div className="segmented-control">
            {(['privacy', 'personal'] as PrivacyMode[]).map((mode) => (
              <button
                className={draft.privacyMode === mode ? 'is-active' : ''}
                key={mode}
                type="button"
                aria-pressed={draft.privacyMode === mode}
                onClick={() => update('privacyMode', mode)}
              >
                {mode === 'privacy' ? 'Privacy' : 'Personal'}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="form-field">
          <span>Birthdate</span>
          <input
            max={todayISO()}
            type="date"
            value={draft.birthDate}
            onChange={(event) => update('birthDate', event.target.value)}
          />
          <small>4,160 weeks: 80 columns by 52.</small>
        </label>

        <label className="form-field">
          <span>Quote fallback</span>
          <textarea
            rows={3}
            value={draft.quote}
            onChange={(event) => update('quote', event.target.value)}
            placeholder="Shown when a commitment is hidden or unavailable."
          />
        </label>

        <fieldset className="settings-group">
          <legend>Metric strip</legend>
          <label className="check-field">
            <input
              type="checkbox"
              checked={draft.showDate}
              onChange={(event) => update('showDate', event.target.checked)}
            />
            Date
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={draft.showYearProgress}
              onChange={(event) => update('showYearProgress', event.target.checked)}
            />
            Year progress
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={draft.showWeekRemaining}
              onChange={(event) => update('showWeekRemaining', event.target.checked)}
            />
            Days left in week
          </label>
        </fieldset>

        <div className="form-actions settings-form__save">
          <button className="button button--primary" type="submit">
            Save settings
          </button>
        </div>
      </form>

      <section className="data-actions">
        <div>
          <strong>Backup</strong>
          <span>Reviews, notes, and settings</span>
        </div>
        <button className="button" type="button" onClick={onExport}>
          Export JSON
        </button>
        <label className="button file-button">
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            onChange={onImport}
          />
        </label>
        {dataStatus && <p className="data-status" role="status">{dataStatus}</p>}
      </section>
    </aside>
  )
}
