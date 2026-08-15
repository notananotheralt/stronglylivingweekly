import { useEffect, useMemo, useState } from 'react'

import './App.css'

import { LifeGrid } from './components/LifeGrid'
import { SettingsPanel } from './components/SettingsPanel'
import { SetupForm } from './components/SetupForm'
import { WeekEditor } from './components/WeekEditor'
import { calculateClockProgress } from './core/dates/clockProgress'
import { createDesktopSummary } from './core/desktopSummary'
import {
  calculateLifeStats,
  generateLifeWeeks,
} from './core/dates/lifeCalendar'
import {
  addYearsClamped,
  todayISO,
} from './core/dates/localDate'
import { themeVariables } from './core/theme'
import { getDesktopBridge, isTauriRuntime } from './platform'
import {
  getWeekDisplayState,
  isDateInsideWeek,
} from './core/dates/reviewWindow'
import {
  createBackup,
  loadDailyNotes,
  loadEntries,
  loadSettings,
  parseBackup,
  restoreBackup,
  saveDailyNote,
  saveEntry,
  saveSettings,
} from './storage/localStorageRepository'

import type { ChangeEvent, CSSProperties } from 'react'
import type { LifeWeek } from './core/dates/lifeCalendar'
import type {
  DailyNote,
  LifeSettings,
  WeekEntry,
} from './core/models'

function formatPercentage(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatShortDate(now: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(now)
}

function App() {
  const [settings, setSettingsState] = useState<LifeSettings | null>(
    loadSettings,
  )
  const [entries, setEntries] = useState<Record<string, WeekEntry>>(
    loadEntries,
  )
  const [dailyNotes, setDailyNotes] = useState<Record<string, DailyNote>>(
    loadDailyNotes,
  )
  const [now, setNow] = useState(() => new Date())
  const [focusMode, setFocusMode] = useState(false)
  const [selectedWeekStart, setSelectedWeekStart] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dataStatus, setDataStatus] = useState('')

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const today = todayISO(now)
  const weeks = useMemo(
    () => (settings ? generateLifeWeeks(settings, today) : []),
    [settings, today],
  )
  const lifeStats = useMemo(
    () => (settings ? calculateLifeStats(settings, today) : null),
    [settings, today],
  )
  const clock = useMemo(
    () => calculateClockProgress(now, 1),
    [now],
  )
  const currentWeek =
    weeks.find((week) => week.state === 'current') ??
    [...weeks].reverse().find((week) => week.state === 'elapsed')
  const reviewWeek = weeks.find(
    (week) =>
      getWeekDisplayState(week, today, entries[week.startDate]) ===
      'awaiting-review',
  )
  const selectedWeek = weeks.find(
    (week) => week.startDate === selectedWeekStart,
  )

  const currentCommitment = useMemo(() => {
    if (!currentWeek || currentWeek.index === 0) {
      return ''
    }

    const previousWeek = weeks[currentWeek.index - 1]
    const previousEntry = previousWeek
      ? entries[previousWeek.startDate]
      : undefined

    return previousEntry?.reviewKind === 'on-time'
      ? previousEntry.nextCommitment.trim()
      : ''
  }, [currentWeek, entries, weeks])

  const recordedWeeks = Object.values(entries).filter(
    (entry) => entry.reviewKind === 'on-time',
  ).length

  useEffect(() => {
    if (!settings || !currentWeek) {
      return
    }

    const summary = createDesktopSummary({
      settings,
      anchorWeek: currentWeek,
      recordedWeeks,
      currentCommitment,
      generatedAt: now.toISOString(),
    })

    void getDesktopBridge()
      .then((desktop) => desktop.writeDesktopSummary(summary))
      .catch((error: unknown) => {
        console.error('Could not update the desktop summary.', error)
      })
  }, [currentCommitment, currentWeek, now, recordedWeeks, settings])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent): void {
      if (event.key !== 'Escape') {
        return
      }

      if (settingsOpen) {
        setSettingsOpen(false)
      } else if (selectedWeekStart) {
        setSelectedWeekStart('')
      } else if (focusMode) {
        setFocusMode(false)
      } else if (isTauriRuntime()) {
        void getDesktopBridge().then((desktop) => desktop.closeMainWindow())
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [focusMode, selectedWeekStart, settingsOpen])

  function commitmentBefore(week: LifeWeek): string {
    if (week.index === 0) {
      return ''
    }

    const previousWeek = weeks[week.index - 1]
    const previousEntry = previousWeek
      ? entries[previousWeek.startDate]
      : undefined

    return previousEntry?.reviewKind === 'on-time'
      ? previousEntry.nextCommitment
      : ''
  }

  function notesForWeek(week: LifeWeek): DailyNote[] {
    return Object.values(dailyNotes)
      .filter((note) => isDateInsideWeek(note.date, week))
      .sort((first, second) => first.date.localeCompare(second.date))
  }

  function previousYearsFor(week: LifeWeek) {
    const results: Array<{ year: number; entry: WeekEntry }> = []

    for (let yearsAgo = 1; yearsAgo <= 79; yearsAgo += 1) {
      const comparisonDate = addYearsClamped(week.startDate, -yearsAgo)
      const comparisonWeek = weeks.find((candidate) =>
        isDateInsideWeek(comparisonDate, candidate),
      )

      if (!comparisonWeek) {
        continue
      }

      const entry = entries[comparisonWeek.startDate]

      if (entry) {
        results.push({
          year: Number(comparisonDate.slice(0, 4)),
          entry,
        })
      }
    }

    return results
  }

  function handleSettingsSave(nextSettings: LifeSettings): void {
    saveSettings(nextSettings)
    setSettingsState(nextSettings)
    setSettingsOpen(false)
  }

  function handleWeekSelect(week: LifeWeek): void {
    setSelectedWeekStart(week.startDate)
  }

  function handleEntrySave(entry: WeekEntry): void {
    setEntries((current) => saveEntry(entry, current))
  }

  function handleDailyNoteSave(note: DailyNote): void {
    setDailyNotes((current) => saveDailyNote(note, current))
  }

  function usePersonalMode(): void {
    if (!settings) {
      return
    }

    const nextSettings = { ...settings, privacyMode: 'personal' as const }
    saveSettings(nextSettings)
    setSettingsState(nextSettings)
  }

  function togglePrivacy(): void {
    if (!settings) {
      return
    }

    const nextSettings: LifeSettings = {
      ...settings,
      privacyMode:
        settings.privacyMode === 'privacy' ? 'personal' : 'privacy',
    }
    saveSettings(nextSettings)
    setSettingsState(nextSettings)
  }

  async function downloadBackup(): Promise<void> {
    if (!settings) {
      return
    }

    const backup = createBackup(settings, entries, dailyNotes)

    try {
      const desktop = await getDesktopBridge()
      await desktop.exportBackup(
        JSON.stringify(backup, null, 2),
        `strongly-living-weekly-${today}.json`,
      )
    } catch (error) {
      setDataStatus(
        error instanceof Error
          ? error.message
          : 'The backup could not be exported.',
      )
    }
  }

  async function handleBackupImport(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const backup = parseBackup(await file.text())
      restoreBackup(backup)
      setSettingsState(backup.settings)
      setEntries(backup.entries)
      setDailyNotes(backup.dailyNotes)
      setSelectedWeekStart('')
      setDataStatus(
        `Restored ${Object.keys(backup.entries).length} weekly records and ${Object.keys(backup.dailyNotes).length} daily notes.`,
      )
    } catch (error) {
      setDataStatus(
        error instanceof Error
          ? error.message
          : 'The selected backup could not be restored.',
      )
    } finally {
      event.target.value = ''
    }
  }

  if (!settings) {
    return (
      <main className="setup-screen">
        <SetupForm onSave={handleSettingsSave} />
      </main>
    )
  }

  if (!lifeStats || !currentWeek) {
    return null
  }

  const selectedForKeyboard =
    selectedWeekStart || reviewWeek?.startDate || currentWeek.startDate
  const commitmentOrQuote =
    settings.privacyMode === 'personal' && currentCommitment
      ? currentCommitment
      : settings.quote.trim()
  const stripLabel =
    settings.privacyMode === 'personal' && currentCommitment
      ? 'This week'
      : commitmentOrQuote
        ? 'Quote'
        : ''
  const mapTheme = themeVariables(settings.appearance) as CSSProperties

  return (
    <main
      className={`map-screen map-screen--${settings.privacyMode}${focusMode ? ' is-focus' : ''}`}
      style={mapTheme}
    >
      <header className="metric-strip" data-tauri-drag-region>
        <div className="metric-strip__items">
          {settings.showDate && (
            <div className="top-metric top-metric--date">
              <strong>{formatShortDate(now)}</strong>
            </div>
          )}
          <div className="top-metric">
            <strong>{lifeStats.currentGridWeekNumber.toLocaleString()}</strong>
            <span>/ {lifeStats.totalGridWeeks.toLocaleString()} weeks</span>
          </div>
          {settings.showYearProgress && (
            <div className="top-metric">
              <strong>{formatPercentage(clock.yearProgress)}</strong>
              <span>year</span>
            </div>
          )}
          {settings.showWeekRemaining && (
            <div className="top-metric">
              <strong>{clock.daysRemainingInWeek}d</strong>
              <span>left</span>
            </div>
          )}
          <div className="top-metric">
            <strong>{recordedWeeks}</strong>
            <span>Recorded</span>
          </div>
        </div>

        <div className="metric-strip__actions">
          {reviewWeek && (
            <button
              className="button button--review"
              type="button"
              onClick={() => {
                setFocusMode(true)
                setSelectedWeekStart(reviewWeek.startDate)
              }}
            >
              Review open
            </button>
          )}
          <button className="button" type="button" onClick={togglePrivacy}>
            {settings.privacyMode === 'privacy' ? 'Privacy' : 'Personal'}
          </button>
          <button
            className="button"
            type="button"
            onClick={() => {
              setFocusMode((current) => !current)
              setSelectedWeekStart('')
            }}
          >
            {focusMode ? 'Done' : 'Focus'}
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
          >
            ...
          </button>
          {isTauriRuntime() && (
            <button
              className="icon-button"
              type="button"
              onClick={() => {
                void getDesktopBridge().then((desktop) =>
                  desktop.closeMainWindow(),
                )
              }}
              aria-label="Close Strongly Living Weekly"
            >
              ×
            </button>
          )}
        </div>
      </header>

      <LifeGrid
        weeks={weeks}
        entries={entries}
        today={today}
        privacyMode={settings.privacyMode}
        selectedWeekStart={selectedForKeyboard}
        interactive={focusMode}
        onSelectWeek={handleWeekSelect}
      />

      <footer
        className={`commitment-strip${!commitmentOrQuote && !focusMode ? ' commitment-strip--empty' : ''}`}
      >
        <div>
          {stripLabel && <span>{stripLabel}</span>}
          <p>{commitmentOrQuote}</p>
        </div>
        {focusMode && (
          <div className="map-legend" aria-label="Map legend">
            <span><i className="legend-swatch legend-swatch--current" />Current</span>
            <span><i className="legend-swatch legend-swatch--recorded" />Recorded</span>
            <span><i className="legend-swatch legend-swatch--missed" />Missed</span>
            <span><i className="legend-swatch legend-swatch--future" />Future</span>
          </div>
        )}
      </footer>

      {selectedWeek && (
        <div className="sheet-layer" role="presentation">
          <button
            className="sheet-layer__dismiss"
            type="button"
            onClick={() => setSelectedWeekStart('')}
            aria-label="Close week details"
          />
          <WeekEditor
            key={`${selectedWeek.startDate}-${settings.privacyMode}-${entries[selectedWeek.startDate]?.updatedAt ?? 'new'}`}
            week={selectedWeek}
            entry={entries[selectedWeek.startDate]}
            today={today}
            privacyMode={settings.privacyMode}
            previousCommitment={commitmentBefore(selectedWeek)}
            dailyNotes={notesForWeek(selectedWeek)}
            previousYears={previousYearsFor(selectedWeek)}
            onSave={handleEntrySave}
            onSaveDailyNote={handleDailyNoteSave}
            onRequestPersonal={usePersonalMode}
            onClose={() => setSelectedWeekStart('')}
          />
        </div>
      )}

      {settingsOpen && (
        <div className="sheet-layer" role="presentation">
          <button
            className="sheet-layer__dismiss"
            type="button"
            onClick={() => setSettingsOpen(false)}
            aria-label="Close settings"
          />
          <SettingsPanel
            settings={settings}
            dataStatus={dataStatus}
            onSave={handleSettingsSave}
            onExport={downloadBackup}
            onImport={handleBackupImport}
            onClose={() => setSettingsOpen(false)}
          />
        </div>
      )}
    </main>
  )
}

export default App
