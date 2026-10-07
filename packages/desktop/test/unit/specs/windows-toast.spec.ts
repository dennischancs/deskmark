import { describe, expect, it } from 'vitest'
import {
  appUserModelId,
  reminderCaption,
  sameExecutable,
  shortcutHasModelId,
  toastShortcutPlan
} from '../../../src/main/deskmark/windowsToast'

describe('windows toast shortcut', () => {
  const appData = 'C:/Users/me/AppData/Roaming'

  it('uses a separate id for an unpackaged run', () => {
    expect(appUserModelId(true)).toBe('app.deskmark.desktop')
    expect(appUserModelId(false)).toBe('app.deskmark.desktop.dev')
  })

  it('does not replace the installer shortcut', () => {
    expect(toastShortcutPlan({
      appData,
      packaged: true,
      execPath: 'C:/Program Files/Deskmark/marktext.exe',
      installedShortcutReady: true
    })).toBeNull()
  })

  it('writes a shortcut when an unpacked build has none', () => {
    const plan = toastShortcutPlan({
      appData,
      packaged: true,
      execPath: 'D:/deskmark/dist/win-unpacked/marktext.exe',
      installedShortcutReady: false
    })
    expect(plan?.path.endsWith('Programs\\Deskmark.lnk') || plan?.path.endsWith('Programs/Deskmark.lnk')).toBe(true)
    expect(plan?.appUserModelId).toBe('app.deskmark.desktop')
    expect(plan?.target).toContain('win-unpacked')
  })

  it('keeps a dev shortcut off the installed name', () => {
    const plan = toastShortcutPlan({
      appData,
      packaged: false,
      execPath: 'C:/electron.exe',
      installedShortcutReady: true
    })
    expect(plan?.path.endsWith('Deskmark Dev.lnk')).toBe(true)
    expect(plan?.appUserModelId).toBe('app.deskmark.desktop.dev')
  })

  it('puts the note name and clock in the toast', () => {
    expect(reminderCaption('notes/milk.md', '2026-10-07T09:05:00+08:00')).toBe('milk.md / 09:05')
    expect(reminderCaption('notes/milk.md', null)).toBe('milk.md')
  })

  it('treats a shortcut without the model id as not ready', () => {
    const id = 'app.deskmark.desktop'
    expect(shortcutHasModelId(Buffer.from('plain shortcut'), id)).toBe(false)
    expect(shortcutHasModelId(Buffer.from(id, 'utf16le'), id)).toBe(true)
    expect(toastShortcutPlan({
      appData,
      packaged: true,
      execPath: 'D:/deskmark/dist/win-unpacked/marktext.exe',
      installedShortcutReady: false
    })?.appUserModelId).toBe(id)
  })

  it('treats a different program path as a different shortcut target', () => {
    expect(sameExecutable(
      'D:/deskmark/dist/win-unpacked/marktext.exe',
      'D:\\deskmark\\dist\\win-unpacked\\marktext.exe'
    )).toBe(true)
    expect(sameExecutable(
      'D:/deskmark/dist/win-unpacked/marktext.exe',
      'C:/Program Files/Deskmark/marktext.exe'
    )).toBe(false)
  })
})
