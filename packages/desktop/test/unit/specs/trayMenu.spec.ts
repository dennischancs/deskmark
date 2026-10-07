import { describe, expect, it } from 'vitest'
import { trayMenuEntries } from 'main_renderer/deskmark/trayMenu'

describe('tray menu', () => {
  it('offers a new file, tasks, the calendar, a sticky note, and quit on both clicks', () => {
    const actions = trayMenuEntries().flatMap(entry => entry.action ? [entry.action] : [])
    expect(actions).toEqual(['newFile', 'tasks', 'calendar', 'note', 'show', 'login', 'quit'])
    expect(trayMenuEntries().find(entry => entry.action === 'login')?.checkbox).toBe(true)
  })
})
