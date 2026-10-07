import { describe, expect, it } from 'vitest'
import { normalizeReminderSeconds } from 'common/reminderSeconds'
import { reminderTimeoutType } from 'main_renderer/deskmark/windowsToast'

describe('reminder toast lifetime', () => {
  it('holds a Windows banner so the app can hide it after the chosen seconds', () => {
    expect(reminderTimeoutType('win32')).toBe('never')
  })

  it('leaves other desktops on the system default', () => {
    expect(reminderTimeoutType('darwin')).toBeUndefined()
    expect(reminderTimeoutType('linux')).toBeUndefined()
  })

  it('defaults to 30 seconds and stays inside 1 to 600', () => {
    expect(normalizeReminderSeconds(undefined)).toBe(30)
    expect(normalizeReminderSeconds(30)).toBe(30)
    expect(normalizeReminderSeconds(0)).toBe(1)
    expect(normalizeReminderSeconds(12.6)).toBe(13)
    expect(normalizeReminderSeconds(9000)).toBe(600)
    expect(normalizeReminderSeconds('no')).toBe(30)
  })
})
