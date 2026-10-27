import { AppIcon } from './AppIcon'

import type { LifeCalendarBackup } from '../core/models'

interface RestoreBackupDialogProps {
  backup: LifeCalendarBackup
  onCancel: () => void
  onConfirm: () => void
}

function formatExportDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown export date'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function RestoreBackupDialog({
  backup,
  onCancel,
  onConfirm,
}: RestoreBackupDialogProps) {
  const reviewCount = Object.keys(backup.entries).length
  const noteCount = Object.keys(backup.dailyNotes).length
  const chapterCount = backup.settings.lifeChapters.length

  return (
    <div className="confirm-layer">
      <button
        className="confirm-layer__dismiss"
        type="button"
        onClick={onCancel}
        aria-label="Cancel backup restore"
      />
      <section
        className="restore-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-title"
        aria-describedby="restore-description"
      >
        <div className="restore-dialog__icon" aria-hidden="true">
          <AppIcon name="restore" />
        </div>
        <div className="restore-dialog__heading">
          <span>Backup ready</span>
          <h2 id="restore-title">Replace this local map?</h2>
          <p id="restore-description">
            Restoring replaces the reviews, daily notes, life chapters,
            settings, and theme currently stored by this app.
          </p>
        </div>

        <dl className="restore-summary">
          <div>
            <dt>Weekly records</dt>
            <dd>{reviewCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Daily notes</dt>
            <dd>{noteCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Life chapters</dt>
            <dd>{chapterCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Exported</dt>
            <dd>{formatExportDate(backup.exportedAt)}</dd>
          </div>
        </dl>

        <p className="restore-dialog__note">
          Export your current map first if there is anything you may want to
          keep. No data is uploaded during restore.
        </p>

        <div className="form-actions restore-dialog__actions">
          <button className="button" type="button" onClick={onCancel} autoFocus>
            Keep current map
          </button>
          <button className="button button--danger" type="button" onClick={onConfirm}>
            Replace and restore
          </button>
        </div>
      </section>
    </div>
  )
}
