import type { DesktopSummary } from '../core/desktopSummary'
import type { ThemeColors } from '../core/models'

export interface DesktopBridge {
  readonly kind: 'browser' | 'tauri'
  closeMainWindow(): Promise<void>
  readDesktopTheme(): Promise<ThemeColors | null>
  readTimelineSeed(): Promise<string | null>
  writeDesktopSummary(summary: DesktopSummary): Promise<void>
  exportBackup(contents: string, suggestedName: string): Promise<void>
}
