import type { DesktopSummary } from '../core/desktopSummary'

export interface DesktopBridge {
  readonly kind: 'browser' | 'tauri'
  closeMainWindow(): Promise<void>
  writeDesktopSummary(summary: DesktopSummary): Promise<void>
  exportBackup(contents: string, suggestedName: string): Promise<void>
}
