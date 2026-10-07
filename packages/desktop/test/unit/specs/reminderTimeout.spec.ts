import { describe, expect, it } from 'vitest'
import { reminderTimeoutType } from 'main_renderer/deskmark/windowsToast'

describe('reminder toast lifetime', () => {
  it('keeps the Windows banner until it is opened', () => {
    expect(reminderTimeoutType('win32')).toBe('never')
  })

  it('leaves other desktops on the system default', () => {
    expect(reminderTimeoutType('darwin')).toBeUndefined()
    expect(reminderTimeoutType('linux')).toBeUndefined()
  })
})
