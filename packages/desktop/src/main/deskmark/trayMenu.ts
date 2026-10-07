export type TrayAction = 'newFile' | 'tasks' | 'calendar' | 'note' | 'show' | 'login' | 'quit'

export interface TrayEntry {
  action?: TrayAction
  separator?: boolean
  checkbox?: boolean
  labelKey?: string
}

export function trayMenuEntries(): TrayEntry[] {
  return [
    { action: 'newFile', labelKey: 'sticky.newFile' },
    { action: 'tasks', labelKey: 'menu.view.tasks' },
    { action: 'calendar', labelKey: 'menu.view.calendar' },
    { action: 'note', labelKey: 'sticky.note' },
    { separator: true },
    { action: 'show', labelKey: 'sticky.show' },
    { action: 'login', labelKey: 'sticky.login', checkbox: true },
    { separator: true },
    { action: 'quit', labelKey: 'sticky.quit' }
  ]
}
