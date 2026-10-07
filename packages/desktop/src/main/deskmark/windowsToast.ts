import { join } from 'node:path'

export const DESKMARK_APP_USER_MODEL_ID = 'app.deskmark.desktop'
export const DESKMARK_DEV_APP_USER_MODEL_ID = 'app.deskmark.desktop.dev'

export function appUserModelId(packaged: boolean): string {
  return packaged ? DESKMARK_APP_USER_MODEL_ID : DESKMARK_DEV_APP_USER_MODEL_ID
}

export function installedShortcutCandidates(appData: string): string[] {
  const programs = join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs')
  return [
    join(programs, 'Deskmark.lnk'),
    join(programs, 'Deskmark', 'Deskmark.lnk')
  ]
}

export function devShortcutPath(appData: string): string {
  return join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Deskmark Dev.lnk')
}

// Electron's "replace" only updates a shortcut that already exists, and
// "create" fails when one is already there. The first launch has no link.
export function shortcutWriteOperation(exists: boolean): 'create' | 'replace' {
  return exists ? 'replace' : 'create'
}

export interface ToastShortcutPlan {
  path: string
  appUserModelId: string
  target: string
}

// Windows hides a toast until some Start Menu shortcut carries the same
// AppUserModelID. The installer writes that shortcut; an unpacked run does not.
export function toastShortcutPlan(input: {
  appData: string
  packaged: boolean
  execPath: string
  installedShortcutReady: boolean
}): ToastShortcutPlan | null {
  if (input.packaged) {
    if (input.installedShortcutReady) return null
    return {
      path: installedShortcutCandidates(input.appData)[0],
      appUserModelId: DESKMARK_APP_USER_MODEL_ID,
      target: input.execPath
    }
  }
  return {
    path: devShortcutPath(input.appData),
    appUserModelId: DESKMARK_DEV_APP_USER_MODEL_ID,
    target: input.execPath
  }
}

export function shortcutHasModelId(bytes: Uint8Array, id: string): boolean {
  const needle = Buffer.from(id, 'utf16le')
  const haystack = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return haystack.includes(needle)
}

export function sameExecutable(left: string, right: string): boolean {
  const normalize = (value: string): string => value.replaceAll('/', '\\').replace(/\\+$/, '').toLowerCase()
  return normalize(left) === normalize(right)
}

export function reminderCaption(notePath: string, remind: string | null): string {
  const file = notePath.split('/').pop() || notePath
  const clock = remind?.match(/T(\d{2}:\d{2})/)?.[1] || ''
  return clock ? `${file} / ${clock}` : file
}

export const DEFAULT_REMINDER_SECONDS = 30
export const MIN_REMINDER_SECONDS = 1
export const MAX_REMINDER_SECONDS = 600

export function normalizeReminderSeconds(value: unknown): number {
  const seconds = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(seconds)) return DEFAULT_REMINDER_SECONDS
  return Math.min(MAX_REMINDER_SECONDS, Math.max(MIN_REMINDER_SECONDS, Math.round(seconds)))
}

// A default Windows toast hides in a few seconds. 'never' holds the banner
// so the app can hide it itself after the seconds chosen in settings.
export function reminderTimeoutType(platform: string): 'never' | undefined {
  return platform === 'win32' ? 'never' : undefined
}
