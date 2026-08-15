import { BrowserDesktopBridge } from './browser/BrowserDesktopBridge'

import type { DesktopBridge } from './DesktopBridge'

let bridge: Promise<DesktopBridge> | undefined

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function getDesktopBridge(): Promise<DesktopBridge> {
  bridge ??= isTauriRuntime()
    ? import('./tauri/TauriDesktopBridge').then(
        ({ TauriDesktopBridge }) => new TauriDesktopBridge(),
      )
    : Promise.resolve(new BrowserDesktopBridge())

  return bridge
}
