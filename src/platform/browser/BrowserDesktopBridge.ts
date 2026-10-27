import type { DesktopSummary } from '../../core/desktopSummary'
import type { ThemeColors } from '../../core/models'
import type { DesktopBridge } from '../DesktopBridge'

export class BrowserDesktopBridge implements DesktopBridge {
  readonly kind = 'browser' as const

  closeMainWindow(): Promise<void> {
    return Promise.resolve()
  }

  readDesktopTheme(): Promise<ThemeColors | null> {
    return Promise.resolve(null)
  }

  readTimelineSeed(): Promise<string | null> {
    return Promise.resolve(null)
  }

  writeDesktopSummary(summary: DesktopSummary): Promise<void> {
    void summary
    return Promise.resolve()
  }

  async exportBackup(contents: string, suggestedName: string): Promise<void> {
    const blob = new Blob([contents], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = suggestedName
    link.click()
    URL.revokeObjectURL(url)
  }
}
