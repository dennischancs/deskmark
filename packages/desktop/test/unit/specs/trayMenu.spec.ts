import { describe, expect, it } from 'vitest'
import { closeHidesWindow, trayMenuEntries } from 'main_renderer/deskmark/trayMenu'

describe('tray menu', () => {
  it('offers a new file, tasks, the calendar, a sticky note, and quit on both clicks', () => {
    const actions = trayMenuEntries().flatMap(entry => entry.action ? [entry.action] : [])
    expect(actions).toEqual(['newFile', 'tasks', 'calendar', 'note', 'show', 'login', 'quit'])
    expect(trayMenuEntries().find(entry => entry.action === 'login')?.checkbox).toBe(true)
  })

  it('hides the main window for the tray, and closes it when quitting', () => {
    expect(closeHidesWindow(true, false)).toBe(true)
    expect(closeHidesWindow(true, true)).toBe(false)
    expect(closeHidesWindow(false, false)).toBe(false)
  })
})
