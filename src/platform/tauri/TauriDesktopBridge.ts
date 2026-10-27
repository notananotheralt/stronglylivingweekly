import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { save } from '@tauri-apps/plugin-dialog'

import type { DesktopSummary } from '../../core/desktopSummary'
import type { ThemeColors } from '../../core/models'
import type { DesktopBridge } from '../DesktopBridge'

export class TauriDesktopBridge implements DesktopBridge {
  readonly kind = 'tauri' as const

  async closeMainWindow(): Promise<void> {
    await getCurrentWindow().close()
  }

  async readDesktopTheme(): Promise<ThemeColors | null> {
    return invoke<ThemeColors | null>('read_desktop_theme')
  }

  async readTimelineSeed(): Promise<string | null> {
    return invoke<string | null>('read_timeline_seed')
  }

  async writeDesktopSummary(summary: DesktopSummary): Promise<void> {
    await invoke('write_desktop_summary', { summary })
  }

  async exportBackup(contents: string, suggestedName: string): Promise<void> {
    const path = await save({
      defaultPath: suggestedName,
      filters: [{ name: 'Strongly Living Weekly backup', extensions: ['json'] }],
    })

    if (path) {
      await invoke('export_backup', { contents, path })
    }
  }
}
