import { globalShortcut } from 'electron'
import log from 'electron-log'
import { normalizeCaptureAccelerator } from 'common/captureShortcut'

let registered = ''

export function applyCaptureShortcut(value: unknown, capture: () => void): boolean {
  const next = normalizeCaptureAccelerator(value)
  if (registered) {
    globalShortcut.unregister(registered)
    registered = ''
  }
  if (!next) return false
  try {
    const ok = globalShortcut.register(next, capture)
    if (!ok) {
      log.warn('capture shortcut was not registered', next)
      return false
    }
    registered = next
    return true
  } catch (error) {
    log.warn('capture shortcut failed', next, error)
    return false
  }
}

export function clearCaptureShortcut(): void {
  if (!registered) return
  globalShortcut.unregister(registered)
  registered = ''
}
