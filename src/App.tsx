import { useEffect, useMemo, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'

import './App.css'

import { AppIcon } from './components/AppIcon'
import { LifeGrid } from './components/LifeGrid'
import { RestoreBackupDialog } from './components/RestoreBackupDialog'
import { SettingsPanel } from './components/SettingsPanel'
import { SetupForm } from './components/SetupForm'
import { WeekEditor } from './components/WeekEditor'
import { calculateClockProgress } from './core/dates/clockProgress'
import { createStripMessages } from './core/quoteRotation'
import {
  createDesktopSummary,
  findLastOnTimeReviewWeekStart,
} from './core/desktopSummary'
import {
  calculateLifeStats,
  generateLifeWeeks,
} from './core/dates/lifeCalendar'
import {
  addYearsClamped,
  todayISO,
} from './core/dates/localDate'
import {
  DEFAULT_APPEARANCE,
  resolveThemeColors,
  themeVariables,
} from './core/theme'
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
  parseTimelineSeed,
  restoreBackup,
  saveDailyNote,
  saveEntry,
  saveSettings,
} from './storage/localStorageRepository'
import { chaptersForWeek } from './core/timeline'

import type { ChangeEvent, CSSProperties } from 'react'
import type { LifeWeek } from './core/dates/lifeCalendar'
import type {
  DailyNote,
  LifeCalendarBackup,
  LifeSettings,
  ThemeColors,
  WeekEntry,
} from './core/models'

const MAX_BACKUP_BYTES = 64 * 1024 * 1024
const TIMELINE_SEED_MARKER_KEY =
  'strongly-living-weekly.timeline-seed-imported.v1'

function themesMatch(
  first: ThemeColors,
  second: ThemeColors,
): boolean {
  return (Object.keys(first) as Array<keyof ThemeColors>).every(
    (key) => first[key] === second[key],
  )
}

function applyDesktopTheme(
  settings: LifeSettings,
  desktopTheme: ThemeColors | null,
): LifeSettings {
  if (
    settings.appearance.themeId !== 'desktop' ||
    !desktopTheme ||
    themesMatch(settings.appearance.customColors, desktopTheme)
  ) {
    return settings
  }

  return {
    ...settings,
    appearance: {
      themeId: 'desktop',
      customColors: { ...desktopTheme },
    },
  }
}

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
  const [selectedWeekStart, setSelectedWeekStart] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dataStatus, setDataStatus] = useState('')
  const [desktopTheme, setDesktopTheme] = useState<ThemeColors | null>(null)
  const [pendingBackup, setPendingBackup] =
    useState<LifeCalendarBackup | null>(null)
  const [stripTick, setStripTick] = useState(0)
  const timelineSeedChecked = useRef(false)
  const reviewPromptedFor = useRef('')

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!settings || timelineSeedChecked.current) {
      return
    }

    timelineSeedChecked.current = true
    let cancelled = false

    void getDesktopBridge()
      .then((desktop) => desktop.readTimelineSeed())
      .then((source) => {
        if (cancelled || !source) {
          return
        }

        const seed = parseTimelineSeed(source)

        if (window.localStorage.getItem(TIMELINE_SEED_MARKER_KEY) === seed.seedId) {
          return
        }

        setSettingsState((current) => {
          if (!current) {
            return current
          }

          const seededIds = new Set(seed.chapters.map((chapter) => chapter.id))
          const nextSettings = {
            ...current,
            lifeChapters: [
              ...current.lifeChapters.filter(
                (chapter) => !seededIds.has(chapter.id),
              ),
              ...seed.chapters,
            ],
          }

          saveSettings(nextSettings)
          window.localStorage.setItem(TIMELINE_SEED_MARKER_KEY, seed.seedId)
          return nextSettings
        })
      })
      .catch((error: unknown) => {
        console.warn('The optional life chapter seed could not be imported.', error)
      })

    return () => {
      cancelled = true
    }
  }, [settings])

  useEffect(() => {
    const interval = window.setInterval(
      () => setStripTick((current) => current + 1),
      18_000,
    )
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    let cancelled = false
    let refreshTimer: number | undefined
    let stopListening: (() => void) | undefined

    function refreshDesktopTheme(): void {
      void getDesktopBridge()
        .then((desktop) => desktop.readDesktopTheme())
        .then((theme) => {
          if (cancelled || !theme) {
            return
          }

          setDesktopTheme(theme)
          setSettingsState((current) => {
            if (!current) {
              return current
            }

            const themed = applyDesktopTheme(current, theme)
            if (themed !== current) {
              saveSettings(themed)
            }
            return themed
          })
        })
        .catch((error: unknown) => {
          console.warn('The desktop palette is unavailable.', error)
        })
    }

    refreshDesktopTheme()

    if (isTauriRuntime()) {
      void listen('ricemood-theme-changed', () => {
        window.clearTimeout(refreshTimer)
        refreshTimer = window.setTimeout(refreshDesktopTheme, 250)
      }).then((unlisten) => {
        if (cancelled) {
          unlisten()
        } else {
          stopListening = unlisten
        }
      })
    }

    return () => {
      cancelled = true
      window.clearTimeout(refreshTimer)
      stopListening?.()
    }
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

  useEffect(() => {
    if (!reviewWeek || reviewPromptedFor.current === reviewWeek.startDate) {
      return
    }

    reviewPromptedFor.current = reviewWeek.startDate
    setSelectedWeekStart(reviewWeek.startDate)
  }, [reviewWeek])

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
  const lastOnTimeReviewWeekStart = useMemo(
    () => findLastOnTimeReviewWeekStart(entries),
    [entries],
  )

  useEffect(() => {
    if (!settings || !currentWeek) {
      return
    }

    const summary = createDesktopSummary({
      settings,
      anchorWeek: currentWeek,
      recordedWeeks,
      lastOnTimeReviewWeekStart,
      currentCommitment,
      generatedAt: new Date().toISOString(),
    })

    void getDesktopBridge()
      .then((desktop) => desktop.writeDesktopSummary(summary))
      .catch((error: unknown) => {
        console.error('Could not update the desktop summary.', error)
      })
  }, [
    currentCommitment,
    currentWeek,
    lastOnTimeReviewWeekStart,
    recordedWeeks,
    settings,
  ])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent): void {
      if (event.key !== 'Escape') {
        return
      }

      if (pendingBackup) {
        setPendingBackup(null)
      } else if (settingsOpen) {
        setSettingsOpen(false)
      } else if (selectedWeekStart) {
        setSelectedWeekStart('')
      } else if (isTauriRuntime()) {
        void getDesktopBridge().then((desktop) => desktop.closeMainWindow())
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [pendingBackup, selectedWeekStart, settingsOpen])

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
    const themedSettings = applyDesktopTheme(nextSettings, desktopTheme)
    saveSettings(themedSettings)
    setSettingsState(themedSettings)
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
      if (file.size > MAX_BACKUP_BYTES) {
        throw new Error('This backup is larger than the 64 MB safety limit.')
      }

      const backup = parseBackup(await file.text())
      setPendingBackup(backup)
      setDataStatus(
        `Backup checked: ${Object.keys(backup.entries).length} weekly records, ${Object.keys(backup.dailyNotes).length} daily notes, and ${backup.settings.lifeChapters.length} life chapters.`,
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

  function confirmBackupRestore(): void {
    if (!pendingBackup) {
      return
    }

    const restoredSettings = applyDesktopTheme(
      pendingBackup.settings,
      desktopTheme,
    )
    const restoredBackup = {
      ...pendingBackup,
      settings: restoredSettings,
    }

    restoreBackup(restoredBackup)
    setSettingsState(restoredSettings)
    setEntries(restoredBackup.entries)
    setDailyNotes(restoredBackup.dailyNotes)
    setSelectedWeekStart('')
    setSettingsOpen(false)
    setPendingBackup(null)
    setDataStatus(
      `Restored ${Object.keys(restoredBackup.entries).length} weekly records, ${Object.keys(restoredBackup.dailyNotes).length} daily notes, and ${restoredSettings.lifeChapters.length} life chapters.`,
    )
  }

  if (!settings) {
    const setupAppearance = {
      themeId: 'desktop' as const,
      customColors:
        desktopTheme ?? { ...DEFAULT_APPEARANCE.customColors },
    }

    return (
      <main
        className="setup-screen"
        style={themeVariables(setupAppearance) as CSSProperties}
      >
        <SetupForm
          dataStatus={dataStatus}
          onSave={handleSettingsSave}
          onImport={handleBackupImport}
        />
        {pendingBackup && (
          <RestoreBackupDialog
            backup={pendingBackup}
            onCancel={() => setPendingBackup(null)}
            onConfirm={confirmBackupRestore}
          />
        )}
      </main>
    )
  }

  if (!lifeStats || !currentWeek) {
    return null
  }

  const selectedForKeyboard =
    selectedWeekStart || reviewWeek?.startDate || currentWeek.startDate
  const stripMessages = createStripMessages(
    settings.privacyMode,
    currentCommitment,
    settings.quote,
  )
  const stripMessage = stripMessages[stripTick % stripMessages.length]
  const mapTheme = themeVariables(settings.appearance) as CSSProperties

  return (
    <main
      className={`map-screen map-screen--${settings.privacyMode}`}
      style={mapTheme}
    >
      <header className="metric-strip" data-tauri-drag-region>
        <div className="metric-strip__brand" aria-label="Strongly Living Weekly">
          <span className="brand-mark" aria-hidden="true">52×80</span>
          <span className="brand-name">Strongly Living <b>Weekly</b></span>
        </div>

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
                setSelectedWeekStart(reviewWeek.startDate)
              }}
            >
              <AppIcon name="calendar" />
              Review open
            </button>
          )}
          <button
            className="button mode-button"
            type="button"
            onClick={togglePrivacy}
            aria-label={`Current mode: ${settings.privacyMode}. Switch to ${settings.privacyMode === 'privacy' ? 'Personal' : 'Privacy'} mode.`}
          >
            <AppIcon name={settings.privacyMode === 'privacy' ? 'shield' : 'user'} />
            {settings.privacyMode === 'privacy' ? 'Private' : 'Personal'}
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
          >
            <AppIcon name="settings" />
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
              <AppIcon name="close" />
            </button>
          )}
        </div>
      </header>

      <LifeGrid
        weeks={weeks}
        entries={entries}
        today={today}
        privacyMode={settings.privacyMode}
        colors={resolveThemeColors(settings.appearance)}
        chapters={settings.lifeChapters}
        selectedWeekStart={selectedForKeyboard}
        onSelectWeek={handleWeekSelect}
      />

      <footer className="commitment-strip">
        <div>
          <span>{stripMessage.label}</span>
          <p className="strip-message" key={`${stripTick}-${stripMessage.text}`}>
            {stripMessage.text}
          </p>
        </div>
        <div className="map-legend" aria-label="Map legend">
          <span><i className="legend-swatch legend-swatch--current" />Current</span>
          <span><i className="legend-swatch legend-swatch--recorded" />Recorded</span>
          <span><i className="legend-swatch legend-swatch--missed" />Missed</span>
          <span><i className="legend-swatch legend-swatch--future" />Future</span>
          {settings.lifeChapters.length > 0 && (
            <span><i className="legend-swatch legend-swatch--chapters" />Chapters</span>
          )}
        </div>
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
            chapters={chaptersForWeek(selectedWeek, settings.lifeChapters)}
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
            desktopTheme={desktopTheme}
            dataStatus={dataStatus}
            onSave={handleSettingsSave}
            onExport={downloadBackup}
            onImport={handleBackupImport}
            onClose={() => setSettingsOpen(false)}
          />
        </div>
      )}

      {pendingBackup && (
        <RestoreBackupDialog
          backup={pendingBackup}
          onCancel={() => setPendingBackup(null)}
          onConfirm={confirmBackupRestore}
        />
      )}
    </main>
  )
}

export default App
